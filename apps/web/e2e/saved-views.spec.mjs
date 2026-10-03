import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
/* global document,window */
const directory = 'artifacts/m23/browser-runs/' + process.env.M23_BROWSER_RUN_ID, f = JSON.parse(readFileSync(directory + '/fixtures.json'));
const record = (name, data) => writeFileSync(directory + '/' + name + '.json', JSON.stringify({ runId: f.runId, result: 'PASS', ...data }, null, 2));
async function signIn(page, role) {
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill({ manager: 'manager', staff: 'staff.iot', user: 'user' }[role] + '@mobiflow.local');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('MobiFlowDemo!2026');
  const response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); expect((await response).status()).toBe(200); await expect(page).toHaveURL(/\/dashboard$/);
}
async function api(request, role, path, body, method = body === undefined ? 'GET' : 'POST') {
  const r = await request.fetch('http://localhost:33501/api/v1' + path, { method, headers: { Origin: 'http://localhost:33500', 'Content-Type': 'application/json', Authorization: 'Bearer ' + f.tokens[role] }, ...(body === undefined ? {} : { data: body }) });
  expect(r.ok(), await r.text()).toBeTruthy(); return r.json();
}
const listResponse = page => page.waitForResponse(r => /\/api\/v1\/(staff\/work-queue|manager\/requests|requests\/mine)\?/.test(r.url()) && r.status() === 200);
async function save(page, name) {
  await page.getByRole('button', { name: 'Lưu chế độ xem', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByLabel('Tên chế độ xem', { exact: true })).toBeFocused();
  await page.getByLabel('Tên chế độ xem', { exact: true }).fill(name);
  const response = page.waitForResponse(r => r.url().endsWith('/saved-request-views') && r.request().method() === 'POST');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  const r = await response; expect(r.status()).toBe(201); await expect(page.getByRole('dialog')).not.toBeVisible(); return (await r.json()).data;
}
test('M23 STAFF save/replace/reset/back/forward/stale edit/delete and safe literal text', async ({ page, request }) => {
  await signIn(page, 'staff'); await page.goto('/staff/work-queue?panel=details');
  await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption('IN_PROGRESS');
  let response = listResponse(page); await page.getByRole('button', { name: 'Áp dụng', exact: true }).click(); expect((await (await response).json()).data.every(r => r.status === 'IN_PROGRESS')).toBeTruthy();
  const view = await save(page, f.literal);
  expect(await page.evaluate(() => window.M23_XSS)).toBeUndefined(); await expect(page.locator('.saved-views img')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Ưu tiên', exact: true }).selectOption('HIGH'); await page.getByLabel('Tạo từ (UTC)', { exact: true }).fill('2020-01-01T00:00'); await page.getByLabel('Tạo trước (UTC)', { exact: true }).fill('2030-01-01T00:00');
  response = listResponse(page); await page.getByRole('button', { name: 'Áp dụng', exact: true }).click(); await response;
  await expect(page.getByText('Đã chỉnh sửa — chưa lưu thay đổi.', { exact: true })).toBeVisible();
  expect((await api(request, 'staff', '/saved-request-views/' + view.id)).data.version).toBe(1);
  response = listResponse(page); await page.getByRole('button', { name: 'Trang tiếp theo', exact: true }).click(); await response; expect(new URL(page.url()).searchParams.has('cursor')).toBeTruthy();
  await page.goto(page.url() + '&page=2&sort=obsolete'); await expect(page.getByRole('combobox', { name: 'Chế độ xem đã lưu', exact: true })).toHaveValue(view.id);
  await page.getByRole('searchbox').fill('sentinel-with-no-results');
  response = listResponse(page); await page.getByRole('button', { name: 'Áp dụng chế độ xem', exact: true }).click();
  const applied = await (await response).json(); expect(applied.data.some(r => r.priority === 'MEDIUM')).toBeTruthy(); expect(applied.data.some(r => r.id === f.foreignRequest)).toBeFalsy();
  let params = new URL(page.url()).searchParams; expect(params.get('status')).toBe('IN_PROGRESS'); expect(params.get('panel')).toBe('details');
  for (const key of ['priority', 'from', 'to', 'cursor', 'page', 'sort', 'search']) expect(params.has(key)).toBeFalsy();
  await expect(page.getByRole('combobox', { name: 'Ưu tiên', exact: true })).toHaveValue(''); await expect(page.getByLabel('Tạo từ (UTC)', { exact: true })).toHaveValue(''); await expect(page.getByRole('searchbox')).toHaveValue('');
  expect(applied.data.map(r => r.createdAt)).toEqual([...applied.data.map(r => r.createdAt)].sort().reverse());
  await page.goBack(); await expect(page.getByRole('combobox', { name: 'Ưu tiên', exact: true })).toHaveValue('HIGH'); expect(new URL(page.url()).searchParams.has('cursor')).toBeTruthy();
  await page.goForward(); await expect(page.getByRole('combobox', { name: 'Ưu tiên', exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Cập nhật chế độ xem', exact: true }).click(); await page.getByLabel('Tên chế độ xem', { exact: true }).fill('STAFF renamed');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  let current = (await api(request, 'staff', '/saved-request-views/' + view.id)).data; expect(current.version).toBe(2); expect(current.name).toBe('STAFF renamed');
  await page.getByRole('button', { name: 'Cập nhật chế độ xem', exact: true }).click();
  current = (await api(request, 'staff', '/saved-request-views/' + view.id, { name: 'Other tab', filters: {}, expectedVersion: current.version }, 'PUT')).data;
  await page.getByLabel('Tên chế độ xem', { exact: true }).fill('Must not overwrite'); await page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('đã thay đổi'); expect((await api(request, 'staff', '/saved-request-views/' + view.id)).data.name).toBe('Other tab');
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  const reload = page.waitForResponse(r => r.url().endsWith('/saved-request-views') && r.request().method() === 'GET'); await page.getByRole('button', { name: 'Tải lại chế độ xem', exact: true }).click(); await reload;
  await page.getByRole('button', { name: 'Xóa chế độ xem', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click(); expect((await api(request, 'staff', '/saved-request-views/' + view.id)).data.version).toBe(current.version);
  await page.getByRole('button', { name: 'Xóa chế độ xem', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.getByRole('combobox', { name: 'Chế độ xem đã lưu', exact: true })).toBeFocused();
  const deleted = await request.get('http://localhost:33501/api/v1/saved-request-views/' + view.id, { headers: { Authorization: 'Bearer ' + f.tokens.staff } }); expect(deleted.status()).toBe(404);
  response = listResponse(page); await page.getByRole('combobox', { name: 'Chế độ xem đã lưu', exact: true }).selectOption(f.emptyId); await response;
  params = new URL(page.url()).searchParams; expect(params.get('panel')).toBe('details'); expect(params.has('status')).toBeFalsy();
  record('staff', { realCrud: true, replacementSentinels: ['priority', 'from', 'to', 'cursor', 'page', 'sort', 'pageSearch'], emptyReset: true, backForward: true, currentScope: true, dirtyNoAutosave: true, staleConflict: true, safeXss: true, fixedSort: true, keyboardModalFocus: true });
});
test('M23 MANAGER and USER saved filters use actual own Request lists and private view ownership', async ({ page, request }) => {
  for (const role of ['manager', 'user']) {
    await signIn(page, role); await page.goto('/' + role + '/requests');
    await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption('IN_PROGRESS');
    if (role === 'manager') await page.getByRole('combobox', { name: 'Nhân sự phụ trách', exact: true }).selectOption(f.staffId);
    else await expect(page.getByRole('combobox', { name: 'Nhân sự phụ trách', exact: true })).toHaveCount(0);
    const response = listResponse(page); await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    const rows = (await (await response).json()).data; expect(rows.length).toBeGreaterThan(0); expect(rows.some(r => r.id === f.foreignRequest)).toBeFalsy();
    const view = await save(page, role + ' saved'); expect(view.filters.status).toBe('IN_PROGRESS');
    const denied = await request.get('http://localhost:33501/api/v1/saved-request-views/' + f.staffViewId, { headers: { Authorization: 'Bearer ' + f.tokens[role] } }); expect(denied.status()).toBe(404);
  }
  record('roles', { managerDirectoryFilter: true, userOwnFilters: true, noCrossAccountViews: true, actualScopedResults: true });
});
test('M23 three-role Request filters and dialogs responsive/Axe at four widths', async ({ page }) => {
  const scans = [], errors = [], consoleErrors = [], networkErrors = []; let blockedExternalAv = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() !== 'error') return; const text = message.text(); if (text.startsWith("Loading the script 'http://me.kis.v2.scr.kaspersky-labs.com/") && text.includes('Content Security Policy') && text.includes('action has been blocked')) blockedExternalAv++; else consoleErrors.push(text); });
  page.on('response', response => { if (response.status() >= 400) networkErrors.push(response.status()); });
  page.on('requestfailed', request => { const url = new URL(request.url()); if (url.hostname === 'me.kis.v2.scr.kaspersky-labs.com' && url.pathname === '/FD126C42-EBFA-4E12-B309-BB3FDD723AC1/main.js' && request.failure()?.errorText === 'csp') blockedExternalAv++; else if (request.failure()?.errorText !== 'net::ERR_ABORTED') networkErrors.push(request.failure()?.errorText); });
  for (const role of ['staff', 'manager', 'user']) {
    await signIn(page, role);
    for (const width of [360, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(role === 'staff' ? '/staff/work-queue' : '/' + role + '/requests');
      await expect(page.getByRole('combobox', { name: 'Chế độ xem đã lưu', exact: true })).toBeEnabled(); await expect(page.getByRole('status', { name: 'Đang tải yêu cầu', exact: true })).toHaveCount(0);
      for (const surface of ['list', 'dialog']) {
        if (surface === 'dialog') { await page.getByRole('button', { name: 'Lưu chế độ xem', exact: true }).focus(); await page.keyboard.press('Enter'); await expect(page.getByLabel('Tên chế độ xem', { exact: true })).toBeFocused(); }
        const result = await new AxeBuilder({ page }).analyze(); expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); expect(overflow).toBeFalsy();
        await page.screenshot({ path: directory + '/' + role + '-' + surface + '-' + width + '.png', fullPage: true });
        scans.push({ role, surface, width, serious: 0, critical: 0, overflow });
        if (surface === 'dialog') { await page.keyboard.press('Tab'); await expect(page.getByRole('dialog').getByRole('button', { name: 'Lưu', exact: true })).toBeFocused(); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Lưu chế độ xem', exact: true })).toBeFocused(); }
      }
    }
  }
  expect(errors).toEqual([]); expect(consoleErrors).toEqual([]); expect(networkErrors).toEqual([]);
  record('responsive', { scans, applicationPageErrors: errors.length, applicationConsoleErrors: consoleErrors.length, failedNetwork: networkErrors.length, blockedExternalAv, note: 'Exact external AV injections denied by unchanged CSP counted separately; navigation cancellations excluded.' });
});
test('M23 unavailable/loading/error/empty do not disable manual filtering', async ({ page }) => {
  await signIn(page, 'staff'); let release;
  await page.route('**/api/v1/saved-request-views', async route => { await new Promise(resolve => { release = resolve; }); await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Synthetic transport failure' }, requestId: f.runId }) }); });
  await page.goto('/staff/work-queue'); await expect(page.getByText('Đang tải chế độ xem…', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled(); release();
  await expect(page.getByRole('region', { name: 'Chế độ xem đã lưu', exact: true }).getByRole('alert')).toContainText('Bạn vẫn có thể lọc thủ công');
  await page.getByRole('combobox', { name: 'Ưu tiên', exact: true }).selectOption('HIGH'); const response = listResponse(page); await page.getByRole('button', { name: 'Áp dụng', exact: true }).click(); expect((await (await response).json()).data.every(r => r.priority === 'HIGH')).toBeTruthy();
  await page.unroute('**/api/v1/saved-request-views'); await page.getByRole('button', { name: 'Tải lại chế độ xem', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Chế độ xem đã lưu', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Chế độ xem đã lưu', exact: true }).selectOption(f.unavailableId); await expect(page.getByRole('region', { name: 'Chế độ xem đã lưu', exact: true }).getByRole('status')).toContainText('không còn khả dụng');
  await expect(page.getByRole('combobox', { name: 'Ưu tiên', exact: true })).toHaveValue('HIGH');
  await page.getByRole('button', { name: 'Xóa chế độ xem', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.route('**/api/v1/saved-request-views', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], requestId: f.runId }) }));
  await page.getByRole('button', { name: 'Tải lại chế độ xem', exact: true }).click(); await expect(page.getByText('Bạn chưa lưu chế độ xem nào.', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  record('states', { controlledDelay503AndEmptyFixtures: true, actualManualFilter: true, unavailableNoPartialApply: true, ownerDeleteUnavailable: true });
});
