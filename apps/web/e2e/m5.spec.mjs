import {test,expect} from '@playwright/test';
import {signIn} from './m4-helpers.mjs';
/* global document, window */

test('M5 manager knowledge lifecycle, RBAC, source preview, responsive and keyboard behavior',async({browser})=>{
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);const [manager,staff,user]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];
  for(const page of [manager,staff,user])page.on('pageerror',error=>errors.push(error.message));
  const marker='M5-E2E-'+Date.now(),title='Tài liệu '+marker,file={name:marker+'.txt',mimeType:'text/plain',buffer:Buffer.from('# Synthetic E2E\n'+marker+' mô tả kiểm tra kết nối IoT tại KCN Amata. Chỉ dùng cho kiểm thử.')};
  try{
    await signIn(manager,'manager@mobiflow.local');await manager.getByRole('link',{name:'Kho tài liệu',exact:true}).click();await expect(manager.getByRole('heading',{name:'Kho tài liệu'})).toBeVisible();
    await manager.getByLabel('Tiêu đề tài liệu').fill(title);await manager.getByLabel('Tệp PDF hoặc TXT').setInputFiles(file);await manager.getByRole('button',{name:'Tải tài liệu lên'}).click();await expect(manager.getByRole('region',{name:'Chi tiết tài liệu'}).getByRole('heading',{name:title})).toBeVisible();
    await expect(manager.getByRole('region',{name:'Danh sách tài liệu'}).getByRole('listitem').filter({hasText:title})).toContainText('Có thể tra cứu',{timeout:60000});await manager.getByRole('button',{name:'Xem '+title}).click();
    const sourceLink=manager.getByRole('link',{name:new RegExp(title)}).first();await expect(sourceLink).toBeVisible();const sourceHref=await sourceLink.getAttribute('href');expect(sourceHref).toMatch(/^\/knowledge\/sources\/KD-/);
    await sourceLink.click();await expect(manager.getByRole('heading',{name:'Nguồn tham chiếu'})).toBeVisible();await expect(manager.locator('blockquote')).toContainText(marker);
    await signIn(staff,'staff.iot@mobiflow.local');await staff.goto(sourceHref);await expect(staff.getByRole('heading',{name:'Nguồn tham chiếu'})).toBeVisible();await expect(staff.locator('blockquote')).toContainText(marker);
    await signIn(user,'user@mobiflow.local');await user.goto('/manager/knowledge');await expect(user.getByRole('heading',{name:'403 · Không có quyền truy cập'})).toBeVisible();await user.goto(sourceHref);await expect(user.locator('.form-error')).toContainText('không có quyền');
    await manager.goto('/manager/knowledge');await manager.getByRole('button',{name:'Xem '+title}).click();for(const width of [360,768,1440]){await manager.setViewportSize({width,height:900});expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await manager.screenshot({path:'artifacts/m5/knowledge-'+width+'.png',fullPage:true});}
    await manager.reload();await expect(manager.getByRole('heading',{name:'Kho tài liệu'})).toBeVisible();await manager.keyboard.press('Tab');await expect(manager.getByRole('link',{name:'Đi tới nội dung'})).toBeFocused();await manager.getByRole('button',{name:'Xem '+title}).click();
    const row=manager.getByRole('region',{name:'Danh sách tài liệu'}).getByRole('listitem').filter({hasText:title}),state=row.locator('p').first(),before=await state.textContent(),version=Number(before?.match(/Phiên bản (\d+)$/)?.[1]);expect(version).toBeGreaterThan(0);
    await manager.getByRole('button',{name:'Lập chỉ mục lại',exact:true}).click();await expect(state).not.toHaveText(before,{timeout:10000});await expect(state).toContainText('Có thể tra cứu',{timeout:60000});await manager.getByRole('button',{name:'Xem '+title}).click();await expect(manager.getByRole('region',{name:'Chi tiết tài liệu'}).getByRole('status')).toHaveText('Có thể tra cứu');
    await manager.getByLabel('Lý do vô hiệu hóa').fill('Kết thúc kiểm thử trình duyệt synthetic');await manager.getByRole('button',{name:'Vô hiệu hóa tài liệu'}).click();await expect(manager.getByRole('region',{name:'Chi tiết tài liệu'}).getByRole('status')).toHaveText('Đã vô hiệu hóa');
    await staff.reload();await expect(staff.locator('.form-error')).toContainText('không còn khả dụng');
    await manager.getByLabel('Tiêu đề tài liệu').fill(title+' duplicate');await manager.getByLabel('Tệp PDF hoặc TXT').setInputFiles(file);await manager.getByRole('button',{name:'Tải tài liệu lên'}).click();await expect(manager.locator('.form-error')).toContainText('cùng nội dung đã tồn tại');
    expect(errors).toEqual([]);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
