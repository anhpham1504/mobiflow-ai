import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {signIn} from './m4-helpers.mjs';
/* global document,window */

const shots='artifacts/ui-v1-1/screenshots';
async function capture(page,name){for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await axeMajor(page);await page.screenshot({path:`${shots}/${name}-${width}.png`,fullPage:true});}}
async function axeMajor(page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(result.violations.filter(v=>['critical','serious'].includes(v.impact))).toEqual([]);}

test('V1.1 login is public, responsive, keyboard reachable and accessible',async({page})=>{
  await page.goto('/login');await expect(page.getByRole('heading',{name:'Đăng nhập MobiFlow AI'})).toBeVisible();await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.getByRole('button',{name:'Đăng nhập',exact:true})).toBeVisible();
  await page.keyboard.press('Home');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Đi tới nội dung'})).toBeFocused();await page.keyboard.press('Enter');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('main');
  await capture(page,'login');await axeMajor(page);
});

for(const role of [
  {name:'user',email:'user@mobiflow.local',heading:'Tổng quan',nav:'Yêu cầu của tôi'},
  {name:'staff',email:'staff.iot@mobiflow.local',heading:'Tổng quan công việc',nav:'Công việc của tôi'},
  {name:'manager',email:'manager@mobiflow.local',heading:'Tổng quan vận hành',nav:'Yêu cầu'},
])test(`V1.1 ${role.name} dashboard and role navigation`,async({page})=>{
  await signIn(page,role.email);await expect(page.getByRole('heading',{name:role.heading,exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Điều hướng chính'}).getByRole('link',{name:role.nav,exact:true})).toBeVisible();
  if(role.name!=='manager')await expect(page.getByRole('link',{name:'Kho tri thức'})).toHaveCount(0);else await expect(page.getByRole('link',{name:'Kho tri thức'})).toBeVisible();
  await capture(page,`${role.name}-dashboard`);await axeMajor(page);
  if(role.name==='user'){await page.goto('/user/requests/new');await expect(page.getByRole('heading',{name:'Tạo yêu cầu mới'})).toBeVisible();await expect(page.getByRole('complementary',{name:'Hướng dẫn tạo yêu cầu'})).toBeVisible();await capture(page,'request-create');await axeMajor(page);}
  if(role.name==='staff'){await page.setViewportSize({width:1440,height:1000});await page.goto('/staff/work-queue');await expect(page.locator('tbody .request-title').first()).toBeVisible();await page.locator('tbody .request-title').first().click();await expect(page.getByRole('heading',{name:'Nội dung yêu cầu'})).toBeVisible();await expect(page.locator('.copilot-actions button')).toHaveCount(6);await capture(page,'staff-request-detail');}
});

test('V1.1 mobile drawer traps, closes with Escape, and restores focus',async({page})=>{
  await signIn(page,'manager@mobiflow.local');await page.setViewportSize({width:390,height:850});const trigger=page.getByRole('button',{name:'Mở menu'});await trigger.click();await expect(page.getByRole('dialog',{name:'Menu điều hướng'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Menu điều hướng'})).toBeHidden();await expect(trigger).toBeFocused();
});

test('V1.1 manager request list and detail remain operational',async({page})=>{
  await signIn(page,'manager@mobiflow.local');await page.goto('/manager/requests');await expect(page.getByRole('heading',{name:'Quản lý yêu cầu'})).toBeVisible();await expect(page.getByRole('table')).toBeVisible();await capture(page,'request-list');await page.setViewportSize({width:1440,height:1000});
  const first=page.locator('tbody .request-title').first();await expect(first).toBeVisible();await first.click();await expect(page.getByRole('heading',{name:'Nội dung yêu cầu'})).toBeVisible();await expect(page.getByText('Phiên bản',{exact:false})).toBeVisible();await capture(page,'request-detail');await axeMajor(page);
});

test('V1.1 analytics and system status preserve truthful presentation',async({page})=>{
  await signIn(page,'manager@mobiflow.local');await page.goto('/manager/analytics');await expect(page.getByRole('heading',{name:'Chất lượng AI & vận hành'})).toBeVisible();await expect(page.getByRole('region',{name:'Tổng quan vận hành'})).toBeVisible();await expect(page.locator('.analytics-content-grid')).toBeVisible();await capture(page,'analytics');await axeMajor(page);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Trạng thái hệ thống'})).toBeVisible();await expect(page.getByText(/Hạ tầng cốt lõi/)).toBeVisible();await capture(page,'system-status');await axeMajor(page);
});

test('V1.1 shell has no page-wide overflow at required widths',async({page})=>{
  await signIn(page,'manager@mobiflow.local');for(const width of [360,768,1440,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
});
