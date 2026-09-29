import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {signIn,create} from './m4-helpers.mjs';
const offlineEvidencePath=process.env.M6_REGRESSION==='true'
  ?'docs/verification/evidence/M6_REGRESSION_M4_BROWSER_OFFLINE.json'
  :'docs/verification/evidence/M4_BROWSER_OFFLINE.json';
/* global document, window -- evaluated inside browser */
test('M4 actual Ollama intake, role projection, persisted reload, responsive keyboard UI and protected cache clearing',async({browser})=>{
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);const [user,manager,staff]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];
  for(const p of [user,manager,staff])p.on('pageerror',e=>errors.push(e.message));
  try{
    await signIn(user,'user@mobiflow.local');
    const id=await create(user,'M4 browser '+Date.now(),'17 SIM IoT mất kết nối từ 8 giờ sáng. Chưa xác định địa điểm.');
    const userPanel=user.getByRole('region',{name:'Phân tích AI hỗ trợ'});
    await expect(userPanel.getByRole('status')).toContainText(/AI đang chờ xử lý|AI đang phân tích/);
    await expect(userPanel.getByText('Phân tích AI hoàn tất.',{exact:true})).toBeVisible({timeout:310000});
    await expect(userPanel.getByRole('heading',{name:'Thông tin còn thiếu'})).toBeVisible();
    await expect(userPanel.getByRole('heading',{name:'AI đề xuất (chưa được duyệt)'})).toHaveCount(0);
    await user.reload();await expect(userPanel.getByText('Phân tích AI hoàn tất.',{exact:true})).toBeVisible();
    await signIn(manager,'manager@mobiflow.local');await manager.goto('/manager/requests/'+id);
    const managerPanel=manager.getByRole('region',{name:'Phân tích AI hỗ trợ'});
    await expect(managerPanel.getByRole('heading',{name:'AI đề xuất (chưa được duyệt)'})).toBeVisible();
    await expect(managerPanel).toContainText('NETWORK / IOT_CONNECTIVITY');await expect(managerPanel).toContainText('chưa hiệu chuẩn');
    await expect(manager.getByText('Đã phân loại · MEDIUM',{exact:true})).toBeVisible();
    for(const width of [360,768,1440]){
      await manager.setViewportSize({width,height:900});expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await manager.screenshot({path:'artifacts/m4/analysis-'+width+'.png',fullPage:true});
    }
    await manager.reload();await expect(managerPanel.getByRole('heading',{name:'AI đề xuất (chưa được duyệt)'})).toBeVisible();
    await manager.keyboard.press('Tab');await expect(manager.getByRole('link',{name:'Đi tới nội dung'})).toBeFocused();
    await signIn(staff,'staff.iot@mobiflow.local');await staff.goto('/staff/requests/'+id);await expect(staff.getByRole('main').getByRole('alert')).toContainText('Không tìm thấy');
    await user.goto('/manager/requests/'+id);await expect(user.getByRole('heading',{name:'403 · Không có quyền truy cập'})).toBeVisible();
    // Deterministic UI-only revoked-access regression. The real provider gate above is not mocked.
    await manager.route('**/api/v1/requests/'+id,route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{code:'NOT_FOUND',message:'Không tìm thấy'},requestId:'00000000-0000-4000-8000-000000000001'})}));
    await manager.getByRole('button',{name:'Tải lại',exact:true}).click();
    await expect(manager.getByRole('main').getByRole('alert')).toBeVisible();await expect(managerPanel).toHaveCount(0);
    expect(errors).toEqual([]);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('M4 actual provider recovery: explicit retry from failed run succeeds and survives reload',async({page})=>{
  const {requestId}=JSON.parse(readFileSync(offlineEvidencePath,'utf8'));
  await signIn(page,'user@mobiflow.local');await page.goto('/user/requests/'+requestId);
  const panel=page.getByRole('region',{name:'Phân tích AI hỗ trợ'});
  await expect(panel.getByRole('button',{name:'Thử phân tích lại'})).toBeVisible();
  await panel.getByRole('button',{name:'Thử phân tích lại'}).focus();await page.keyboard.press('Enter');
  await expect(panel.getByRole('status')).toContainText(/AI đang chờ xử lý|AI đang phân tích/);
  await expect(panel.getByText('Phân tích AI hoàn tất.',{exact:true})).toBeVisible({timeout:310000});
  await page.reload();await expect(panel.getByText('Phân tích AI hoàn tất.',{exact:true})).toBeVisible();
});
