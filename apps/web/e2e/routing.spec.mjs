import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
/* global document,window */
const directory = 'artifacts/m21/browser-runs/' + process.env.M21_BROWSER_RUN_ID;
const f = JSON.parse(readFileSync(directory + '/fixtures.json', 'utf8'));
const record = (name, values) => writeFileSync(directory + '/' + name + '.json', JSON.stringify({ runId: f.runId, result: 'PASS', ...values }, null, 2) + '\n');
async function signIn(page, role) {
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill({ manager: 'manager', user: 'user', staff: 'staff.iot' }[role] + '@mobiflow.local'); await page.getByLabel('Mật khẩu', { exact: true }).fill('MobiFlowDemo!2026');
  const response = page.waitForResponse(r => r.url().endsWith('/api/v1/auth/login') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); expect((await response).status()).toBe(200); await expect(page).toHaveURL(/\/dashboard$/);
}
async function api(request, role, path, body, method = body === undefined ? 'GET' : 'POST') {
  const result = await request.fetch('http://localhost:33301/api/v1' + path, { method, headers: { Origin: 'http://localhost:33300', 'Content-Type': 'application/json', Authorization: 'Bearer ' + f.tokens[role] }, ...(body === undefined ? {} : { data: body }) });
  expect(result.ok(), await result.text()).toBeTruthy(); return result.json();
}
const detail = async (request, id) => (await api(request, 'manager', '/requests/' + id)).data;
const commandBody = rule => ({ expectedRevision: rule.currentRevision, expectedRuleVersion: rule.version });
const definition = rule => ({ name: rule.current.name, ...(rule.current.description ? { description: rule.current.description } : {}), priority: rule.current.priority, target: rule.current.target, conditions: rule.current.conditions });
const card = page => page.getByRole('region', { name: 'Gợi ý định tuyến', exact: true });
const draft = page => page.locator('#manual-request-plan');
const reassignment = page => page.getByRole('group', { name: 'Phân công lại', exact: true });
async function evaluate(page, result = 'MATCH') { await card(page).getByRole('button', { name: /^(Đánh giá định tuyến|Đánh giá lại)$/ }).click(); await expect(card(page).getByRole('status').filter({ hasText: new RegExp('^' + result + ' ·') })).toBeVisible(); }
async function assertLiteral(page) { expect(await page.evaluate(() => window.M21_XSS)).toBeUndefined(); await expect(page.locator('img[src*="m21-xss-image"]')).toHaveCount(0); }
async function axe(page, surface, width) {
  const result = await new AxeBuilder({ page }).analyze(), serious = result.violations.filter(v => ['serious','critical'].includes(v.impact)); expect(serious.map(v => v.id)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); expect(overflow).toBe(false);
  await page.screenshot({ path: directory + '/' + surface + '-' + width + '.png', fullPage: true });
  return { surface, width, serious: 0, critical: 0, allViolations: result.violations.map(v => ({ id: v.id, impact: v.impact })), overflow };
}

