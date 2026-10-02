import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
/* global document,window */
const directory = 'artifacts/m19/browser-runs/' + process.env.M19_BROWSER_RUN_ID;
const fixtures = JSON.parse(readFileSync(directory + '/fixtures.json', 'utf8'));
const region = page => page.getByRole('region', { name: 'Ghi chú nội bộ', exact: true });
const mentionTitle = 'Bạn được nhắc đến trong một ghi chú nội bộ.';
const watchTitle = 'Yêu cầu bạn đang theo dõi có cập nhật mới.';
const noteRoute = id => '**/api/v1/requests/' + id + '/internal-notes';
const record = (name, values) => writeFileSync(directory + '/' + name + '.json', JSON.stringify({ runId: fixtures.runId, result: 'PASS', ...values }, null, 2) + '\n');
const authRateWaitsSeconds = [];
async function signIn(page, email) {
  // Keep the real 5/account/minute guard enabled and honor a bounded Retry-After.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Mật khẩu', { exact: true }).fill('MobiFlowDemo!2026');
    const response = page.waitForResponse(result => result.url().endsWith('/api/v1/auth/login') && result.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); const result = await response;
    if (result.status() === 429 && attempt === 0) {
      const seconds = Number(result.headers()['retry-after']); expect(seconds).toBeGreaterThanOrEqual(1); expect(seconds).toBeLessThanOrEqual(60);
      authRateWaitsSeconds.push(seconds); await delay(seconds * 1000); continue;
    }
    expect(result.status()).toBe(200); await expect(page).toHaveURL(/\/dashboard$/); return;
  }
  throw new Error('Bounded authentication retry exhausted');
}
async function select(page, userId) {
  const input = region(page).getByRole('combobox', { name: 'Nhắc đến', exact: true }); await input.click();
  await region(page).locator('[data-candidate-id="' + userId + '"]').click();
  await expect(region(page).locator('[data-mention-id="' + userId + '"]')).toBeVisible();
  await input.press('Escape');
}
async function send(page, body) {
  await region(page).getByLabel('Nội dung ghi chú', { exact: true }).fill(body);
  await region(page).getByRole('button', { name: 'Thêm ghi chú', exact: true }).click();
  await expect(region(page).locator('.internal-note-body').first()).toHaveText(body);
}
async function operator(request) {
  const result = await request.post('http://localhost:33101/api/v1/auth/login', { data: { email: 'manager@mobiflow.local', password: 'MobiFlowDemo!2026' }, headers: { Origin: 'http://localhost:33100', 'X-CSRF-Protection': '1' } });
  expect(result.status()).toBe(200); return (await result.json()).data.accessToken;
}

