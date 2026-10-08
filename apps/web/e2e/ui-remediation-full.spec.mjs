/* global document, window, getComputedStyle */
import { expect } from '@playwright/test';
import { test, axe, login, noOverflow, viewports, openListControls } from './remediation-support.mjs';

const deepWidths = new Set([375, 390, 430, 1440]);
const listPaths = { USER: '/user/requests', STAFF: '/staff/work-queue', MANAGER: '/manager/requests' };
const detailIds = { USER: '60000000-0000-4000-8000-000000000002', STAFF: 'f6ed710c-7d6e-40bb-ae4b-b17625a60ff7', MANAGER: '25e78cde-aef9-4ff4-9bae-805d89e1b6ac' };

async function ready(page, kind) {
  await expect(page.locator('#main h1')).toBeVisible();
  if (kind === 'list' || kind === 'dashboard') await expect(page.getByRole('navigation', { name: 'Phân trang yêu cầu' })).toBeVisible();
  if (kind === 'detail') await expect(page.locator('.request-code')).toBeVisible();
  if (kind === 'notifications') await expect(page.getByRole('status', { name: 'Đang tải thông báo', exact: true })).toHaveCount(0);
  if (kind === 'templates') await expect(page.getByText('Đang tải thư viện mẫu…', { exact: true })).toHaveCount(0);
  if (kind === 'routing') await expect(page.getByRole('button', { name: 'Tạo quy tắc', exact: true })).toBeEnabled();
  if (kind === 'analytics') await expect(page.getByTestId('analytics-period')).toBeVisible();
  if (kind === 'knowledge') await expect(page.getByText('Đang tải thư viện…', { exact: true })).toHaveCount(0);
  await expect(page.locator('#main > .page-container > [role="alert"]')).toHaveCount(0);
}

async function responsive(page, testInfo, label, screenshots = false) {
  const measurements = [];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    measurements.push({ label, width, height, ...dimensions });
    if (deepWidths.has(width)) {
      await axe(page, testInfo, label + '-axe-' + width);
      if (screenshots) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath(label + '-' + width + '.png') });
      }
    }
  }
  await testInfo.attach('responsive-matrix', { body: JSON.stringify(measurements), contentType: 'application/json' });
}

test('Full regression: public login responsive, accessible and keyboard entry', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập MobiFlow AI', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Đăng nhập — MobiFlow AI');
  await responsive(page, testInfo, 'public-login', true);
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await email.focus(); await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: /^Mật khẩu/ })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(email).toBeFocused();
  expect(await email.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
});

test('Full regression: public system health route remains available', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Trạng thái hệ thống', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại', exact: true })).toBeEnabled();
  await expect(page.locator('.service-list > li')).toHaveCount(6);
  await expect(page.getByRole('link', { name: 'Vào không gian làm việc', exact: true })).toHaveAttribute('href', '/login');
  await responsive(page, testInfo, 'public-health', true);
});

