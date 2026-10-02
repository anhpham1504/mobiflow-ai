import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
/* global document,window */
const directory = 'artifacts/m20/browser-runs/' + process.env.M20_BROWSER_RUN_ID;
const f = JSON.parse(readFileSync(directory + '/fixtures.json', 'utf8'));
const record = (name, values) => writeFileSync(directory + '/' + name + '.json', JSON.stringify({ runId: f.runId, result: 'PASS', ...values }, null, 2) + '\n');
const authRateWaitsSeconds = [];
async function signIn(page, role) {
  const email = { manager: 'manager', staff: 'staff.iot', user: 'user' }[role] + '@mobiflow.local';
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Mật khẩu', { exact: true }).fill('MobiFlowDemo!2026');
    const response = page.waitForResponse(r => r.url().endsWith('/api/v1/auth/login') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); const result = await response;
    if (result.status() === 429 && attempt === 0) { const seconds = Number(result.headers()['retry-after']); expect(seconds).toBeGreaterThanOrEqual(1); expect(seconds).toBeLessThanOrEqual(60); authRateWaitsSeconds.push(seconds); await delay(seconds * 1000); continue; }
    expect(result.status()).toBe(200); await expect(page).toHaveURL(/\/dashboard$/); return;
  }
  throw new Error('Bounded authentication retry exhausted');
}
async function api(request, role, path, body, method = body === undefined ? 'GET' : 'POST') {
  const result = await request.fetch('http://localhost:33201/api/v1' + path, { method, headers: { Origin: 'http://localhost:33200', 'Content-Type': 'application/json', Authorization: 'Bearer ' + f.tokens[role] }, ...(body === undefined ? {} : { data: body }) });
  expect(result.ok()).toBeTruthy(); return result.json();
}
const composer = page => page.getByRole('group', { name: 'Gửi tin nhắn', exact: true });
const draft = page => page.locator('#manual-request-plan');
async function preview(container, template) { await container.getByRole('combobox', { name: 'Chọn mẫu', exact: true }).selectOption(template.id); await expect(container.locator('.template-preview')).toContainText(template.name); }
async function apply(container, confirmation = false) { await container.getByRole('button', { name: 'Áp dụng vào bản nháp', exact: true }).click(); if (confirmation) await container.getByRole('button', { name: 'Xác nhận thay thế bản nháp', exact: true }).click(); await expect(container.getByRole('button', { name: 'Áp dụng vào bản nháp', exact: true })).toBeEnabled(); await expect(container.getByRole('status').filter({ hasText: 'Đã chép vào bản nháp.' })).toBeVisible(); }
async function assertLiteral(page) { expect(await page.evaluate(() => window.M20_XSS)).toBeUndefined(); await expect(page.locator('img[src*="m20-xss-image"]')).toHaveCount(0); }
async function axe(page, surface, width) {
  const result = await new AxeBuilder({ page }).analyze(), serious = result.violations.filter(v => ['serious','critical'].includes(v.impact)); expect(serious.map(v => v.id)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); expect(overflow).toBe(false);
  await page.screenshot({ path: directory + '/' + surface + '-' + width + '.png', fullPage: true });
  return { surface, width, serious: 0, critical: 0, allViolations: result.violations.map(v => ({ id: v.id, impact: v.impact })), overflow };
}