test('M21 manager creates/revises/activates/deactivates/archives typed rules and immutable history', async ({ page }) => {
  const xssRequests = []; page.on('request', r => { if (r.url().includes('/m21-xss-image')) xssRequests.push(r.url()); });
  await signIn(page, 'manager'); await page.goto('/manager/routing-rules'); await page.getByRole('button', { name: 'Tạo quy tắc', exact: true }).click();
  await expect(page.getByLabel('Tên quy tắc', { exact: true })).toBeFocused(); await page.getByLabel('Tên quy tắc', { exact: true }).fill(f.literalName); await page.getByLabel('Mô tả quy tắc').fill(f.literal + '\n' + f.longToken); await page.getByLabel('Ưu tiên quy tắc').fill('4'); await page.getByLabel('Nhóm gợi ý').selectOption(f.teamId);
  await page.getByLabel('Toán tử 1').selectOption('IN'); await page.getByLabel('Giá trị 1').selectOption(['HIGH','URGENT']);
  await page.getByRole('button', { name: 'Thêm điều kiện', exact: true }).click(); await page.getByLabel('Trường 2').selectOption('category'); await page.getByLabel('Giá trị 2').selectOption('NETWORK');
  await page.getByRole('button', { name: 'Lưu quy tắc', exact: true }).click(); await expect(page.locator('.routing-detail')).toContainText('Chưa hoạt động'); await expect(page.locator('.routing-detail')).toContainText(f.literal);
  await page.getByRole('button', { name: 'Kích hoạt', exact: true }).click(); await expect(page.getByRole('button', { name: 'Ngừng hoạt động', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Ngừng hoạt động', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo phiên bản mới', exact: true }).click(); await page.getByLabel('Tên quy tắc', { exact: true }).fill('M21 browser revision2'); await page.getByRole('button', { name: 'Lưu phiên bản quy tắc', exact: true }).click();
  await page.getByRole('button', { name: 'Xem lịch sử phiên bản', exact: true }).click(); const history = page.getByRole('region', { name: 'Lịch sử phiên bản quy tắc' }); await expect(history).toContainText(f.literalName); await expect(history).toContainText('M21 browser revision2');
  await page.getByRole('button', { name: 'Lưu trữ quy tắc', exact: true }).click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Xác nhận lưu trữ' })).toBeFocused(); await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Lưu trữ quy tắc', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Lưu trữ quy tắc', exact: true }).click(); await dialog.getByRole('button', { name: 'Xác nhận lưu trữ' }).click(); await expect(page.locator('.routing-detail')).toContainText('Đã lưu trữ');
  await page.getByLabel('Tìm quy tắc', { exact: true }).fill('M21 browser revision2'); await page.getByLabel('Trạng thái quy tắc').selectOption('ARCHIVED'); await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click(); await expect(page.locator('.routing-list article')).toHaveCount(1);
  await assertLiteral(page); expect(xssRequests).toEqual([]);
  record('management', { create: true, typedEQIN: true, revise: true, activateDeactivate: true, immutableHistory: true, archiveConfirmKeyboardFocus: true, searchStatus: true, literalNameDescription: true });
});

test('M21 prefill is local, human overrides and submits protected assignment/reassignment; M20 draft preserved', async ({ page, request }) => {
  await signIn(page, 'manager'); const id = f.requests.draft.id; await page.goto('/manager/requests/' + id); const form = draft(page); await evaluate(page);
  const before = await detail(request, id); await card(page).getByRole('button', { name: 'Áp dụng vào biểu mẫu', exact: true }).click(); await expect(form.getByRole('combobox', { name: 'Nhóm xử lý', exact: true })).toHaveValue(f.teamId); await expect(form.getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true })).toHaveValue(''); await expect(form.getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true })).toBeFocused();
  const after = await detail(request, id); expect(after).toEqual(before); expect(after.currentAssignee).toBeNull(); expect(after.sla).toBeNull();
  await form.getByRole('combobox', { name: 'Nhóm xử lý', exact: true }).selectOption(f.otherTeamId); await form.getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true }).selectOption(f.otherTeamId + '|' + f.otherTeamStaffId);
  await form.getByRole('combobox', { name: 'Chọn mẫu', exact: true }).selectOption(f.template.id); await form.getByRole('button', { name: 'Áp dụng vào bản nháp', exact: true }).click(); await form.getByRole('textbox', { name: 'Nội dung bước 1', exact: true }).fill('Human edited M20 checkpoint');
  await form.getByLabel('Lý do phương án / lý do để trống checklist', { exact: true }).fill('Human selected a different team after reviewing the routing suggestion.'); await form.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click(); await expect(page.getByRole('button', { name: 'Gửi duyệt phương án', exact: true })).toBeVisible();
  let saved = await detail(request, id); expect(saved.currentAssignee).toBeNull(); expect(saved.manualDraft.teamId).toBe(f.otherTeamId); expect(saved.manualDraftSourceTemplateRevisionId).toBe(f.template.current.id);
  await page.getByRole('button', { name: 'Gửi duyệt phương án', exact: true }).click(); await page.getByRole('button', { name: 'Duyệt và phân công', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Checklist đã duyệt', exact: true })).toBeVisible(); saved = await detail(request, id); expect(saved.teamId).toBe(f.otherTeamId); expect(saved.status).toBe('ASSIGNED'); expect(saved.checklist.items[0].text).toBe('Human edited M20 checkpoint');
  await page.goto('/manager/requests/' + f.requests.reassign.id); await evaluate(page); const prior = await detail(request, f.requests.reassign.id); await card(page).getByRole('button', { name: 'Áp dụng vào biểu mẫu', exact: true }).click(); expect((await detail(request, prior.id)).version).toBe(prior.version); expect((await detail(request, prior.id)).currentAssignee.id).toBe(prior.currentAssignee.id);
  await reassignment(page).getByRole('combobox', { name: 'Nhân sự nhận bàn giao', exact: true }).selectOption(f.teamId + '|' + f.otherStaffId); await reassignment(page).getByLabel('Lý do bàn giao').fill('Explicit human confirmed routing after local prefill'); await reassignment(page).getByRole('button', { name: 'Phân công lại', exact: true }).click(); await expect(page.getByText('Đã lưu thay đổi.', { exact: true })).toBeVisible(); const changed = await detail(request, prior.id); expect(changed.currentAssignee.id).toBe(f.otherStaffId); expect(changed.version).toBe(prior.version + 1); expect(changed.sla.startedAt).toBe(prior.sla.startedAt); expect(changed.sla.dueAt).toBe(prior.sla.dueAt);
  await signIn(page, 'user'); let routingReads = 0; page.on('request', r => { if (r.url().includes('/routing')) routingReads++; }); await page.goto('/user/requests/' + id); await expect(page.getByRole('heading', { name: 'Nội dung yêu cầu', exact: true })).toBeVisible(); await expect(card(page)).toHaveCount(0); await expect(page.getByRole('link', { name: 'Quy tắc định tuyến', exact: true })).toHaveCount(0); expect(routingReads).toBe(0);
  for (const path of ['/requests/' + id, '/requests/' + id + '/history']) expect(JSON.stringify(await api(request, 'user', path))).not.toMatch(/ruleRevisions|routingRule|evaluatedRevisions/);
  await page.goto('/manager/routing-rules'); await expect(page.getByRole('heading', { name: '403 · Không có quyền truy cập', exact: true })).toBeVisible(); await assertLiteral(page);
  record('human', { localPrefillNoWrite: true, noStaffAutoSelect: true, focusStaff: true, humanOverride: true, explicitProtectedAssignment: true, explicitReassign: true, SLAClockPreserved: true, M20TemplateDraft: true, userNoMetadata: true });
});

