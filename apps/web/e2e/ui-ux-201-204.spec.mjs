/* global document, getComputedStyle */
import { expect } from '@playwright/test';
import { test, login, noOverflow } from './remediation-support.mjs';

const interactionSizes = [[375, 667], [390, 844], [430, 932], [1440, 900]];
const businessWrite = request => new URL(request.url()).pathname.startsWith('/api/v1/') && !new URL(request.url()).pathname.startsWith('/api/v1/auth/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method());

test('UX-201: routing errors link to the field, focus it and preserve the full local draft without POST', async ({ page }) => {
  await login(page, 'MANAGER');
  await page.goto('/manager/routing-rules');
  await page.getByRole('button', { name: 'Tạo quy tắc', exact: true }).click();
  const form = page.locator('form').filter({ has: page.locator('input[name="name"]') });
  await form.locator('input[name="name"]').fill('x'.repeat(121));
  await form.locator('textarea[name="description"]').fill('Bản nháp synthetic — không lưu');
  const target = await form.locator('select[name="target"] option').nth(1).getAttribute('value');
  expect(target).toBeTruthy();
  await form.locator('select[name="target"]').selectOption(target);
  await form.getByRole('button', { name: 'Thêm điều kiện' }).click();
  await form.getByLabel(/^Toán tử 2/).selectOption('IN');
  await form.getByLabel(/^Giá trị 2/).selectOption(['HIGH', 'URGENT']);
  const writes = [];
  page.on('request', request => { if (businessWrite(request)) writes.push(request.url()); });
  for (const [width, height] of interactionSizes) {
    await page.setViewportSize({ width, height });
    await form.getByRole('button', { name: 'Lưu quy tắc', exact: true }).click();
    const name = form.locator('input[name="name"]');
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription(/120 ký tự/);
    await expect(name).toHaveValue('x'.repeat(121));
    await expect(form.locator('select[name="target"]')).toHaveValue(target);
    await expect(form.locator('input[name="priority"]')).toHaveValue('10');
    await expect(form.getByLabel(/^Giá trị 2/)).toHaveValues(['HIGH', 'URGENT']);
    await noOverflow(page);
  }
  expect(writes).toEqual([]);
  await form.getByRole('button', { name: 'Đóng biểu mẫu' }).click();
  await expect(page.getByRole('button', { name: 'Tạo quy tắc', exact: true })).toBeFocused();
});

test('UX-202: invalid date relations retain applied data and draft, link both dates and cause no analytics GET', async ({ page }) => {
  await login(page, 'MANAGER');
  await page.goto('/manager/analytics');
  const period = page.getByTestId('analytics-period');
  await expect(period).toBeVisible();
  const previous = await period.textContent();
  await page.locator('select[name="preset"]').selectOption('custom');
  const from = page.locator('input[name="from"]'), to = page.locator('input[name="to"]');
  await from.fill('2026-10-09'); await to.fill('2026-10-01');
  const reads = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/analytics') reads.push(request.url()); });
  for (const [width, height] of interactionSizes) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await expect(from).toBeFocused();
    for (const input of [from, to]) {
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAccessibleDescription(/Ngày bắt đầu phải trước ngày kết thúc/);
    }
    await expect(from).toHaveValue('2026-10-09'); await expect(to).toHaveValue('2026-10-01');
    expect(await period.textContent()).toBe(previous);
    await expect(page.getByText('Bộ lọc chưa được áp dụng. Kết quả bên dưới vẫn dùng bộ lọc đã áp dụng trước đó.', { exact: true })).toBeVisible();
    await noOverflow(page);
  }
  expect(reads).toEqual([]);
});

for (const role of ['USER', 'STAFF', 'MANAGER']) test(`UX-203: ${role} drawer has valid dialog semantics and preserves keyboard, scroll and close behavior`, async ({ page }) => {
  await login(page, role); await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole('button', { name: 'Mở menu', exact: true }), drawer = page.getByRole('dialog', { name: 'Menu điều hướng', exact: true });
  await trigger.click(); await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(element => element.tagName)).toBe('DIV');
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  const controls = drawer.locator('a,button:not([disabled])');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(controls.first()).toBeFocused();
  expect(await page.evaluate(() => document.body.classList.contains('nav-open') && getComputedStyle(document.body).overflow === 'hidden')).toBe(true);
  await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.classList.contains('nav-open'))).toBe(false);
  await trigger.click(); await page.locator('.drawer-backdrop').click({ position: { x: 385, y: 110 } });
  await expect(drawer).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await drawer.locator('a[href="/notifications"]').click();
  await page.waitForURL('**/notifications'); await expect(drawer).toHaveCount(0);
  await noOverflow(page);
});

for (const [role, email, id, status, text] of [
  ['STAFF', 'staff.support@mobiflow.local', '60000000-0000-4000-8000-000000000004', 'WAITING_USER', /chờ người yêu cầu bổ sung thông tin/],
  ['STAFF', 'staff.billing@mobiflow.local', '60000000-0000-4000-8000-000000000002', 'RESOLVED', /chờ người yêu cầu xác nhận kết quả/],
  ['MANAGER', 'manager@mobiflow.local', '60000000-0000-4000-8000-000000000002', 'RESOLVED', /chờ người yêu cầu xác nhận kết quả/],
]) test(`UX-204: real ${role} ${status} record explains the wait and adds no business command`, async ({ page }) => {
  await login(page, role, email);
  const writes = []; page.on('request', request => { if (businessWrite(request)) writes.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  const detail = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/requests/' + id && response.status() === 200);
  await page.goto('/' + role.toLowerCase() + '/requests/' + id);
  expect((await (await detail).json()).data.status).toBe(status);
  const actions = page.getByRole('region', { name: 'Thao tác', exact: true });
  await expect(actions.getByRole('heading', { name: 'Thao tác', level: 2 })).toBeVisible();
  await page.getByRole('link', { name: 'Đi tới thao tác', exact: true }).click();
  await expect(actions).toBeFocused(); await expect(actions).toContainText(text);
  await expect(actions.locator('button,input,select,textarea,form')).toHaveCount(0);
  expect(writes).toEqual([]);
  await noOverflow(page);
});
