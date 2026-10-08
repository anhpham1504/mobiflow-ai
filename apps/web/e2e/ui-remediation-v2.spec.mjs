/* global document, Node */
import { expect } from '@playwright/test';
import { test, axe, login, noOverflow } from './remediation-support.mjs';

const fields = {
  USER: [['Cần phản hồi','waitingForUser'],['Chờ xác nhận','resolved'],['Đang mở','openRequests'],['Đang xử lý','inProgress'],['Đã đóng','closed'],['SLA có nguy cơ','slaAtRisk'],['SLA quá hạn','slaBreached']],
  STAFF: [['Công việc đang hoạt động','active'],['SLA có nguy cơ','slaAtRisk'],['SLA quá hạn','slaBreached'],['Được phân công','assignedToMe'],['Chờ bổ sung','waitingForUser'],['Đã giải quyết hôm nay','resolvedToday']],
  MANAGER: [['Chờ duyệt','pendingApproval'],['Chưa phân công','unassigned'],['SLA quá hạn','slaBreached'],['Đang mở','open'],['SLA có nguy cơ','slaAtRisk'],['Đã giải quyết hôm nay','resolvedToday']],
};
for (const role of ['USER','STAFF','MANAGER']) test(`Visual V2: ${role} dashboard preserves every live aggregate at mobile and desktop`, async ({page},testInfo) => {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/dashboard/' + role.toLowerCase() && r.status() === 200);
  await login(page, role);
  const data = (await (await response).json()).data;
  expect(data.role).toBe(role);
  const metrics = page.getByRole('region', {name:'Tổng quan trong phạm vi được phép',exact:true});
  await expect(metrics).toBeVisible();
  for (const [width,height] of [[390,844],[1440,900]]) {
    await page.setViewportSize({width,height});
    for (const [label,key] of fields[role]) {
      const metric = metrics.locator('article, dl > div').filter({has:page.getByText(label,{exact:true})});
      await expect(metric).toHaveCount(1);
      await expect(metric.locator('strong, dd')).toHaveText(String(data.metrics[key]));
      await expect(metric).toBeVisible();
    }
    await noOverflow(page);
  }
  await axe(page,testInfo,role+'-v2-dashboard');
});

for (const [role,id,label] of [
  ['USER','60000000-0000-4000-8000-000000000002','Lý do'],
  ['STAFF','f6ed710c-7d6e-40bb-ae4b-b17625a60ff7','Nguyên nhân'],
  ['MANAGER','25e78cde-aef9-4ff4-9bae-805d89e1b6ac','Lý do phương án / lý do để trống checklist'],
]) test(`Visual V2: ${role} mobile commands precede evidence and history disclosure preserves drafts`, async ({page},testInfo) => {
  await login(page,role); await page.setViewportSize({width:390,height:844});
  await page.goto('/'+role.toLowerCase()+'/requests/'+id);
  const commands = page.getByRole('region',{name:'Thao tác',exact:true});
  await expect(commands).toBeVisible();
  const input = commands.getByLabel(label,{exact:true});
  const draft = 'Bản nháp synthetic kiểm tra bố cục — không gửi.';
  await input.fill(draft);
  const readingOrder = await page.evaluate(() => {
    const overview=document.querySelector('.request-overview'),context=document.querySelector('.request-context-column'),support=document.querySelector('#request-support');
    return {overviewBeforeContext:!!(overview.compareDocumentPosition(context)&Node.DOCUMENT_POSITION_FOLLOWING),contextBeforeSupport:!!(context.compareDocumentPosition(support)&Node.DOCUMENT_POSITION_FOLLOWING),overviewBottom:overview.getBoundingClientRect().bottom,contextTop:context.getBoundingClientRect().top,supportTop:support.getBoundingClientRect().top,contextBottom:context.getBoundingClientRect().bottom};
  });
  expect(readingOrder.overviewBeforeContext).toBe(true);
  expect(readingOrder.contextBeforeSupport).toBe(true);
  expect(readingOrder.contextTop).toBeGreaterThanOrEqual(readingOrder.overviewBottom);
  expect(readingOrder.supportTop).toBeGreaterThanOrEqual(readingOrder.contextBottom);
  const history=page.locator('.request-history'),summary=history.locator(':scope > summary');
  await expect(history).not.toHaveAttribute('open');
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(history).toHaveAttribute('open');
  await expect(history.locator('.timeline > li').first()).toBeVisible();
  const count=await history.locator('.timeline > li').count(); expect(count).toBeGreaterThan(0);
  await axe(page,testInfo,role+'-v2-open-history');
  await summary.focus(); await page.keyboard.press('Space');
  await expect(history).not.toHaveAttribute('open');
  await expect(input).toHaveValue(draft);
  if(role!=='USER')await expect(page.getByLabel('Nội dung tin nhắn',{exact:true})).toBeVisible();
  await page.setViewportSize({width:1440,height:900});
  await expect(input).toHaveValue(draft); await noOverflow(page);
  const desktop=await page.evaluate(()=>({overviewLeft:document.querySelector('.request-overview').getBoundingClientRect().left,contextLeft:document.querySelector('.request-context-column').getBoundingClientRect().left}));
  expect(desktop.contextLeft).toBeGreaterThan(desktop.overviewLeft);
  await testInfo.attach('visual-v2-reading-order',{body:JSON.stringify({role,readingOrder,desktop,historyEvents:count}),contentType:'application/json'});
});

test('Visual V2: knowledge upload disclosure supports keyboard browsing without losing input',async({page},testInfo)=>{
  await login(page,'MANAGER'); await page.setViewportSize({width:390,height:844}); await page.goto('/manager/knowledge');
  await expect(page.getByText('Đang tải thư viện…',{exact:true})).toHaveCount(0);
  const disclosure=page.locator('.library-disclosure'),summary=disclosure.locator(':scope > summary');
  await expect(disclosure).not.toHaveAttribute('open');
  await expect(page.getByRole('region',{name:'Danh sách tài liệu',exact:true})).toBeVisible();
  await summary.focus(); await page.keyboard.press('Enter');
  const title=page.getByLabel('Tiêu đề tài liệu',{exact:true}); await title.fill('Tài liệu synthetic chưa tải lên');
  await axe(page,testInfo,'v2-knowledge-open-upload');
  await summary.focus(); await page.keyboard.press('Space'); await expect(disclosure).not.toHaveAttribute('open');
  await summary.press('Enter'); await expect(title).toHaveValue('Tài liệu synthetic chưa tải lên'); await noOverflow(page);
});

test('Visual V2: additional analytics filters remain keyboard reachable with selected values',async({page},testInfo)=>{
  await login(page,'MANAGER'); await page.setViewportSize({width:390,height:844}); await page.goto('/manager/analytics');
  await expect(page.getByTestId('analytics-period')).toBeVisible();
  const disclosure=page.locator('.analytics-extra-filters'),summary=disclosure.locator(':scope > summary');
  await expect(disclosure).not.toHaveAttribute('open'); await summary.press('Enter');
  const priority=disclosure.getByRole('combobox',{name:'Ưu tiên',exact:true}); await expect(priority).toBeVisible(); await priority.focus(); await page.keyboard.press('ArrowDown');
  const chosen=await priority.inputValue(); expect(chosen).not.toBe('');
  await summary.focus(); await page.keyboard.press('Space'); await summary.press('Enter');
  await expect(priority).toHaveValue(chosen); await noOverflow(page); await axe(page,testInfo,'v2-analytics-open-filters');
});
