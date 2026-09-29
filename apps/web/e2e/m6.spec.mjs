import {test,expect} from '@playwright/test';
import {signIn,create} from './m4-helpers.mjs';
/* global document,window */
test('M6 real grounded proposal, explanatory-only UI, sources, RBAC, responsive keyboard and stale context',async({browser})=>{
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);const [user,manager,staff]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];
  for(const page of [user,manager,staff])page.on('pageerror',e=>errors.push(e.message));
  try{
    await signIn(user,'user@mobiflow.local');const id=await create(user,'M6 browser '+Date.now(),'Khách hàng ABC có 17 SIM IoT tại KCN Amata bị mất kết nối từ khoảng 8 giờ sáng. Synthetic demo.');
    await expect(user.getByText('Phân tích AI hoàn tất.',{exact:true})).toBeVisible({timeout:310000});
    await expect(user.getByRole('region',{name:'Đề xuất AI và quyết định của quản lý'})).toHaveCount(0);
    await signIn(manager,'manager@mobiflow.local');await manager.goto('/manager/requests/'+id);const panel=manager.getByRole('region',{name:'Đề xuất AI và quyết định của quản lý'});
    await expect(panel).toContainText('Chưa có đề xuất.');await panel.getByRole('button',{name:'Tạo đề xuất AI',exact:true}).focus();await manager.keyboard.press('Enter');
    await expect(panel.getByRole('status')).toContainText('AI đang tổng hợp');await expect(panel.getByRole('button',{name:'Tạo đề xuất AI',exact:true})).toBeDisabled();
    await expect(panel.getByRole('heading',{name:'AI đề xuất — chưa được duyệt'})).toBeVisible({timeout:310000});await expect(panel).toContainText('chưa hiệu chuẩn');await expect(manager.getByText('Phân công: Chưa phân công',{exact:true})).toBeVisible();
    await expect(manager.getByText('SLA bắt đầu sau lần phân công đầu tiên.',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Chấp nhận đề xuất'})).toBeVisible();
    const source=panel.getByRole('link').filter({hasText:/SOP|FAQ/}).first();await expect(source).toBeVisible();const href=await source.getAttribute('href');await source.click();await expect(manager.getByRole('heading',{name:'Nguồn tham chiếu'})).toBeVisible();await manager.goto('/manager/requests/'+id);
    await expect(panel.getByRole('heading',{name:'AI đề xuất — chưa được duyệt'})).toBeVisible();
    for(const width of [360,768,1440]){await manager.setViewportSize({width,height:900});expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await manager.screenshot({path:'artifacts/m6/recommendation-'+width+'.png',fullPage:true});}
    await manager.setViewportSize({width:720,height:500});await manager.evaluate(()=>{document.documentElement.style.fontSize='200%';});expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await manager.reload();await expect(panel).toBeVisible();await manager.keyboard.press('Tab');await expect(manager.getByRole('link',{name:'Đi tới nội dung'})).toBeFocused();
    await signIn(staff,'staff.iot@mobiflow.local');await staff.goto('/staff/requests/'+id);await expect(staff.getByRole('main').getByRole('alert')).toContainText('Không tìm thấy');
    await user.goto(href);await expect(user.locator('.form-error')).toContainText('không có quyền');
    await user.goto('/user/requests/'+id);await user.getByLabel('Nội dung tin nhắn').fill('Cập nhật synthetic sau đề xuất để kiểm tra stale.');await user.getByRole('button',{name:'Gửi tin nhắn',exact:true}).click();
    await manager.reload();await expect(panel.getByRole('alert')).toContainText('không còn hiện hành');
    // Deterministic UI error projection, separate from the live generation above.
    await manager.route('**/api/v1/manager/requests/'+id+'/ai/recommendation',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:'FORBIDDEN',message:'Không có quyền'},requestId:'00000000-0000-4000-8000-000000000001'})}));
    await panel.getByRole('button',{name:'Tải lại đề xuất',exact:true}).click();await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByRole('heading',{name:'AI đề xuất — chưa được duyệt'})).toHaveCount(0);expect(errors).toEqual([]);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
