import { expect } from '@playwright/test';
import { test, axe, login, noOverflow, viewports } from './remediation-support.mjs';

async function target44(locator){const box=await locator.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
test('Phase D: login password toggle keeps a 44px hit area at every viewport',async({page},testInfo)=>{
  await page.goto('/login');
  for(const [width,height]of viewports){
    await page.setViewportSize({width,height});
    const toggle=page.getByRole('button',{name:'Hiện mật khẩu',exact:true});
    await target44(toggle);await noOverflow(page);
    await toggle.focus();await page.keyboard.press('Enter');await expect(page.getByRole('textbox',{name:/Mật khẩu/})).toHaveAttribute('type','text');
    await page.getByRole('button',{name:'Ẩn mật khẩu',exact:true}).press('Enter');
  }
  await axe(page,testInfo,'login-touch-target');
});

for(const role of ['USER','STAFF','MANAGER'])test(`Phase D: shell hit targets and keyboard drawer for ${role}`,async({page},testInfo)=>{
  await login(page,role);
  for(const [width,height]of viewports){
    await page.setViewportSize({width,height});await target44(page.getByRole('link',{name:'Mở thông báo',exact:true}));
    if(width<1024){
      const menu=page.getByRole('button',{name:'Mở menu',exact:true});await target44(menu);
      await menu.focus();await page.keyboard.press('Enter');const drawer=page.getByRole('dialog',{name:'Menu điều hướng',exact:true});
      await expect(drawer).toBeVisible();await target44(drawer.getByRole('button',{name:'Đóng menu',exact:true}));
      await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
      await expect(drawer.getByRole('link',{name:'MobiFlow AI — Trang chủ',exact:true})).toBeFocused();
      await page.keyboard.press('Shift+Tab');await expect(drawer.getByRole('button',{name:'Đăng xuất',exact:true})).toBeFocused();
      await page.keyboard.press('Tab');await expect(drawer.getByRole('link',{name:'MobiFlow AI — Trang chủ',exact:true})).toBeFocused();
      await page.keyboard.press('Escape');await expect(drawer).not.toBeVisible();await expect(menu).toBeFocused();
    }
    await noOverflow(page);
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:testInfo.outputPath(role+'-dashboard-390.png'),fullPage:true});
  await axe(page,testInfo,role+'-shell');
});

test('Phase D: USER states without commands have meaningful next-step context',async({page},testInfo)=>{
  await login(page,'USER');
  for(const id of ['60000000-0000-4000-8000-000000000005','f6ed710c-7d6e-40bb-ae4b-b17625a60ff7']){
    await page.goto('/user/requests/'+id);await page.getByRole('link',{name:'Đi tới thao tác',exact:true}).click();
    const actions=page.getByRole('region',{name:'Thao tác',exact:true});
    await expect(actions.getByText('Hiện chưa có thao tác nào cần bạn thực hiện.',{exact:true})).toBeVisible();
    await expect(actions.locator('form,button')).toHaveCount(0);await axe(page,testInfo,'no-user-command-'+id);
  }
});

for(const role of ['USER','STAFF','MANAGER'])test(`Phase D: native Saved Views dialog inset, scrolling, Escape and return for ${role}`,async({page},testInfo)=>{
  const positions=[];await login(page,role);await page.goto(role==='STAFF'?'/staff/work-queue':'/'+role.toLowerCase()+'/requests');
  for(const [width,height]of [[320,760],[375,667],[390,844],[430,932],[768,1024],[1440,900],[320,240]]){
    await page.setViewportSize({width,height});
    const trigger=page.getByRole('button',{name:'Lưu chế độ xem',exact:true});await trigger.focus();await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Lưu chế độ xem',exact:true}),name=dialog.getByRole('textbox',{name:'Tên chế độ xem',exact:true});
    await expect(dialog).toBeVisible();await expect(name).toBeFocused();
    await name.fill('a'.repeat(81));await dialog.getByRole('button',{name:'Lưu',exact:true}).click();await expect(name).toBeFocused();
    const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(15);expect(box.y).toBeGreaterThanOrEqual(15);expect(box.x+box.width).toBeLessThanOrEqual(width-15);expect(box.y+box.height).toBeLessThanOrEqual(height-15);
    if(height===240)expect(await dialog.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
    await expect(dialog).toHaveJSProperty('open',true);expect(await dialog.evaluate(element=>element.matches(':modal'))).toBe(true);
    await name.focus();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Lưu',exact:true})).toBeFocused();
    await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Hủy',exact:true})).toBeFocused();
    await trigger.focus();await expect(dialog.getByRole('button',{name:'Hủy',exact:true})).toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Lưu',exact:true})).toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(name).toBeFocused();
    positions.push({width,height,...box});await noOverflow(page);
    if(width===390)await axe(page,testInfo,role+'-saved-view-dialog');
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
  }
  await testInfo.attach('dialog-positions',{body:JSON.stringify(positions),contentType:'application/json'});
});
