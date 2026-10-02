import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { signIn } from './m4-helpers.mjs';
/* global document,window */
const directory = 'artifacts/m18/browser-runs/' + process.env.M18_BROWSER_RUN_ID;
const fixtures = JSON.parse(readFileSync(directory + '/fixtures.json', 'utf8'));
const region = page => page.getByRole('region', { name: 'Ghi chú nội bộ', exact: true });
const routeFor = id => '**/api/v1/requests/' + id + '/internal-notes';
const record = (name, values) => writeFileSync(directory + '/' + name + '.json', JSON.stringify({ runId: fixtures.runId, result: 'PASS', ...values }, null, 2) + '\n');

test('M18 real STAFF → MANAGER collaboration; USER section/content/API activity absent', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext()));
  const [staff, manager, user] = await Promise.all(contexts.map(context => context.newPage()));
  const exceptions = [], userPayloads = [], userNoteRequests = [];
  for (const page of [staff, manager, user]) page.on('pageerror', error => exceptions.push(error.message));
  user.on('request', request => { if (request.url().includes('/internal-notes')) userNoteRequests.push(request.url()); });
  user.on('response', async response => { if (response.url().includes('/api/v1/') && response.status() === 200 && response.headers()['content-type']?.includes('json')) userPayloads.push(await response.text().catch(() => '')); });
  try {
    const id = fixtures.requests.collaboration.id;
    await signIn(staff, 'staff.iot@mobiflow.local'); await staff.goto('/staff/requests/' + id);
    await expect(region(staff).getByText('Chưa có ghi chú nội bộ.', { exact: true })).toBeVisible();
    const staffBody = 'Đã kiểm tra log hệ thống.\nĐang chờ đội IoT xác nhận gateway 🙂. M18 browser private.';
    await region(staff).getByLabel('Nội dung ghi chú', { exact: true }).fill(staffBody);
    await region(staff).getByRole('button', { name: 'Thêm ghi chú', exact: true }).click();
    await expect(region(staff).getByRole('status')).toContainText('Đã thêm ghi chú nội bộ.');
    await expect(region(staff).locator('.internal-note-body').first()).toHaveText(staffBody);
    await expect(region(staff).locator('time')).toHaveAttribute('datetime', /Z$/);
    await expect(region(staff)).toContainText('IoT Specialist');
    await signIn(manager, 'manager@mobiflow.local'); await manager.goto('/manager/requests/' + id);
    await expect(region(manager).locator('.internal-note-body').first()).toHaveText(staffBody);
    const managerBody = 'Ưu tiên xử lý trước 14:00. Kiểm tra cấu hình APN. M18 private manager.';
    await region(manager).getByLabel('Nội dung ghi chú', { exact: true }).fill(managerBody);
    await region(manager).getByRole('button', { name: 'Thêm ghi chú', exact: true }).click();
    await expect(region(manager).locator('.internal-note-body').first()).toHaveText(managerBody);
    await expect(region(manager)).toContainText('Demo Manager');
    await signIn(user, 'user@mobiflow.local'); await user.goto('/user/requests/' + id);
    await expect(user.getByRole('heading', { name: 'Nội dung yêu cầu', exact: true })).toBeVisible();
    await expect(region(user)).toHaveCount(0); await expect(user.getByText(/M18 browser private|M18 private manager/)).toHaveCount(0);
    await user.waitForLoadState('networkidle');
    expect(userNoteRequests).toEqual([]); expect(userPayloads.join('')).not.toContain('M18 browser private'); expect(userPayloads.join('')).not.toContain('INTERNAL_NOTE_CREATED');
    expect(exceptions).toEqual([]); await user.screenshot({ path: directory + '/user-no-internal-notes.png', fullPage: true });
    record('collaboration', { staffCreate: true, managerReadCreate: true, authorTimestamp: true, unicodeNewlines: true, userUiAbsent: true, userNoteApiRequests: 0, userPayloadCanaryAbsent: true, consolePageErrors: exceptions });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('M18 loading/empty/list retry and failed-create draft retention, bounded duplicate submit', async ({ page }) => {
  const id = fixtures.requests.states.id, endpoint = routeFor(id);
  await signIn(page, 'staff.iot@mobiflow.local');
  await page.route(endpoint, async route => { if (route.request().method() === 'GET') await delay(800); await route.continue(); });
  await page.goto('/staff/requests/' + id); await expect(region(page).getByRole('status', { name: 'Đang tải ghi chú nội bộ', exact: true })).toBeVisible();
  await expect(region(page).getByText('Chưa có ghi chú nội bộ.', { exact: true })).toBeVisible(); await page.unroute(endpoint);
  let failed = false;
  await page.route(endpoint, async route => { if (route.request().method() === 'GET' && !failed) { failed = true; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'SQL/Prisma fixture details must stay hidden' }, requestId: id }) }); } else await route.continue(); });
  await region(page).getByRole('button', { name: 'Tải lại ghi chú nội bộ', exact: true }).click();
  await expect(region(page).getByRole('alert')).toContainText('Không thể tải ghi chú nội bộ.');
  await expect(region(page)).not.toContainText('SQL/Prisma'); await region(page).getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(region(page).getByRole('alert')).toHaveCount(0); await page.unroute(endpoint);
  let postFailure = true;
  await page.route(endpoint, async route => { if (route.request().method() === 'POST' && postFailure) { postFailure = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Synthetic unavailable' }, requestId: id }) }); } else await route.continue(); });
  const body = 'Bản nháp tiếng Việt 🙂 cần giữ khi gửi thất bại.';
  const textarea = region(page).getByLabel('Nội dung ghi chú', { exact: true }); await textarea.fill(body);
  await region(page).getByRole('button', { name: 'Thêm ghi chú', exact: true }).click();
  await expect(region(page).getByRole('alert')).toContainText('Nội dung được giữ lại'); await expect(textarea).toHaveValue(body); await page.unroute(endpoint);
  let posts = 0;
  await page.route(endpoint, async route => { if (route.request().method() === 'POST') { posts++; await delay(500); } await route.continue(); });
  await region(page).locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(region(page).getByRole('button', { name: 'Đang thêm ghi chú…', exact: true })).toBeDisabled(); await expect(textarea).toBeDisabled();
  await expect(region(page).getByRole('status')).toContainText('Đã thêm ghi chú nội bộ.');
  expect(posts).toBe(1); await expect(textarea).toHaveValue(''); await expect(region(page).locator('.internal-note-body')).toHaveCount(1); await page.unroute(endpoint);
  await textarea.fill('đ'.repeat(4001)); await expect(region(page).getByRole('alert')).toContainText('Giới hạn 4.000'); await expect(region(page).getByRole('button', { name: 'Thêm ghi chú', exact: true })).toBeDisabled();
  await textarea.fill('🙂'.repeat(4000)); await expect(region(page)).toContainText('4000 / 4.000 ký tự'); await expect(region(page).getByRole('button', { name: 'Thêm ghi chú', exact: true })).toBeEnabled();
  record('states', { loading: true, empty: true, listRetry: true, safeErrors: true, draftRetained: true, duplicateSubmitRequests: posts, successClearsDraft: true, unicodeLimit: '4000 code points including 4000 emoji', transportFixtures: 'explicit UI-only GET/POST 503 and delay; restored actual API' });
});

test('M18 STAFF/MANAGER long literal text: 360/768/1440/1920, Axe, keyboard/focus and 44px controls', async ({ browser }) => {
  const checks = [], exceptions = [], imageRequests = [], dialogs = [];
  for (const role of ['STAFF', 'MANAGER']) {
    const context = await browser.newContext(), page = await context.newPage();
    page.on('pageerror', error => exceptions.push(error.message)); page.on('request', request => { if (request.url().includes('/m18-xss-image')) imageRequests.push(request.url()); }); page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    try {
      await signIn(page, role === 'STAFF' ? 'staff.iot@mobiflow.local' : 'manager@mobiflow.local'); await page.goto('/' + role.toLowerCase() + '/requests/' + fixtures.requests.long.id);
      await expect(region(page).locator('.internal-note-body').filter({ hasText: fixtures.literal })).toHaveText(fixtures.literal);
      for (const width of [360, 768, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 }); await region(page).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const text = region(page).getByLabel('Nội dung ghi chú', { exact: true }), button = region(page).getByRole('button', { name: 'Thêm ghi chú', exact: true });
        const textarea = await text.boundingBox(); expect(textarea.width).toBeGreaterThan(100); expect(textarea.x + textarea.width).toBeLessThanOrEqual(width);
        for (const control of await region(page).getByRole('button').all()) { const box = await control.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
        for (const time of await region(page).locator('time').all()) { const box = await time.boundingBox(); expect(box.width).toBeGreaterThan(30); expect(box.x + box.width).toBeLessThanOrEqual(width); }
        await text.fill('Kiểm tra bàn phím 🙂'); await text.focus(); await page.keyboard.press('Tab'); await expect(button).toBeFocused();
        expect(await button.evaluate(element => { const style = window.getComputedStyle(element); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2; })).toBe(true);
        await expect(text).toHaveAttribute('aria-describedby', /helper.*limit/); await page.keyboard.press('Shift+Tab'); await expect(text).toBeFocused();
        await page.screenshot({ path: directory + '/' + role.toLowerCase() + '-' + width + '.png', fullPage: true });
        checks.push({ role, width, overflow: false, textareaUsable: true, timestampReadable: true, controls44px: true, keyboardTabFocus: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const major = axe.violations.filter(violation => ['critical', 'serious'].includes(violation.impact)); expect(major).toEqual([]);
      checks.push({ role, axeSerious: 0, axeCritical: 0, otherAxeViolations: axe.violations.map(violation => ({ id: violation.id, impact: violation.impact })) });
      expect(await page.evaluate(() => window.M18_XSS)).toBeUndefined(); await expect(region(page).locator('img,script,iframe')).toHaveCount(0);
      await region(page).getByLabel('Nội dung ghi chú', { exact: true }).fill('Ghi chú được gửi bằng bàn phím.'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
      await expect(region(page).getByRole('status')).toContainText('Đã thêm ghi chú nội bộ.');
    } finally { await context.close(); }
  }
  expect(imageRequests).toEqual([]); expect(dialogs).toEqual([]); expect(exceptions).toEqual([]);
  record('responsive', { checks, literalHtmlScript: true, xssImageRequests: 0, xssDialogs: 0, keyboardSubmission: true, consolePageErrors: exceptions, wcagCertification: false });
});

test('M18 paginated notes, terminal read-only history and out-of-scope STAFF detail', async ({ page }) => {
  await signIn(page, 'staff.iot@mobiflow.local');
  await page.goto('/staff/requests/' + fixtures.requests.pagination.id);
  await expect(region(page).locator('.internal-notes-list>li')).toHaveCount(20);
  await expect(region(page).locator('.internal-note-body').first()).toHaveText('Synthetic M18 page 24');
  await region(page).getByRole('button', { name: 'Xem ghi chú trước đó', exact: true }).click(); await expect(region(page).locator('.internal-notes-list>li')).toHaveCount(25);
  await expect(region(page).getByRole('button', { name: 'Xem ghi chú trước đó', exact: true })).toHaveCount(0);
  for (const name of ['closed', 'canceled']) {
    await page.goto('/staff/requests/' + fixtures.requests[name].id); await expect(region(page).locator('.internal-note-body')).toHaveCount(1);
    await expect(region(page).getByLabel('Nội dung ghi chú', { exact: true })).toHaveCount(0); await expect(region(page)).toContainText('Ghi chú nội bộ chỉ có thể xem.');
  }
  await page.goto('/staff/requests/' + fixtures.requests.foreign.id); await expect(page.getByRole('alert').filter({ hasText: 'không có quyền truy cập' })).toBeVisible(); await expect(region(page)).toHaveCount(0);
  record('pagination-terminal', { pages: [20, 25], ordering: 'newest first', closedReadOnly: true, canceledReadOnly: true, foreignStaffUiAbsent: true });
});