test('M19 real mention/watch union, self suppression, read/navigation and USER isolation', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext()));
  const [staff, manager, user] = await Promise.all(contexts.map(context => context.newPage()));
  const exceptions = [], userPayloads = [], privateRequests = [];
  for (const page of [staff, manager, user]) page.on('pageerror', error => exceptions.push(error.message));
  user.on('request', request => { if (/internal-notes|mention-candidates|\/watch(?:\?|$)/.test(request.url())) privateRequests.push(request.url()); });
  user.on('response', async response => { if (response.url().includes('/api/v1/') && response.status() === 200 && response.headers()['content-type']?.includes('json')) userPayloads.push(await response.text().catch(() => '')); });
  try {
    const id = fixtures.requests.collaboration.id;
    await signIn(staff, 'staff.iot@mobiflow.local'); await staff.goto('/staff/requests/' + id);
    await region(staff).getByRole('button', { name: 'Theo dõi', exact: true }).click();
    await expect(region(staff).getByRole('button', { name: 'Đang theo dõi · Bỏ theo dõi', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await signIn(manager, 'manager@mobiflow.local'); await manager.goto('/manager/requests/' + id);
    await select(manager, fixtures.staffId); await send(manager, 'M19 browser private mention union 🙂.');
    await staff.goto('/notifications');
    await expect(staff.getByRole('heading', { name: mentionTitle, exact: true })).toHaveCount(1);
    await expect(staff.getByRole('heading', { name: watchTitle, exact: true })).toHaveCount(0);
    const mentioned = staff.locator('.notification-list>li').filter({ has: staff.getByRole('heading', { name: mentionTitle, exact: true }) });
    await expect(mentioned).not.toContainText('M19 browser private');
    await mentioned.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click(); await expect(mentioned).toContainText('Đã đọc');
    await mentioned.getByRole('link', { name: 'Mở yêu cầu liên quan', exact: true }).click();
    await expect(staff).toHaveURL(new RegExp('/staff/requests/' + id + '$'));
    await expect(region(staff).locator('.internal-note-body').first()).toHaveText('M19 browser private mention union 🙂.');
    await send(manager, '@IoT Specialist literal only M19 private.');
    await staff.goto('/notifications'); await expect(staff.getByRole('heading', { name: watchTitle, exact: true })).toHaveCount(1);
    await staff.goto('/staff/requests/' + id); await send(staff, 'Synthetic self watcher event.');
    await staff.goto('/notifications'); await expect(staff.getByRole('heading', { name: mentionTitle, exact: true })).toHaveCount(1); await expect(staff.getByRole('heading', { name: watchTitle, exact: true })).toHaveCount(1);
    await signIn(user, 'user@mobiflow.local'); await user.goto('/user/requests/' + id); await expect(user.getByRole('heading', { name: 'Nội dung yêu cầu', exact: true })).toBeVisible();
    await expect(region(user)).toHaveCount(0); await expect(user.getByRole('combobox')).toHaveCount(0);
    await user.goto('/notifications'); await user.waitForLoadState('networkidle'); await expect(user.getByRole('heading', { name: mentionTitle, exact: true })).toHaveCount(0); await expect(user.getByRole('heading', { name: watchTitle, exact: true })).toHaveCount(0);
    expect(privateRequests).toEqual([]); expect(userPayloads.join('')).not.toMatch(/M19 browser private|INTERNAL_NOTE|REQUEST_WATCH|mentionedUserIds|watching/); expect(exceptions).toEqual([]);
    record('collaboration', { mentionWatchUnion: 1, mentionPrecedence: true, bodyFreeNotification: true, literalTextWatchOnly: true, selfSuppression: true, readAndNavigation: true, userUiAbsent: true, userPrivateApiRequests: 0, userPayloadCanaryAbsent: true, consolePageErrors: exceptions });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('M19 selector/watch loading, safe retry, empty search, retained selection/draft and bounded submit', async ({ page }) => {
  const id = fixtures.requests.states.id, candidates = '**/api/v1/requests/' + id + '/mention-candidates*', watch = '**/api/v1/requests/' + id + '/watch';
  await signIn(page, 'staff.iot@mobiflow.local');
  let candidateFailure = true, watchFailure = true;
  const unavailable = { status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'SQL/Prisma fixture must be hidden' }, requestId: id }) };
  await page.route(candidates, async route => { await delay(500); if (candidateFailure) { candidateFailure = false; await route.fulfill(unavailable); } else await route.continue(); });
  await page.route(watch, async route => { await delay(600); if (watchFailure) { watchFailure = false; await route.fulfill(unavailable); } else await route.continue(); });
  await page.goto('/staff/requests/' + id);
  await expect(region(page).getByRole('button', { name: 'Đang tải theo dõi…', exact: true })).toBeDisabled();
  await expect(region(page).getByText('Đang tìm người có thể nhắc đến…', { exact: true })).toBeVisible();
  await expect(region(page)).toContainText('Không thể tải người có thể nhắc đến.'); await expect(region(page)).toContainText('Không thể tải trạng thái theo dõi.'); await expect(region(page)).not.toContainText('SQL/Prisma');
  await region(page).getByRole('button', { name: 'Tải lại người nhận', exact: true }).click(); await region(page).getByRole('button', { name: 'Tải lại theo dõi', exact: true }).click();
  await expect(region(page).getByRole('alert')).toHaveCount(0); await page.unroute(candidates); await page.unroute(watch);
  const combo = region(page).getByRole('combobox', { name: 'Nhắc đến', exact: true });
  await combo.fill('no-synthetic-match-01234'); await expect(region(page).getByText('Không có người phù hợp trong phạm vi yêu cầu.', { exact: true })).toBeVisible();
  await combo.fill(''); await expect(region(page).getByRole('option')).toHaveCount(1);
  await combo.press('ArrowUp'); await combo.press('Enter'); await expect(region(page).locator('.mention-chips>li')).toHaveCount(1);
  await combo.press('Escape'); await expect(combo).toHaveAttribute('aria-expanded', 'false');
  await region(page).getByRole('button', { name: 'Bỏ nhắc ' + fixtures.longName, exact: true }).click(); await expect(combo).toBeFocused(); await expect(region(page).locator('.mention-chips>li')).toHaveCount(0);
  await select(page, fixtures.managerId);
  let failPost = true;
  await page.route(noteRoute(id), async route => { if (route.request().method() === 'POST' && failPost) { failPost = false; await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INVALID_MENTION_TARGET', message: 'Synthetic target lost access' }, requestId: id }) }); } else await route.continue(); });
  const textarea = region(page).getByLabel('Nội dung ghi chú', { exact: true }), body = 'Giữ bản nháp và lựa chọn 🙂.';
  await textarea.fill(body); await region(page).getByRole('button', { name: 'Thêm ghi chú', exact: true }).click();
  await expect(region(page).getByRole('alert')).toContainText('Người được nhắc đến không còn hợp lệ'); await expect(textarea).toHaveValue(body); await expect(region(page).locator('.mention-chips>li')).toHaveCount(1); await page.unroute(noteRoute(id));
  let posts = 0;
  await page.route(noteRoute(id), async route => { if (route.request().method() === 'POST') { posts++; await delay(500); } await route.continue(); });
  await region(page).locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(textarea).toBeDisabled(); await expect(combo).toBeDisabled(); await expect(region(page).locator('.internal-note-body').first()).toHaveText(body);
  expect(posts).toBe(1); await expect(textarea).toHaveValue(''); await expect(region(page).locator('.mention-chips>li')).toHaveCount(0);
  await page.unroute(noteRoute(id));
  const watchButton = region(page).getByRole('button', { name: 'Theo dõi', exact: true }); await watchButton.focus(); await page.keyboard.press('Enter');
  await expect(region(page).getByRole('button', { name: 'Đang theo dõi · Bỏ theo dõi', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter'); await expect(watchButton).toHaveAttribute('aria-pressed', 'false');
  record('states', { loading: true, safeCandidateWatchErrors: true, candidateWatchRetry: true, emptySearch: true, keyboardSelectionRemovalEscape: true, draftAndSelectionRetained: true, duplicateSubmitRequests: posts, successfulSubmitClearsSelection: true, keyboardWatchUnwatch: true, transportFixtures: 'Explicit delay/503/400; restored actual API for successful writes.' });
});

test('M19 STAFF/MANAGER notes and notifications at four widths; literal XSS, Axe and focus', async ({ browser }) => {
  const checks = [], exceptions = [], imageRequests = [], dialogs = [];
  for (const role of ['STAFF', 'MANAGER']) {
    const context = await browser.newContext(), page = await context.newPage();
    page.on('pageerror', error => exceptions.push(error.message)); page.on('request', request => { if (request.url().includes('/m19-xss-image')) imageRequests.push(request.url()); }); page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    try {
      await signIn(page, role === 'STAFF' ? 'staff.iot@mobiflow.local' : 'manager@mobiflow.local');
      for (const width of [360, 768, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 }); await page.goto('/' + role.toLowerCase() + '/requests/' + fixtures.requests.long.id);
        await expect(region(page).locator('.internal-note-body').first()).toHaveText(fixtures.literal);
        if (role === 'STAFF') await select(page, fixtures.managerId);
        await region(page).scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        for (const control of await region(page).getByRole('button').all()) { const box = await control.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
        const textarea = region(page).getByLabel('Nội dung ghi chú', { exact: true }); await textarea.fill('Kiểm tra focus.'); await textarea.focus(); await page.keyboard.press('Tab');
        const submit = region(page).getByRole('button', { name: 'Thêm ghi chú', exact: true }); await expect(submit).toBeFocused(); expect(await submit.evaluate(element => { const style = window.getComputedStyle(element); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2; })).toBe(true);
        const combo = region(page).getByRole('combobox'); await combo.focus(); await combo.press('ArrowDown');
        await expect(combo).toHaveAttribute('aria-expanded', 'true');
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze(); expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
        await combo.press('Escape'); await page.screenshot({ path: directory + '/' + role.toLowerCase() + '-notes-' + width + '.png', fullPage: true });
        expect(await page.evaluate(() => window.M19_XSS)).toBeUndefined(); await expect(region(page).locator('img,script,iframe')).toHaveCount(0);
        checks.push({ role, width, surface: 'notes/selector/watch', overflow: false, controls44px: true, visibleFocus: true, axeSerious: 0, axeCritical: 0, otherAxeViolations: axe.violations.map(v => ({ id: v.id, impact: v.impact })) });
        await page.goto('/notifications'); await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible(); await expect(page.locator('.notification-list')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const notificationAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze(); expect(notificationAxe.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
        await page.screenshot({ path: directory + '/' + role.toLowerCase() + '-notifications-' + width + '.png', fullPage: true });
        checks.push({ role, width, surface: 'notifications', overflow: false, axeSerious: 0, axeCritical: 0, otherAxeViolations: notificationAxe.violations.map(v => ({ id: v.id, impact: v.impact })) });
      }
    } finally { await context.close(); }
  }
  expect(exceptions).toEqual([]); expect(imageRequests).toEqual([]); expect(dialogs).toEqual([]);
  record('responsive', { checks, literalNoteAndLongName: true, xssImageRequests: 0, xssDialogs: 0, consolePageErrors: exceptions, wcagCertification: false });
});

test('M19 actual reassignment hides stale notification/navigation and never grants watcher access', async ({ page, request }) => {
  const id = fixtures.requests.scopeLoss.id;
  await signIn(page, 'staff.iot@mobiflow.local'); await page.goto('/staff/requests/' + id); await region(page).getByRole('button', { name: 'Theo dõi', exact: true }).click();
  const token = await operator(request), headers = { Authorization: 'Bearer ' + token, Origin: 'http://localhost:33100', 'X-CSRF-Protection': '1' };
  const note = await request.post('http://localhost:33101/api/v1/requests/' + id + '/internal-notes', { headers, data: { body: 'Scope-loss private canary.', mentionedUserIds: [fixtures.staffId] } }); expect(note.status()).toBe(201);
  await page.goto('/notifications'); const mentioned = page.locator('.notification-list>li').filter({ has: page.getByRole('heading', { name: mentionTitle, exact: true }) });
  const staleLink = mentioned.getByRole('link', { name: 'Mở yêu cầu liên quan', exact: true }).filter({ hasText: 'Mở yêu cầu' });
  await expect(staleLink).toHaveCount(2);
  const detail = await request.get('http://localhost:33101/api/v1/requests/' + id, { headers }); expect(detail.status()).toBe(200);
  const reassigned = await request.post('http://localhost:33101/api/v1/manager/requests/' + id + '/reassign', { headers, data: { expectedVersion: (await detail.json()).data.version, staffId: fixtures.otherStaffId, teamId: fixtures.teamId, reason: 'Synthetic browser scope-loss.' } }); expect(reassigned.status()).toBe(200);
  await page.getByRole('button', { name: 'Tải lại', exact: true }).click(); await expect(page.getByRole('heading', { name: mentionTitle, exact: true })).toHaveCount(1);
  const internal = page.locator('.notification-list>li').filter({ has: page.getByRole('heading', { name: new RegExp('^(' + mentionTitle.replace(/[.]/g, '\\.') + '|' + watchTitle.replace(/[.]/g, '\\.') + ')$') }) });
  await expect(internal.locator('a[href="/staff/requests/' + id + '"]')).toHaveCount(0);
  // The established recipient-owned REQUEST_ASSIGNED notification stays unchanged.
  await expect(page.locator('.notification-list>li').filter({ has: page.getByRole('heading', { name: 'Yêu cầu được phân công', exact: true }) }).locator('a[href="/staff/requests/' + id + '"]')).toHaveCount(1);
  await page.goto('/staff/requests/' + id); await expect(page.getByRole('alert').filter({ hasText: 'không có quyền truy cập' })).toBeVisible(); await expect(region(page)).toHaveCount(0);
  record('scope-loss', { actualReassignment: true, staleNotificationHiddenAfterRefresh: true, staleDeepLinkDenied: true, watcherNeverGrantsAccess: true });
});

test('M19 terminal requests keep own watch control and M18 read-only notes', async ({ page }) => {
  await signIn(page, 'staff.iot@mobiflow.local');
  for (const name of ['closed', 'canceled']) {
    await page.goto('/staff/requests/' + fixtures.requests[name].id); await expect(region(page).locator('.internal-note-body')).toHaveCount(1);
    await expect(region(page).getByLabel('Nội dung ghi chú', { exact: true })).toHaveCount(0); await expect(region(page).getByRole('combobox')).toHaveCount(0);
    await region(page).getByRole('button', { name: 'Theo dõi', exact: true }).click(); await expect(region(page).getByRole('button', { name: 'Đang theo dõi · Bỏ theo dõi', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await region(page).getByRole('button', { name: 'Đang theo dõi · Bỏ theo dõi', exact: true }).click(); await expect(region(page).getByRole('button', { name: 'Theo dõi', exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
  record('terminal', { closedAndCanceled: true, notesReadOnly: true, watchUnwatchAllowed: true, authRateWaitsSeconds, realRateLimitsEnabled: true });
});