test('M20 manager creates both types, revises, archives and reads escaped immutable history', async ({ page, request }) => {
  const xssRequests = []; page.on('request', r => { if (r.url().includes('/m20-xss-image')) xssRequests.push(r.url()); });
  await signIn(page, 'manager'); await page.goto('/manager/templates'); await expect(page.getByRole('heading', { name: 'Mẫu phản hồi và checklist', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo mẫu', exact: true }).click(); let form = page.getByRole('group', { name: 'Tạo mẫu', exact: true });
  const name = 'M20 browser phản hồi ' + f.runId.slice(0, 8); await form.getByRole('textbox', { name: 'Tên mẫu', exact: true }).fill(name); await form.getByRole('textbox', { name: 'Mô tả (không bắt buộc)', exact: true }).fill(f.literal); await form.getByRole('textbox', { name: 'Nội dung phản hồi', exact: true }).fill(f.literal);
  const creation = page.waitForResponse(r => r.url().endsWith('/api/v1/templates') && r.request().method() === 'POST'); await form.getByRole('button', { name: 'Lưu mẫu', exact: true }).click(); const first = (await (await creation).json()).data;
  await expect(page.getByRole('heading', { name: 'Chi tiết mẫu', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Tạo phiên bản mới', exact: true }).click();
  form = page.getByRole('group', { name: 'Tạo phiên bản mới', exact: true }); await form.getByRole('textbox', { name: 'Nội dung phản hồi', exact: true }).fill('Nội dung phiên bản 2 do quản lý viết.'); await form.getByRole('button', { name: 'Lưu phiên bản mới', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Đã lưu mẫu phiên bản 2.' })).toBeVisible();
  await page.getByRole('button', { name: 'Xem lịch sử phiên bản', exact: true }).click(); await expect(page.locator('.template-history article')).toHaveCount(2); await expect(page.locator('.template-history')).toContainText(f.literal);
  await page.getByRole('button', { name: 'Lưu trữ mẫu', exact: true }).click(); await expect(page.getByRole('button', { name: 'Xác nhận lưu trữ', exact: true })).toBeFocused(); await page.getByRole('button', { name: 'Giữ mẫu hoạt động', exact: true }).click(); await expect(page.getByRole('button', { name: 'Lưu trữ mẫu', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Lưu trữ mẫu', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận lưu trữ', exact: true }).click(); await expect(page.getByText('Đã lưu trữ — chỉ tra cứu lịch sử', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption('ARCHIVED'); await expect(page.locator('.template-list')).toContainText(name);
  const older = (await api(request, 'manager', '/templates/' + first.id + '/revisions')).data; expect(older.find(r => r.revision === 1).content.body).toBe(f.literal);
  await page.getByRole('button', { name: 'Tạo mẫu', exact: true }).click(); form = page.getByRole('group', { name: 'Tạo mẫu', exact: true }); await form.getByRole('combobox', { name: 'Loại mẫu', exact: true }).selectOption('CHECKLIST'); await form.getByRole('textbox', { name: 'Tên mẫu', exact: true }).fill('M20 browser checklist'); await form.getByRole('textbox', { name: 'Nội dung bước 1', exact: true }).fill(f.literal); await form.getByRole('button', { name: 'Thêm bước', exact: true }).click(); await form.getByRole('textbox', { name: 'Nội dung bước 2', exact: true }).fill('Bước kiểm chứng do quản lý soạn.'); await form.getByRole('checkbox', { name: 'Bắt buộc bước 2', exact: true }).uncheck(); await form.getByRole('button', { name: 'Lưu mẫu', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Đã lưu mẫu phiên bản 1.' })).toBeVisible();
  await assertLiteral(page); expect(xssRequests).toEqual([]); await axe(page, 'management-create-history', 1440);
  record('management', { createResponse: true, createChecklist: true, revise: true, archive: true, archiveCancelFocus: true, historyPreserved: true, xssEscaped: true, xssNetworkRequests: 0 });
});

test('M20 STAFF previews/explicitly replaces/edits/sends; archive race retains manual draft and USER sees final text only', async ({ page, request }) => {
  await signIn(page, 'staff'); const id = f.requests.response.id; await page.goto('/staff/requests/' + id); const form = composer(page), body = form.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true });
  await body.fill('Bản nháp nhân viên đang viết.'); const before = (await api(request, 'staff', '/requests/' + id)).data;
  await preview(form, f.templates.response); await expect(body).toHaveValue('Bản nháp nhân viên đang viết.'); await form.getByRole('button', { name: 'Áp dụng vào bản nháp', exact: true }).click(); await expect(form.getByRole('button', { name: 'Xác nhận thay thế bản nháp', exact: true })).toBeFocused(); await expect(body).toHaveValue('Bản nháp nhân viên đang viết.'); await form.getByRole('button', { name: 'Giữ bản nháp hiện tại', exact: true }).click(); await expect(form.getByRole('button', { name: 'Áp dụng vào bản nháp', exact: true })).toBeFocused();
  const applyRoute = '**/api/v1/templates/' + f.templates.response.id; await page.route(applyRoute, async handler => { await delay(400); await handler.continue(); }); const applying = apply(form, true); await expect(body).toBeDisabled(); await applying; await page.unroute(applyRoute); await expect(body).toBeEnabled(); await expect(body).toHaveValue(f.templates.response.current.content.body);
  const final = 'Nội dung cuối do nhân viên chỉnh sửa 🙂 <script>literal</script>'; await body.fill(final);
  const unchanged = (await api(request, 'staff', '/requests/' + id)).data; expect(unchanged.version).toBe(before.version); expect(unchanged.status).toBe(before.status);
  await form.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click(); await expect(page.locator('.timeline')).toContainText(final); await expect(body).toHaveValue(''); const sent = (await api(request, 'staff', '/requests/' + id)).data; expect(sent.version).toBe(before.version + 1);
  await preview(form, f.templates.race); await apply(form); await body.fill('Bản nháp đã chỉnh sửa được giữ sau lưu trữ.');
  await api(request, 'manager', '/templates/' + f.templates.race.id + '/archive', { expectedRevision: 1 }); await form.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Mẫu đã thay đổi hoặc lưu trữ' })).toBeVisible(); await expect(body).toHaveValue('Bản nháp đã chỉnh sửa được giữ sau lưu trữ.');
  expect((await api(request, 'staff', '/requests/' + id)).data.version).toBe(sent.version); await form.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click(); await expect(page.locator('.timeline')).toContainText('Bản nháp đã chỉnh sửa được giữ sau lưu trữ.');
  await signIn(page, 'user'); let templateReads = 0; page.on('request', r => { if (r.url().includes('/api/v1/templates')) templateReads++; }); await page.goto('/user/requests/' + id); await expect(page.locator('.timeline')).toContainText(final); await expect(page.locator('.template-selector')).toHaveCount(0); await expect(page.getByRole('link', { name: 'Mẫu phản hồi & checklist', exact: true })).toHaveCount(0); expect(templateReads).toBe(0);
  const userDetail = await api(request, 'user', '/requests/' + id), userHistory = await api(request, 'user', '/requests/' + id + '/history'); expect(JSON.stringify([userDetail, userHistory])).not.toContain(f.templates.response.current.id); expect(JSON.stringify([userDetail, userHistory])).not.toContain('sourceTemplateRevisionId'); await assertLiteral(page);
  const denied = await request.get('http://localhost:33201/api/v1/templates', { headers: { Authorization: 'Bearer ' + f.tokens.user } }); expect(denied.status()).toBe(403); await page.goto('/manager/templates'); await expect(page.getByRole('heading', { name: '403 · Không có quyền truy cập', exact: true })).toBeVisible();
  record('response', { noAutoSend: true, editable: true, overwriteCancelAndConfirm: true, pendingApplyLocksDraft: true, confirmationKeyboardFocus: true, explicitHumanSend: true, archiveRaceManualFallback: true, userNoMetadataOrLibraryRequests: true, directUser403: true });
});

test('M20 MANAGER checklist stays local, preserves required/order edits, then existing save/submit/approval activates it', async ({ page, request }) => {
  await signIn(page, 'manager'); const id = f.requests.checklist.id; await page.goto('/manager/requests/' + id); const form = draft(page);
  await form.getByRole('button', { name: 'Thêm bước', exact: true }).click(); await form.getByRole('textbox', { name: 'Nội dung bước 1', exact: true }).fill('Bước trước khi chọn mẫu.'); await preview(form, f.templates.checklist); await expect(form.getByRole('textbox', { name: 'Nội dung bước 1', exact: true })).toHaveValue('Bước trước khi chọn mẫu.'); await apply(form, true);
  await form.getByRole('textbox', { name: 'Nội dung bước 1', exact: true }).fill('Bước đầu do quản lý chỉnh sửa.'); await form.getByRole('checkbox', { name: 'Bắt buộc bước 1', exact: true }).uncheck(); await form.getByRole('textbox', { name: 'Nội dung bước 2', exact: true }).fill(f.literal); await form.getByRole('button', { name: 'Đưa bước 2 lên', exact: true }).click(); await expect(form.getByRole('textbox', { name: 'Nội dung bước 1', exact: true })).toHaveValue(f.literal);
  const local = (await api(request, 'manager', '/requests/' + id)).data; expect(local.version).toBe(f.requests.checklist.version); expect(local.status).toBe('NEW'); expect(local.checklist).toBeUndefined(); expect(local.currentAssignee).toBeNull(); expect(local.sla).toBeNull();
  await form.getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true }).selectOption(f.teamId + '|' + f.staffId); await form.getByRole('textbox', { name: 'Lý do phương án / lý do để trống checklist', exact: true }).fill('Phương án synthetic được quản lý kiểm tra và duyệt.'); await form.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click(); await expect(page.getByRole('button', { name: 'Gửi duyệt phương án', exact: true })).toBeVisible();
  const saved = (await api(request, 'manager', '/requests/' + id)).data; expect(saved.status).toBe('TRIAGED'); expect(saved.checklist).toBeUndefined(); expect(saved.manualDraftSourceTemplateRevisionId).toBe(f.templates.checklist.current.id); expect(saved.manualDraft.actions.map(a => a.text)).toEqual([f.literal, 'Bước đầu do quản lý chỉnh sửa.']);
  await page.getByRole('button', { name: 'Gửi duyệt phương án', exact: true }).click(); await expect(page.getByRole('button', { name: 'Duyệt và phân công', exact: true })).toBeVisible(); expect((await api(request, 'manager', '/requests/' + id)).data.checklist).toBeUndefined();
  await page.getByRole('button', { name: 'Duyệt và phân công', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Checklist đã duyệt', exact: true })).toBeVisible(); const approved = (await api(request, 'manager', '/requests/' + id)).data; expect(approved.status).toBe('ASSIGNED'); expect(approved.checklist.sourceTemplateRevisionId).toBe(f.templates.checklist.current.id); expect(approved.checklist.items.map(i => ({ text: i.text, required: i.required }))).toEqual([{ text: f.literal, required: false }, { text: 'Bước đầu do quản lý chỉnh sửa.', required: false }]);
  await assertLiteral(page);
  // A separate loaded draft retains stale expectedVersion after template selection.
  const staleId = f.requests.stale.id; await page.goto('/manager/requests/' + staleId); const staleForm = draft(page); await preview(staleForm, f.templates.checklist); await apply(staleForm); await staleForm.getByRole('combobox', { name: 'Nhóm / Nhân sự xử lý', exact: true }).selectOption(f.teamId + '|' + f.staffId); await staleForm.getByRole('textbox', { name: 'Lý do phương án / lý do để trống checklist', exact: true }).fill('Synthetic stale draft scenario.');
  await api(request, 'user', '/requests/' + staleId + '/messages', { expectedVersion: f.requests.stale.version, body: 'Concurrent legitimate requester message.' }); await staleForm.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click(); await expect(page.getByText('Hãy tải lại dữ liệu trước khi thực hiện thao tác tiếp.', { exact: true })).toBeVisible(); const conflict = (await api(request, 'manager', '/requests/' + staleId)).data; expect(conflict.version).toBe(f.requests.stale.version + 1); expect(conflict.manualDraft).toBeNull(); expect(conflict.checklist).toBeUndefined();
  record('checklist', { noAutoActivateOrAssign: true, editable: true, requiredAndOrdering: true, explicitSaveSubmitApproval: true, finalHumanChecklist: true, provenance: true, staleVersionAfterSelection: true, literalItemEscaped: true });
});

test('M20 empty/loading/error/retry keeps manual work; three surfaces at 360/768/1440/1920 pass Axe/keyboard/overflow', async ({ page, request }) => {
  await signIn(page, 'staff'); const id = f.requests.states.id; const route = '**/api/v1/templates?type=RESPONSE**'; let mode = 'failure';
  await page.route(route, async handler => { await delay(400); if (mode === 'failure') await handler.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'SQL/Prisma internal fixture must be hidden' }, requestId: id }) }); else if (mode === 'empty') await handler.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], page: { nextCursor: null, hasMore: false }, requestId: id }) }); else await handler.continue(); });
  await page.goto('/staff/requests/' + id); const form = composer(page); await expect(form.getByText('Đang tải mẫu…', { exact: true })).toBeVisible(); await expect(form.getByRole('alert')).toBeVisible(); await form.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true }).fill('Manual draft survives failed library.'); await expect(form.getByRole('button', { name: 'Gửi tin nhắn', exact: true })).toBeEnabled(); await expect(page.getByText('SQL/Prisma internal fixture must be hidden', { exact: false })).toHaveCount(0);
  mode = 'empty'; await form.getByRole('button', { name: 'Thử lại tải mẫu', exact: true }).click(); await expect(form.getByText('Chưa có mẫu phản hồi khả dụng.', { exact: false })).toBeVisible(); await expect(form.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true })).toHaveValue('Manual draft survives failed library.'); mode = 'real'; await form.getByRole('button', { name: 'Tìm mẫu', exact: true }).click(); await expect(form.getByRole('combobox', { name: 'Chọn mẫu', exact: true })).toBeVisible(); await page.unroute(route);
  await preview(form, f.templates.xss); await expect(form.locator('.template-preview')).toContainText(f.longToken); await assertLiteral(page);
  const scans = [], consoleErrors = []; page.on('pageerror', e => consoleErrors.push(e.message));
  for (const width of [360,768,1440,1920]) { await page.setViewportSize({ width, height: 1000 }); scans.push(await axe(page, 'response-composer', width)); }
  const select = form.getByRole('combobox', { name: 'Chọn mẫu', exact: true }); await select.focus(); await expect(select).toBeFocused(); await select.press('Tab'); expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  await signIn(page, 'manager'); await page.goto('/manager/templates'); await page.getByRole('textbox', { name: 'Tìm theo tên hoặc mô tả', exact: true }).fill(f.literalName); await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click(); await expect(page.locator('.template-list')).toContainText(f.literalName); await page.getByRole('button', { name: 'Xem mẫu ' + f.literalName, exact: true }).click(); await expect(page.locator('.template-preview')).toContainText(f.longToken);
  for (const width of [360,768,1440,1920]) { await page.setViewportSize({ width, height: 1000 }); scans.push(await axe(page, 'management', width)); }
  const draftId = f.requests.draftResponsive.id; await page.goto('/manager/requests/' + draftId); await preview(draft(page), f.templates.checklist); await apply(draft(page)); await draft(page).getByRole('textbox', { name: 'Nội dung bước 1', exact: true }).fill('LongChecklistToken'.repeat(28));
  for (const width of [360,768,1440,1920]) { await page.setViewportSize({ width, height: 1000 }); scans.push(await axe(page, 'checklist-draft', width)); }
  await assertLiteral(page); expect(consoleErrors).toEqual([]);
  const requestBefore = (await api(request, 'manager', '/requests/' + draftId)).data; expect(requestBefore.version).toBe(f.requests.draftResponsive.version); expect(requestBefore.checklist).toBeUndefined();
  record('states-responsive', { loading: true, empty: true, errorRetry: true, manualDraftPreserved: true, safeErrors: true, scans, keyboardNativeSelector: true, consoleErrors, xss: true, authRateWaitsSeconds });
});
