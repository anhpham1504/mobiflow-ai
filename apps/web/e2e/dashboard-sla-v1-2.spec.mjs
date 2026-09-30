import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {dashboardResponseSchema,requestListSchema,requestResponseSchema} from '@mobiflow/contracts';
import {signIn} from './m4-helpers.mjs';
/* global document,window */

const labels={openRequests:'Đang mở',open:'Đang mở',inProgress:'Đang xử lý',waitingForUser:'Cần phản hồi',resolved:'Chờ xác nhận',closed:'Đã đóng',assignedToMe:'Được phân công',active:'Công việc đang hoạt động',pendingApproval:'Chờ duyệt',unassigned:'Chưa phân công',resolvedToday:'Đã giải quyết hôm nay',slaAtRisk:'SLA có nguy cơ',slaBreached:'SLA quá hạn'};
async function inspect(page,name){
  for(const width of [360,768,1440,1920]){
    await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(result.violations.filter(v=>['critical','serious'].includes(v.impact))).toEqual([]);
    for(const box of await page.locator('.button-primary:visible').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height)))expect(box).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:`artifacts/v1-2/screenshots/${name}-${width}.png`,fullPage:true});
  }
}
for(const [role,email] of [['USER','user@mobiflow.local'],['STAFF','staff.iot@mobiflow.local'],['MANAGER','manager@mobiflow.local']])test(`M11/M12 ${role} real KPI/DTO agreement, canonical detail, responsive/axe and keyboard`,async({page})=>{
  const errors=[],external=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){if(/kaspersky-labs\.com/.test(m.text())&&/Content Security Policy|violates/.test(m.text()))external.push(m.text());else errors.push(m.text());}});page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED')&&!/kaspersky-labs\.com/.test(r.url()))failed.push(r.url());});
  const response=page.waitForResponse(r=>r.url().includes('/api/v1/dashboard/'+role.toLowerCase())&&r.status()===200);
  const listResponse=page.waitForResponse(r=>r.url().includes(role==='USER'?'/api/v1/requests/mine?':role==='STAFF'?'/api/v1/staff/work-queue?':'/api/v1/manager/requests?')&&r.status()===200);
  await signIn(page,email);const dashboard=dashboardResponseSchema.parse(await (await response).json()).data,list=requestListSchema.parse(await (await listResponse).json());
  for(const [key,value] of Object.entries(dashboard.metrics)){
    const label=key==='waitingForUser'&&role!=='USER'?'Chờ bổ sung':labels[key];
    const card=page.locator('.metric-grid article').filter({has:page.locator('span',{hasText:label})});await expect(card.locator('strong')).toHaveText(String(value));
  }
  await expect(page.getByText('Trong trang hiện tại',{exact:true})).toHaveCount(0);await expect(page.getByText('Còn ≤ 30 phút hoặc quá hạn')).toHaveCount(0);
  const before=await page.locator('.metric-grid article strong').allTextContents();
  const filtered=page.waitForResponse(r=>r.url().includes('status=IN_PROGRESS')&&r.status()===200);await page.locator('select[name="status"]').selectOption('IN_PROGRESS');await page.getByRole('button',{name:'Áp dụng',exact:true}).click();const filteredList=requestListSchema.parse(await (await filtered).json());
  await expect.poll(()=>page.locator('.metric-grid article strong').allTextContents()).toEqual(before);
  await inspect(page,role.toLowerCase()+'-dashboard');
  await page.setViewportSize({width:360,height:900});const trigger=page.getByRole('button',{name:'Mở menu'});await trigger.click();const dialog=page.getByRole('dialog',{name:'Menu điều hướng'});await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);await page.keyboard.press('Tab');expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await page.setViewportSize({width:1440,height:1000});
  const detail=filteredList.data.find(row=>row.sla)??list.data.find(row=>row.sla);expect(detail).toBeTruthy();
  const detailResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/requests/'+detail.id&&r.status()===200);
  await page.goto('/'+role.toLowerCase()+'/requests/'+detail.id);const dto=requestResponseSchema.parse(await (await detailResponse).json()).data;
  await expect(page.locator('.sla-card [data-sla-state]')).toHaveAttribute('data-sla-state',dto.sla.state);expect(dto.sla.state).toBe(dto.sla.status);expect(dto.sla.deadlineAt).toBe(dto.sla.dueAt);
  await inspect(page,role.toLowerCase()+'-detail');
  await page.keyboard.press('Home');await page.keyboard.press('Tab'); // Explicitly focus skip link for keyboard navigation.
  await page.getByRole('link',{name:'Đi tới nội dung'}).focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('main');
  expect(errors).toEqual([]);expect(failed).toEqual([]);await test.info().attach('external-csp-blocks',{body:JSON.stringify({count:external.length}),contentType:'application/json'});
});

test('M11 aggregate loading/error/retry is truthful and never displays invented zero metrics',async({page})=>{
  let release;const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/v1/dashboard/user',async route=>{await held;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'Tổng quan tạm thời không khả dụng.'},requestId:'11111111-1111-4111-8111-111111111111'})});});
  await signIn(page,'user@mobiflow.local');await expect(page.getByRole('status',{name:'Đang tải tổng quan'})).toBeVisible();await expect(page.locator('.metric-grid')).toHaveCount(0);
  release();await expect(page.getByRole('alert').filter({hasText:'Không thể tải dữ liệu'})).toBeVisible();await expect(page.locator('.metric-grid')).toHaveCount(0);
  await page.unroute('**/api/v1/dashboard/user');await page.getByRole('button',{name:'Thử lại',exact:true}).click();await expect(page.locator('.metric-grid article')).toHaveCount(7);
});
