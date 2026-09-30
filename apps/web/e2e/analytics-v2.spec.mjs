import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {analyticsResponseSchema} from '@mobiflow/contracts';
import {signIn} from './m4-helpers.mjs';
/* global document,window */

const analyticsResponse=page=>page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/analytics'&&response.status()===200);
async function apply(page){const response=analyticsResponse(page);await page.getByRole('button',{name:'Áp dụng',exact:true}).click();return analyticsResponseSchema.parse(await (await response).json()).data;}
async function custom(page,from='2026-03-01',to='2026-03-04'){
  await page.getByRole('combobox',{name:'Khoảng thời gian',exact:true}).selectOption('custom');await page.getByLabel('Từ ngày (bao gồm)',{exact:true}).fill(from);await page.getByLabel('Đến ngày (không gồm)',{exact:true}).fill(to);return apply(page);
}
const formatted=value=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(value);
async function agree(page,data){
  await expect(page.locator('[data-metric="createdCount"] strong')).toHaveText(formatted(data.operations.createdCount));
  await expect(page.locator('[data-metric="resolvedCount"] strong')).toHaveText(formatted(data.operations.resolvedCount));
  await expect(page.locator('[data-metric="slaComplianceRate"] strong')).toHaveText(data.sla.slaComplianceRate===null?'Chưa có mẫu':formatted(data.sla.slaComplianceRate*100)+'%');
}
async function axe(page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();const serious=result.violations.filter(item=>['serious','critical'].includes(item.impact));expect(serious).toEqual([]);return {violations:result.violations.length,seriousCritical:serious.length};}

