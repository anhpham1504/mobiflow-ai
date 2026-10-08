import { expect } from '@playwright/test';
import { test, axe, login, noOverflow, openListControls } from './remediation-support.mjs';

async function invalidField(page, field) {
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  const ids = (await field.getAttribute('aria-describedby')).split(' ');
  for (const id of ids) await expect(page.locator('[id="' + id + '"]')).toBeVisible();
  expect(ids.some(id => id.includes('error'))).toBe(true);
}

for (const role of ['USER', 'STAFF', 'MANAGER']) {
  test(`Phase B: mobile dashboard hierarchy and safe unknown request for ${role}`, async ({ page }, testInfo) => {
    const errors = [], positions = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page, role);
    for (const [width,height] of [[375,667],[390,844],[430,932],[1440,900]]) {
      await page.setViewportSize({width,height});
      const disclosure = page.locator('.list-controls');
      await expect(disclosure).not.toHaveAttribute('open');
      if (width < 768) {
        const first = page.locator('.request-card').first();
        await expect(first).toBeVisible();
        const box = await first.boundingBox();
        expect(box.y).toBeLessThan(height * 2);
        positions.push({width,height,firstWorkItemTop:box.y});
      }
      await noOverflow(page);
    }
    const summary = page.locator('.list-controls > summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Lưu chế độ xem', exact: true })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('.list-controls')).not.toHaveAttribute('open');
    await axe(page, testInfo, role + '-dashboard');
    await page.screenshot({path:testInfo.outputPath(role + '-dashboard.png'),fullPage:true});
    await testInfo.attach('work-item-positions',{body:JSON.stringify(positions),contentType:'application/json'});
    await page.goto('/' + role.toLowerCase() + '/requests/ffffffff-ffff-4fff-8fff-ffffffffffff');
    await expect(page.getByRole('heading', { level:1, name:'Không thể mở yêu cầu' })).toBeVisible();
    await expect(page.getByText('Yêu cầu không tồn tại hoặc bạn không có quyền truy cập.',{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Quay lại danh sách',exact:true})).toHaveAttribute('href',role === 'STAFF' ? '/staff/work-queue' : '/' + role.toLowerCase() + '/requests');
    await expect(page.getByRole('button',{name:'Tải lại dữ liệu',exact:true})).toBeVisible();
    await axe(page,testInfo,role + '-unknown-request');
    expect(errors).toEqual([]);
  });
}

