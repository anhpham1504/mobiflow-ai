import {test,expect} from '@playwright/test';
import {signIn,create} from './m4-helpers.mjs';
/* global document,window */
test('M7 manager explicitly accepts a current AI recommendation and staff sees one assignment',async({browser})=>{
  const managerContext=await browser.newContext(),userContext=await browser.newContext(),staffContext=await browser.newContext(),manager=await managerContext.newPage(),user=await userContext.newPage(),staff=await staffContext.newPage(),errors=[];
  for(const page of [manager,user,staff])page.on('pageerror',e=>errors.push(e.message));
  try{
    await signIn(user,'user@mobiflow.local');const title='M7 browser '+Date.now(),id=await create(user,title,'Khách hàng ABC có 17 SIM IoT tại KCN Amata bị mất kết nối từ khoảng 8 giờ sáng. Synthetic M7.');await expect(user.getByText('Phân tích AI hoàn tất.',{exact:true})).toBeVisible({timeout:310000});
    await signIn(manager,'manager@mobiflow.local');await manager.goto('/manager/requests/'+id);const panel=manager.getByRole('region',{name:'Đề xuất AI và quyết định của quản lý'});await panel.getByRole('button',{name:'Tạo đề xuất AI',exact:true}).click();await expect(panel.getByRole('heading',{name:'AI đề xuất — chưa được duyệt'})).toBeVisible({timeout:310000});
    const accept=panel.getByRole('button',{name:'Chấp nhận đề xuất'});await expect(accept).toBeEnabled();manager.once('dialog',dialog=>dialog.accept());await accept.click();const assignment=manager.getByText(/Phân công: (?!Chưa phân công)/).first();await expect(assignment).toBeVisible({timeout:30000});await expect(manager.getByText(/ASSIGNED|Đã phân công/).first()).toBeVisible();
    const assignedText=await assignment.textContent(),staffEmail=assignedText?.includes('IoT Specialist')?'staff.iot@mobiflow.local':assignedText?.includes('Network Specialist')?'staff.network@mobiflow.local':null;expect(staffEmail,'approved assignee must be one of the eligible network-team staff').toBeTruthy();
    await signIn(staff,staffEmail);await staff.goto('/staff/work-queue');await expect(staff.getByText(title,{exact:true})).toBeVisible({timeout:30000});
    for(const width of [360,768,1440]){await manager.setViewportSize({width,height:900});expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}expect(errors).toEqual([]);
  }finally{await Promise.all([managerContext.close(),userContext.close(),staffContext.close()]);}
});