test('M21 conflict/no-match/errors/manual fallback and stale rule/request safety', async ({ page, request }) => {
  await signIn(page, 'manager'); const id = f.requests.stale.id; await page.goto('/manager/requests/' + id); await evaluate(page);
  let rule = (await api(request, 'manager', '/routing-rules/' + f.rules.medium.id)).data;
  rule = (await api(request, 'manager', '/routing-rules/' + rule.id + '/revisions', { ...definition(rule), name: 'M21 refreshed revision', ...commandBody(rule) })).data;
  await card(page).getByRole('button', { name: 'Áp dụng vào biểu mẫu', exact: true }).click(); await expect(card(page)).toContainText('Quy tắc hoặc nhóm đã thay đổi'); await expect(draft(page).getByRole('combobox', { name: 'Nhóm xử lý', exact: true })).toHaveValue('');
  await card(page).getByRole('button', { name: 'Áp dụng vào biểu mẫu', exact: true }).click(); await expect(draft(page).getByRole('combobox', { name: 'Nhóm xử lý', exact: true })).toHaveValue(f.teamId);
  await draft(page).getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true }).selectOption(f.teamId + '|' + f.staffId); await draft(page).getByLabel('Lý do phương án / lý do để trống checklist', { exact: true }).fill('Stale explicit submission');
  await api(request, 'user', '/requests/' + id + '/messages', { expectedVersion: f.requests.stale.version, body: 'Concurrent legitimate request change' }); await draft(page).getByRole('button', { name: 'Lưu bản nháp', exact: true }).click(); await expect(page.getByText('Hãy tải lại dữ liệu trước khi thực hiện thao tác tiếp.', { exact: true })).toBeVisible(); const unchanged = await detail(request, id); expect(unchanged.currentAssignee).toBeNull(); expect(unchanged.manualDraft).toBeNull(); expect(unchanged.version).toBe(f.requests.stale.version + 1);
  const conflict = (await api(request, 'manager', '/routing-rules', { ...definition(rule), name: 'M21 conflicting team', target: { type: 'TEAM', id: f.otherTeamId } })).data;
  const conflicting = (await api(request, 'manager', '/routing-rules/' + conflict.id + '/activate', commandBody(conflict))).data;
  const statesId = f.requests.states.id; await page.goto('/manager/requests/' + statesId); await evaluate(page, 'CONFLICT'); await expect(card(page).getByRole('button', { name: 'Áp dụng vào biểu mẫu' })).toHaveCount(0); await expect(draft(page).getByRole('combobox', { name: 'Nhóm xử lý', exact: true })).toHaveValue(''); expect((await detail(request, statesId)).currentAssignee).toBeNull();
  await api(request, 'manager', '/routing-rules/' + conflicting.id + '/deactivate', commandBody(conflicting));
  rule = (await api(request, 'manager', '/routing-rules/' + rule.id + '/deactivate', commandBody(rule))).data;
  await evaluate(page, 'NO_MATCH'); await expect(draft(page).getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true })).toBeEnabled();
  const route = '**/api/v1/requests/' + statesId + '/routing/evaluate'; await page.route(route, async handler => { await delay(350); await handler.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'SQL/Prisma details must be hidden' }, requestId: statesId }) }); });
  await card(page).getByRole('button', { name: 'Đánh giá lại', exact: true }).click(); await expect(card(page).getByText('Đang kiểm tra quy tắc và nhóm hiện tại…', { exact: true })).toBeVisible(); await expect(draft(page).getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true })).toBeEnabled(); await expect(card(page).getByRole('alert')).toBeVisible(); await expect(page.getByText('SQL/Prisma details must be hidden', { exact: false })).toHaveCount(0); await draft(page).getByLabel('Lý do phương án / lý do để trống checklist', { exact: true }).fill('Manual workflow remains available during routing failure');
  await page.unroute(route); await card(page).getByRole('button', { name: 'Thử lại gợi ý', exact: true }).click(); await expect(card(page)).toContainText('NO_MATCH');
  await api(request, 'manager', '/routing-rules/' + rule.id + '/activate', commandBody(rule)); await evaluate(page);
  await api(request, 'user', '/requests/' + statesId + '/messages', { expectedVersion: f.requests.states.version, body: 'Changed before apply' }); await card(page).getByRole('button', { name: 'Áp dụng vào biểu mẫu', exact: true }).click(); await expect(card(page)).toContainText('Yêu cầu đã thay đổi'); await expect(draft(page).getByRole('combobox', { name: 'Nhóm xử lý', exact: true })).toHaveValue('');
  record('states', { conflictNoPrefill: true, noMatchManual: true, failureManual: true, loading: true, retry: true, staleRuleRefusesOldPrefill: true, staleRequestApply: true, staleProtectedSubmit409: true, failuresAreTransportFixtures: true });
});