for (const role of ['USER', 'STAFF', 'MANAGER']) {
  const home = '/' + role.toLowerCase() + '/dashboard';
  const routes = [
    [home, 'dashboard'], [listPaths[role], 'list'],
    ['/' + role.toLowerCase() + '/requests/' + detailIds[role], 'detail'],
    ['/profile', 'profile'], ['/notifications', 'notifications'],
    ...(role === 'USER' ? [['/user/requests/new', 'create']] : []),
    ...(role === 'MANAGER' ? [
      ['/manager/templates', 'templates'], ['/manager/routing-rules', 'routing'],
      ['/manager/approvals', 'list'], ['/manager/approvals/' + detailIds.MANAGER, 'detail'],
      ['/manager/analytics', 'analytics'], ['/manager/knowledge', 'knowledge'],
    ] : []),
  ];
  for (const [path, kind] of routes) test(`Full regression: ${role} ${path} at ten viewports and four Axe widths`, async ({ page }, testInfo) => {
    await login(page, role); await page.goto(path); await ready(page, kind);
    await expect(page.locator('#main h1')).toHaveCount(1);
    await expect(page).toHaveTitle(/ — MobiFlow AI$/);
    expect(await page.title()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    await expect(page.locator('.topbar-context strong')).not.toHaveText('Trang không tồn tại');
    await responsive(page, testInfo, role + '-' + path.replaceAll('/', '-'), ['dashboard', 'list', 'detail', 'create', 'templates', 'routing'].includes(kind));
    await page.setViewportSize({ width: 1440, height: 900 });
    const brand = page.getByRole('link', { name: 'MobiFlow AI — Trang chủ', exact: true });
    await expect(brand).toHaveAttribute('href', home);
    await expect(page.locator('.primary-nav a[href="/manager/audit"]')).toHaveCount(0);
    await brand.focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL('http://localhost:33700' + home);
  });

  test(`Full regression: existing CLOSED request and action access for ${role}`, async ({ page }, testInfo) => {
    await login(page, role); await page.goto('/' + role.toLowerCase() + '/requests/60000000-0000-4000-8000-000000000001');
    await ready(page, 'detail'); await expect(page.locator('.request-meta')).toContainText('Đã đóng');
    await responsive(page, testInfo, role + '-closed-detail');
    const jump = page.getByRole('link', { name: 'Đi tới thao tác', exact: true });
    await jump.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Thao tác', exact: true })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Thao tác', exact: true }).locator('form')).toHaveCount(0);
    await testInfo.attach('observed-state', { body: JSON.stringify({ role, request: 'MF-DEMO-1001', status: 'CLOSED' }), contentType: 'application/json' });
  });

  test(`Full regression: ${role} mobile date errors, native arrow keys and local empty search`, async ({ page }, testInfo) => {
    await login(page, role); await page.goto(listPaths[role]); await ready(page, 'list');
    await openListControls(page);
    const from = page.getByLabel('Tạo từ (UTC)', { exact: true }), to = page.getByLabel('Tạo trước (UTC)', { exact: true });
    for (const [width, height] of viewports.filter(([width]) => deepWidths.has(width))) {
      await page.setViewportSize({ width, height });
      const priority = page.getByRole('combobox', { name: 'Ưu tiên', exact: true });
      await priority.focus(); await page.keyboard.press('ArrowDown'); await expect(priority).not.toHaveValue('');
      await page.keyboard.press('ArrowUp'); await expect(priority).toHaveValue('');
      await from.fill('2026-10-08T00:00'); await to.fill('2026-10-07T00:00');
      await page.getByRole('button', { name: 'Áp dụng', exact: true }).press('Enter');
      await expect(from).toBeFocused(); await expect(from).toHaveAttribute('aria-invalid', 'true');
      await expect(to).toHaveAttribute('aria-describedby', 'request-filter-error');
      await expect(page.locator('#request-filter-error')).toBeVisible();
      const search = page.getByRole('searchbox', { name: 'Tìm trong trang' });
      await search.fill('Không có kết quả — 9z9z'); await search.press('Enter');
      await expect(search).toHaveValue('Không có kết quả — 9z9z');
      await expect(page.getByRole('heading', { name: 'Không có yêu cầu phù hợp', exact: true })).toBeVisible();
      await axe(page, testInfo, role + '-empty-search-date-' + width); await noOverflow(page);
      await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).press('Space');
      await expect(search).toHaveValue(''); await expect(page.getByRole('navigation', { name: 'Phân trang yêu cầu' })).toBeVisible();
    }
  });

  test(`Full regression: ${role} role denial and safe unknown-request return links`, async ({ page }, testInfo) => {
    await login(page, role); const forbidden = role === 'MANAGER' ? '/user/requests' : '/manager/requests';
    await page.goto(forbidden); await expect(page.getByRole('heading', { level: 1, name: '403 · Không có quyền truy cập' })).toBeVisible();
    for (const width of [375, 1440]) { await page.setViewportSize({ width, height: 900 }); await axe(page, testInfo, role + '-role-denial-' + width); await noOverflow(page); }
    const backHome = page.getByRole('link', { name: 'Về tổng quan', exact: true });
    await backHome.focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL('http://localhost:33700' + home);
    await page.goto('/' + role.toLowerCase() + '/requests/ffffffff-ffff-4fff-8fff-ffffffffffff');
    await expect(page.getByRole('heading', { level: 1, name: 'Không thể mở yêu cầu' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); await axe(page, testInfo, role + '-unknown-mobile'); await noOverflow(page);
    const backList = page.getByRole('link', { name: 'Quay lại danh sách', exact: true });
    await backList.focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL('http://localhost:33700' + listPaths[role]);
    if (role === 'STAFF') {
      await page.goto('/staff/requests/60000000-0000-4000-8000-000000000002');
      await expect(page.getByRole('heading', { level: 1, name: 'Không thể mở yêu cầu' })).toBeVisible();
      await expect(page.getByText('Yêu cầu không tồn tại hoặc bạn không có quyền truy cập.', { exact: true })).toBeVisible();
    }
  });

  test(`Full regression: ${role} source route context and unavailable-source feedback`, async ({ page }, testInfo) => {
    await login(page, role); await page.goto('/knowledge/sources/KD-ffffffff-ffff-4fff-8fff-ffffffffffff-G1-C0');
    await expect(page.getByRole('heading', { level: 1, name: 'Nguồn tham chiếu', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử tải lại nguồn', exact: true })).toBeVisible();
    await expect(page.locator('.topbar-context strong')).toHaveText('Nguồn tham chiếu');
    await expect(page).toHaveTitle('Nguồn tham chiếu — MobiFlow AI');
    await responsive(page, testInfo, role + '-unavailable-source');
  });
}

test('Full regression: mobile invalid request draft is preserved and described', async ({ page }, testInfo) => {
  await login(page, 'USER'); await page.goto('/user/requests/new');
  const description = page.locator('#request-description');
  await expect(description).toHaveAccessibleName(/^Mô tả yêu cầu/);
  for (const [width, height] of viewports.filter(([width]) => deepWidths.has(width))) {
    await page.setViewportSize({ width, height });
    await page.getByRole('textbox', { name: /Tiêu đề/ }).fill('Bản nháp tiếng Việt — không gửi');
    await description.fill('            '); await page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).press('Enter');
    await expect(description).toBeFocused(); await expect(description).toHaveAttribute('aria-invalid', 'true');
    await expect(description).toHaveAttribute('aria-describedby', 'request-description-hint request-description-count request-description-error');
    await expect(description).toHaveValue('            '); await expect(page.locator('#request-description-error')).toBeVisible();
    await axe(page, testInfo, 'invalid-request-' + width); await noOverflow(page);
  }
});

test('Full regression: mobile template and routing editors retain keyboard focus', async ({ page }, testInfo) => {
  await login(page, 'MANAGER');
  for (const [path, triggerName, fieldName] of [['/manager/templates', 'Tạo mẫu', 'Tên mẫu'], ['/manager/routing-rules', 'Tạo quy tắc', 'Tên quy tắc']]) {
    await page.goto(path); const trigger = page.getByRole('button', { name: triggerName, exact: true }); await expect(trigger).toBeEnabled();
    for (const [width, height] of viewports.filter(([width]) => deepWidths.has(width))) {
      await page.setViewportSize({ width, height }); await trigger.focus(); await page.keyboard.press('Enter');
      const field = page.getByRole('textbox', { name: fieldName, exact: true }); await expect(field).toBeFocused();
      await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(field).toBeFocused();
      if (path.endsWith('templates')) {
        await field.fill('a'.repeat(121)); await page.getByRole('textbox', { name: 'Nội dung phản hồi', exact: true }).fill('Bản nháp kiểm tra');
        await page.getByRole('button', { name: 'Lưu mẫu', exact: true }).press('Enter');
        await expect(field).toBeFocused(); await expect(field).toHaveAttribute('aria-invalid', 'true');
      }
      await axe(page, testInfo, triggerName + '-editor-' + width); await noOverflow(page);
      await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(field).toHaveCount(0);
    }
  }
});

test('Full regression: STAFF observed cursor boundaries and keyboard previous/next', async ({ page }, testInfo) => {
  await login(page, 'STAFF'); await page.goto(listPaths.STAFF);
  const pagination = page.getByRole('navigation', { name: 'Phân trang yêu cầu' }), previous = pagination.getByRole('button', { name: 'Trang trước', exact: true }), next = pagination.getByRole('button', { name: 'Trang tiếp theo', exact: true });
  await expect(pagination).toContainText('Trang 1 ·'); await expect(previous).toBeDisabled();
  const pages = [{ number: 1, rows: await page.locator('.data-table tbody tr').count() }]; let number = 1;
  while (await next.isEnabled()) {
    expect(number).toBeLessThan(30); await next.focus(); await page.keyboard.press('Enter'); number++;
    await expect(pagination).toContainText('Trang ' + number + ' ·'); await expect(previous).toBeEnabled();
    pages.push({ number, rows: await page.locator('.data-table tbody tr').count() });
  }
  await expect(pagination).toContainText('Đã đến cuối danh sách');
  if (number > 1) {
    await previous.focus(); await page.keyboard.press('Enter'); await expect(pagination).toContainText('Trang ' + (number - 1) + ' ·');
    await page.goBack(); await expect(pagination).toContainText('Trang ' + number + ' ·');
    await page.goForward(); await expect(pagination).toContainText('Trang ' + (number - 1) + ' ·');
  }
  await testInfo.attach('staff-cursor-pages', { body: JSON.stringify(pages), contentType: 'application/json' });
});

test('Full regression: inspect contrast on nodes marked incomplete by Axe', async ({ page }, testInfo) => {
  const measurements = [];
  const rgba = value => { const values = value.match(/[\d.]+/g).map(Number); return [...values.slice(0, 3), values[3] ?? 1]; };
  const luminance = color => color.slice(0, 3).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  async function inspect(locator, label, svg = false) {
    await expect(locator).toBeVisible();
    const styles = await locator.evaluate((element, svg) => {
      const foreground = getComputedStyle(element)[svg ? 'fill' : 'color'], layers = [];
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) layers.push(getComputedStyle(ancestor).backgroundColor);
      return { foreground, layers };
    }, svg);
    let background = [255, 255, 255];
    for (const layer of styles.layers.reverse().map(rgba)) background = background.map((channel, index) => layer[index] * layer[3] + channel * (1 - layer[3]));
    const foreground = rgba(styles.foreground).slice(0, 3), light = luminance(background), dark = luminance(foreground);
    const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
    measurements.push({ label, styles, foreground, background, contrastRatio: ratio });
    expect(ratio, label + ' computed text contrast').toBeGreaterThanOrEqual(4.5);
  }
  await login(page, 'MANAGER'); await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/manager/requests'); await ready(page, 'list');
  await openListControls(page);
  for (const selector of ['.topbar-context > span', '.topbar-context > strong', '.environment-status']) await inspect(page.locator(selector), selector);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Lưu chế độ xem', exact: true }).click();
  await inspect(page.locator('#saved-view-name-hint'), 'Saved Views hint');
  await page.screenshot({ path: testInfo.outputPath('saved-view-dialog-390.png') }); await page.keyboard.press('Escape');
  await page.goto('/manager/analytics'); await ready(page, 'analytics');
  const svg = page.locator('.analytics-trend'); await expect(svg).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const selector of ['text[y="175"]', 'text[y="35"]', 'text[x="40"]', 'text[x="770"]']) await inspect(svg.locator(selector), 'Analytics ' + width + ' ' + selector, true);
  }
  await testInfo.attach('manual-contrast', { body: JSON.stringify(measurements), contentType: 'application/json' });
});

for (const role of ['USER', 'STAFF', 'MANAGER']) test(`Full regression: actual ${role} login, profile, home and logout`, async ({ page }) => {
  await login(page, role, undefined, true); await page.goto('/profile');
  const email = role === 'STAFF' ? 'staff.iot@mobiflow.local' : role.toLowerCase() + '@mobiflow.local';
  await expect(page.locator('.profile-card')).toContainText(email); await expect(page).toHaveTitle('Hồ sơ cá nhân — MobiFlow AI');
  await page.setViewportSize({ width: 1440, height: 900 });
  const brand = page.getByRole('link', { name: 'MobiFlow AI — Trang chủ', exact: true });
  await brand.focus(); await page.keyboard.press('Enter'); await expect(page).toHaveURL('http://localhost:33700/' + role.toLowerCase() + '/dashboard');
  const signedOut = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/auth/logout');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).press('Enter'); expect((await signedOut).ok()).toBe(true);
  await expect(page).toHaveURL('http://localhost:33700/login');
  await page.goto('/profile'); await expect(page).toHaveURL('http://localhost:33700/login');
});