test('Phase B: invalid create request retains data and focuses the described field', async ({page},testInfo) => {
  const writes=[];
  page.on('request',request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/requests') writes.push(request.url()); });
  await login(page,'USER'); await page.goto('/user/requests/new');
  await page.getByRole('textbox',{name:/Tiêu đề/}).fill('Bản nháp kiểm tra accessibility');
  const description=page.getByRole('textbox',{name:'Mô tả yêu cầu'});
  await description.fill('            ');
  await page.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();
  await invalidField(page,description);
  await expect(description).toHaveValue('            ');
  await expect(page.getByRole('textbox',{name:/Tiêu đề/})).toHaveValue('Bản nháp kiểm tra accessibility');
  await axe(page,testInfo,'invalid-create-request');
  const title=page.getByRole('textbox',{name:/Tiêu đề/});
  await title.fill('   ');await description.fill('Mô tả bản nháp hợp lệ để kiểm tra lỗi tiêu đề.');
  await page.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();await invalidField(page,title);
  expect(writes).toEqual([]);
});

test('Phase B: saved view and invalid date range field errors', async ({page},testInfo) => {
  const writes=[];
  page.on('request',request => { if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/v1/saved-request-views')) writes.push(request.url()); });
  await login(page,'USER'); await page.goto('/user/requests');
  await openListControls(page);
  const trigger=page.getByRole('button',{name:'Lưu chế độ xem',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog'),name=dialog.getByRole('textbox',{name:'Tên chế độ xem'});
  await name.fill('a'.repeat(81)); await dialog.getByRole('button',{name:'Lưu',exact:true}).click();
  await invalidField(page,name); await axe(page,testInfo,'invalid-saved-view');
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  const from=page.getByLabel('Tạo từ (UTC)',{exact:true}),to=page.getByLabel('Tạo trước (UTC)',{exact:true});
  await from.fill('2026-10-08T00:00'); await to.fill('2026-10-07T00:00');
  await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
  await invalidField(page,from); await expect(to).toHaveAttribute('aria-invalid','true');
  await expect(from).toHaveValue('2026-10-08T00:00'); await expect(to).toHaveValue('2026-10-07T00:00');
  await axe(page,testInfo,'invalid-date-range'); expect(writes).toEqual([]);
});

test('Phase B: template shared-schema errors and keyboard return from both editors', async ({page},testInfo) => {
  const writes=[];
  page.on('request',request => { if (request.method() !== 'GET' && /\/api\/v1\/(templates|routing-rules)/.test(new URL(request.url()).pathname)) writes.push(request.url()); });
  await login(page,'MANAGER'); await page.goto('/manager/templates');
  const trigger=page.getByRole('button',{name:'Tạo mẫu',exact:true});
  await trigger.focus(); await page.keyboard.press('Enter');
  const name=page.getByRole('textbox',{name:'Tên mẫu',exact:true}),body=page.getByRole('textbox',{name:'Nội dung phản hồi',exact:true});
  await expect(name).toBeFocused(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(name).toBeFocused();
  await body.fill('Nội dung bản nháp'); await name.fill('a'.repeat(121));
  await page.getByRole('button',{name:'Lưu mẫu',exact:true}).click(); await invalidField(page,name);
  await name.fill('Tên hợp lệ');
  const description=page.getByRole('textbox',{name:'Mô tả (không bắt buộc)',exact:true});
  await description.fill('a'.repeat(501)); await page.getByRole('button',{name:'Lưu mẫu',exact:true}).click(); await invalidField(page,description);
  await description.fill(''); await body.fill('a'.repeat(4001));
  await page.getByRole('button',{name:'Lưu mẫu',exact:true}).click(); await invalidField(page,body);
  await page.getByRole('combobox',{name:'Loại mẫu',exact:true}).selectOption('CHECKLIST');
  const item=page.getByRole('textbox',{name:'Nội dung bước 1',exact:true});
  await item.fill('a'.repeat(501)); await page.getByRole('button',{name:'Lưu mẫu',exact:true}).click(); await invalidField(page,item);
  await page.getByRole('button',{name:'Xóa bước 1',exact:true}).click();
  await page.getByRole('button',{name:'Lưu mẫu',exact:true}).click();
  const addStep=page.getByRole('button',{name:'Thêm bước',exact:true});
  await expect(addStep).toBeFocused();
  await expect(page.locator('[id="' + await addStep.getAttribute('aria-describedby') + '"]')).toHaveText('Checklist cần từ 1 đến 30 bước.');
  await axe(page,testInfo,'invalid-template');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await trigger.press('Enter'); await page.getByRole('button',{name:'Đóng biểu mẫu',exact:true}).click(); await expect(trigger).toBeFocused();
  await page.goto('/manager/routing-rules');
  const routing=page.getByRole('button',{name:'Tạo quy tắc',exact:true});
  await expect(routing).toBeEnabled();
  await routing.focus(); await page.keyboard.press('Enter');
  const ruleName=page.getByRole('textbox',{name:'Tên quy tắc',exact:true});
  await expect(ruleName).toBeFocused(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(ruleName).toBeFocused();
  await axe(page,testInfo,'routing-editor');
  await page.keyboard.press('Escape'); await expect(routing).toBeFocused();
  await routing.press('Enter'); await page.getByRole('button',{name:'Đóng biểu mẫu',exact:true}).click(); await expect(routing).toBeFocused();
  expect(writes).toEqual([]);
});

for (const [role,email,id,label] of [
  ['STAFF','staff.iot@mobiflow.local','f6ed710c-7d6e-40bb-ae4b-b17625a60ff7','Mẫu phản hồi'],
  ['MANAGER','manager@mobiflow.local','25e78cde-aef9-4ff4-9bae-805d89e1b6ac','Mẫu checklist'],
]) test(`Phase B: named semantic template section for ${role}`,async ({page},testInfo) => {
  await login(page,role,email); await page.goto('/' + role.toLowerCase() + '/requests/' + id);
  const groups=page.getByRole('region',{name:role === 'STAFF' ? /^Mẫu phản hồi — / : label,exact:true});
  await expect(groups).toHaveCount(role === 'STAFF' ? 2 : 1);
  for (const group of await groups.all()) await expect(group).toBeVisible();
  if (role === 'STAFF') {
    await expect(page.getByRole('region',{name:'Mẫu phản hồi — Gửi tin nhắn',exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'Mẫu phản hồi — Yêu cầu bổ sung thông tin',exact:true})).toBeVisible();
  }
  await axe(page,testInfo,role + '-template-selector');
  await noOverflow(page);
});