test('M21 production management and assignment at four widths pass Axe, keyboard, focus and XSS', async ({ page }) => {
  const consoleErrors = [], xssRequests = []; page.on('pageerror', e => consoleErrors.push(e.message)); page.on('request', r => { if (r.url().includes('/m21-xss-image')) xssRequests.push(r.url()); });
  await signIn(page, 'manager'); await page.goto('/manager/routing-rules'); await page.getByRole('button', { name: 'Tạo quy tắc', exact: true }).click(); await page.getByLabel('Tên quy tắc', { exact: true }).fill(f.literalName); await page.getByLabel('Mô tả quy tắc').fill(f.longToken); await page.getByLabel('Nhóm gợi ý').selectOption(f.teamId);
  const scans = []; for (const width of [360,768,1440,1920]) { await page.setViewportSize({ width, height: 1000 }); scans.push(await axe(page, 'rule-management-editor', width)); }
  const field = page.getByRole('combobox', { name: 'Trường 1', exact: true }); await field.focus(); await field.press('Tab'); await expect(page.getByRole('combobox', { name: 'Toán tử 1', exact: true })).toBeFocused();
  await page.goto('/manager/requests/' + f.requests.responsive.id); await evaluate(page); await expect(card(page)).toContainText(f.literalName); await assertLiteral(page);
  for (const width of [360,768,1440,1920]) { await page.setViewportSize({ width, height: 1000 }); scans.push(await axe(page, 'request-reassignment', width)); }
  await reassignment(page).getByRole('combobox', { name: 'Nhóm xử lý', exact: true }).focus(); await page.keyboard.press('Tab'); await expect(reassignment(page).getByRole('combobox', { name: 'Nhân sự nhận bàn giao', exact: true })).toBeFocused();
  await page.goto('/manager/requests/' + f.requests.states.id); await evaluate(page);
  for (const width of [360,768,1440,1920]) { await page.setViewportSize({ width, height: 1000 }); scans.push(await axe(page, 'request-manual-draft', width)); }
  await assertLiteral(page); expect(consoleErrors).toEqual([]); expect(xssRequests).toEqual([]);
  record('responsive', { scans, consoleErrors, xssRequests, keyboardOrder: true, literalTarget: true, serious: 0, critical: 0 });
});