test('M13 manager real fixture/API agreement, presets, custom filters, keyboard and responsive/Axe smoke',async({page})=>{
  const errors=[],failed=[],external=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'){if(/kaspersky-labs\.com/.test(message.text()))external.push(message.text());else errors.push(message.text());}});
  page.on('requestfailed',request=>{if(!/ERR_ABORTED/.test(request.failure()?.errorText??'')&&!/kaspersky-labs\.com/.test(request.url()))failed.push(request.url());});
  await signIn(page,'manager@mobiflow.local');let response=analyticsResponse(page);await page.goto('/manager/analytics');let data=analyticsResponseSchema.parse(await (await response).json()).data;
  await expect(page.getByRole('heading',{name:'Analytics vận hành',exact:true})).toBeVisible();await agree(page,data);
  const presetCounts=[];for(const preset of ['7d','30d','90d']){await page.getByRole('combobox',{name:'Khoảng thời gian',exact:true}).selectOption(preset);data=await apply(page);expect(data.period.days).toBe(Number(preset.slice(0,-1)));await agree(page,data);presetCounts.push(data.operations.createdCount);}
  expect(presetCounts[0]).toBeLessThan(presetCounts[1]);expect(presetCounts[1]).toBeLessThan(presetCounts[2]);
  data=await custom(page);expect(data.operations.createdCount).toBe(7);expect(data.operations.resolvedCount).toBe(6);expect(data.sla.slaComplianceRate).toBe(1/3);await agree(page,data);await expect(page.locator('[data-metric="averageResolutionSeconds"] strong')).toHaveText('8 giờ 22 phút');
  const decisions=page.getByRole('table',{name:'Phân bố quyết định trong kỳ'});for(const label of ['Chấp nhận','Sửa','Từ chối']){const row=decisions.getByRole('row').filter({hasText:label});await expect(row.getByRole('cell').first()).toHaveText('1');await expect(row.getByRole('cell').last()).toHaveText('33,3%');}
  await expect(page.locator('.analytics-copilot-summary')).toContainText('10 lượt');await expect(page.getByText('Điểm trung bình',{exact:true}).locator('..').locator('dd')).toHaveText('4');
  await expect(page.getByRole('heading',{name:'Đánh giá phát triển gần nhất'})).toBeVisible();await expect(page.getByText(/Bằng chứng synthetic\/dev/)).toBeVisible();
  const sizes=[];for(const width of [360,768,1440,1920]){
    await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    sizes.push({width,overflow:false,...await axe(page)});await page.screenshot({path:`artifacts/m13/screenshots/analytics-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('link',{name:'Đi tới nội dung'}).focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('main');
  await page.getByText('Xem số liệu từng ngày',{exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('table',{name:'Số lượng theo ngày Việt Nam'})).toBeVisible();await expect(page.getByRole('table',{name:'Số lượng theo ngày Việt Nam'}).getByRole('row')).toHaveCount(4);
  data=await custom(page,'2026-03-02','2026-03-03');expect(data.trends).toHaveLength(1);await agree(page,data);await expect(page.locator('circle[data-series]')).toHaveCount(2);await page.getByText('Xem số liệu từng ngày',{exact:true}).click();await expect(page.getByRole('table',{name:'Số lượng theo ngày Việt Nam'}).getByRole('row')).toHaveCount(2);await page.screenshot({path:'artifacts/m13/screenshots/single-day-1440.png',fullPage:true});data=await custom(page);
  await page.getByRole('combobox',{name:'Ưu tiên',exact:true}).selectOption('HIGH');await page.getByRole('combobox',{name:'Trạng thái',exact:true}).selectOption('CLOSED');await page.getByRole('combobox',{name:'Danh mục',exact:true}).selectOption('NETWORK');const team=data.filterOptions.teams.find(row=>row.code==='NETWORK_OPERATIONS');await page.getByRole('combobox',{name:'Đội phụ trách',exact:true}).selectOption(team.id);
  data=await apply(page);expect(data.filters).toEqual({priority:'HIGH',status:'CLOSED',category:'NETWORK',teamId:team.id});expect(data.operations.createdCount).toBe(1);expect(data.operations.resolvedCount).toBe(2);await agree(page,data);
  expect(errors).toEqual([]);expect(failed).toEqual([]);mkdirSync('artifacts/m13',{recursive:true});writeFileSync('artifacts/m13/ui-smoke.json',JSON.stringify({sizes,presetCounts,customFixture:{created:7,resolved:6,compliance:1/3},keyboard:true,consoleErrors:errors,failedRequests:failed,externalCspBlocks:external.length},null,2));
});

test('M13 no-sample and empty states never present invented performance',async({page})=>{
  await signIn(page,'manager@mobiflow.local');const ready=analyticsResponse(page);await page.goto('/manager/analytics');await ready;
  await page.getByRole('combobox',{name:'Ưu tiên',exact:true}).selectOption('LOW');await page.getByRole('combobox',{name:'Trạng thái',exact:true}).selectOption('CLOSED');const data=await custom(page,'2026-03-03','2026-03-04');await agree(page,data);expect(data.sla.slaComplianceRate).toBeNull();await expect(page.locator('[data-metric="averageResolutionSeconds"] strong')).toHaveText('Chưa có mẫu');
  const empty=await custom(page,'2040-01-01','2040-01-08');expect(empty.operations.createdCount).toBe(0);await expect(page.getByRole('heading',{name:'Không có dữ liệu trong khoảng thời gian đã chọn'})).toBeVisible();await expect(page.locator('.analytics-kpi')).toHaveCount(0);await page.setViewportSize({width:360,height:900});await axe(page);await page.screenshot({path:'artifacts/m13/screenshots/empty-360.png',fullPage:true});
});

test('M13 loading, sanitized error, retry and invalid response handling',async({page})=>{
  await signIn(page,'manager@mobiflow.local');let release;const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/v1/analytics?*',async route=>{await held;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'SELECT PRIVATE_STACK_SECRET'},requestId:'11111111-1111-4111-8111-111111111111'})});});
  await page.goto('/manager/analytics');await expect(page.getByRole('status',{name:'Đang tải analytics'})).toBeVisible();await expect(page.locator('.analytics-kpi')).toHaveCount(0);await axe(page);
  release();await expect(page.locator('.analytics-page').getByRole('alert').filter({hasText:'Không thể tải dữ liệu'})).toBeVisible();await expect(page.locator('.analytics-kpi')).toHaveCount(0);await expect(page.getByText('SELECT PRIVATE_STACK_SECRET')).toHaveCount(0);await axe(page);
  await page.unroute('**/api/v1/analytics?*');let ready=analyticsResponse(page);await page.getByRole('button',{name:'Thử lại',exact:true}).click();await agree(page,analyticsResponseSchema.parse(await (await ready).json()).data);
  await page.route('**/api/v1/analytics?*',route=>route.fulfill({status:200,contentType:'application/json',body:'{"data":{"private":"RAW_INTERNAL_M13"}}'}));await page.getByRole('button',{name:'Áp dụng',exact:true}).click();await expect(page.locator('.analytics-page').getByRole('alert')).toContainText('Dữ liệu dịch vụ không hợp lệ');await expect(page.getByText('RAW_INTERNAL_M13')).toHaveCount(0);
});

test('M13 custom validation prevents requests and superseded responses cannot overwrite the latest range',async({page})=>{
  await signIn(page,'manager@mobiflow.local');const ready=analyticsResponse(page);await page.goto('/manager/analytics');const initial=await (await ready).json();
  await page.getByRole('combobox',{name:'Khoảng thời gian',exact:true}).selectOption('custom');await page.getByLabel('Từ ngày (bao gồm)',{exact:true}).fill('2026-03-04');await page.getByLabel('Đến ngày (không gồm)',{exact:true}).fill('2026-03-01');let requests=0;const count=request=>{if(new URL(request.url()).pathname==='/api/v1/analytics')requests++;};page.on('request',count);
  await page.getByRole('button',{name:'Áp dụng',exact:true}).click();await expect(page.locator('.analytics-page').getByRole('alert')).toContainText('tối đa 365 ngày');expect(requests).toBe(0);page.off('request',count);
  let release,seen;const held=new Promise(resolve=>{release=resolve;}),called=new Promise(resolve=>{seen=resolve;});
  await page.route('**/api/v1/analytics?preset=7d',async route=>{seen();await held;const old=JSON.parse(JSON.stringify(initial));old.data.operations.createdCount=9999;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(old)});}catch{/* Canceled request is expected. */}});
  await page.getByRole('combobox',{name:'Khoảng thời gian',exact:true}).selectOption('7d');await page.getByRole('button',{name:'Áp dụng',exact:true}).click();await called;await expect(page.getByRole('status',{name:'Đang tải analytics'})).toBeVisible();
  await page.getByRole('combobox',{name:'Khoảng thời gian',exact:true}).selectOption('90d');const latest=await apply(page);await agree(page,latest);release();await expect(page.getByTestId('analytics-period')).toContainText('90 ngày');await expect(page.locator('[data-metric="createdCount"] strong')).toHaveText(formatted(latest.operations.createdCount));await expect(page.getByText('9.999',{exact:true})).toHaveCount(0);
});
