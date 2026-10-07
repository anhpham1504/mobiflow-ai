import { expect } from '@playwright/test';
import { test, axe, login, noOverflow } from './remediation-support.mjs';

const paths={USER:'/user/requests',STAFF:'/staff/work-queue',MANAGER:'/manager/requests'};
for (const role of ['USER','STAFF','MANAGER']) test(`Phase C: current-page Unicode search, labels and page context for ${role}`,async ({page},testInfo)=>{
  const calls=[];
  page.on('request',request=>{if(request.url().includes('/api/v1/')&&request.method()==='GET')calls.push(request.url());});
  await login(page,role); await page.goto(paths[role]);
  const links=page.locator('.data-table .request-title');
  await expect(links.first()).toBeVisible();
  const texts=await links.allTextContents(), initial=texts.length,search=page.getByRole('searchbox',{name:'Tìm trong trang'});
  const unicode=texts.find(text=>/[À-ỹđĐ]/.test(text));
  expect(unicode).toBeTruthy();
  const baselineCalls=calls.length;
  for(const query of ['',texts[0].slice(0,6),unicode.slice(0,12),'  '+unicode.slice(0,12)+'  ','không tìm thấy 9z9z9z','x'.repeat(1000)]){
    await search.fill(query);
    const count=texts.filter(text=>text.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).length;
    await expect(links).toHaveCount(count);
    await search.press('Enter'); await expect(search).toHaveValue(query); await expect(links).toHaveCount(count);
    if(count===0) await expect(page.getByRole('heading',{name:'Không có yêu cầu phù hợp',exact:true})).toBeVisible();
  }
  expect(calls.length).toBe(baselineCalls);
  await page.getByRole('button',{name:'Xóa tìm kiếm',exact:true}).click(); await expect(search).toHaveValue(''); await expect(links).toHaveCount(initial);
  await expect(page.getByRole('combobox',{name:'Ưu tiên',exact:true}).getByRole('option',{name:'Cao',exact:true})).toHaveAttribute('value','HIGH');
  await expect(page.getByRole('combobox',{name:'Nhóm vấn đề',exact:true}).getByRole('option',{name:'Mạng',exact:true})).toHaveAttribute('value','NETWORK');
  await expect(page.locator('.topbar-context strong')).not.toHaveText('Không gian làm việc');
  await expect(page).toHaveTitle(/ — MobiFlow AI$/);
  await expect(page.getByRole('link',{name:'MobiFlow AI — Trang chủ',exact:true})).toHaveAttribute('href','/'+role.toLowerCase()+'/dashboard');
  await axe(page,testInfo,role+'-request-list'); await noOverflow(page);
  const id=role==='USER'?'60000000-0000-4000-8000-000000000002':role==='STAFF'?'60000000-0000-4000-8000-000000000005':'25e78cde-aef9-4ff4-9bae-805d89e1b6ac';
  await page.goto('/'+role.toLowerCase()+'/requests/'+id);
  const breadcrumb=page.getByRole('navigation',{name:'Đường dẫn yêu cầu',exact:true});
  await expect(breadcrumb).toBeVisible(); await expect(breadcrumb.getByRole('link')).toHaveAttribute('href',paths[role]);
  const code=await page.locator('.request-code').textContent();
  await expect(page).toHaveTitle('Yêu cầu '+code+' — MobiFlow AI');
  expect(await page.title()).not.toContain(id);
  await expect(page.locator('.topbar-context strong')).toHaveText('Chi tiết yêu cầu');
  await expect(page.locator('.request-state-summary')).toHaveCount(0);
  for(const label of await page.locator('.timeline > li > strong').allTextContents())expect(label).not.toMatch(/^[A-Z][A-Z_]+$/);
  await axe(page,testInfo,role+'-detail-labels');
  await breadcrumb.getByRole('link').click(); await expect(page).toHaveURL(new RegExp(paths[role]+'$'));
});

for(const role of ['USER','MANAGER']) test(`Phase C: live cursor pagination, search, Back/Forward and filter reset for ${role}`,async({page},testInfo)=>{
  const pages=[],queries=[];
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/v1'+(role==='USER'?'/requests/mine':'/manager/requests'))queries.push(Object.fromEntries(url.searchParams));});
  await login(page,role);await page.goto(paths[role]);
  const pagination=page.getByRole('navigation',{name:'Phân trang yêu cầu'}),previous=pagination.getByRole('button',{name:'Trang trước',exact:true}),next=pagination.getByRole('button',{name:'Trang tiếp theo',exact:true}),search=page.getByRole('searchbox',{name:'Tìm trong trang'});
  await expect(pagination).toContainText('Trang 1 ·');await expect(previous).toBeDisabled();await expect(next).toBeEnabled();
  const code=await page.locator('.data-table .request-title small').first().innerText();
  await search.fill(code);await search.press('Enter');await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await next.focus();await page.keyboard.press('Enter');await expect(pagination).toContainText('Trang 2 ·');await expect(search).toHaveValue(code);
  await expect(previous).toBeEnabled();await expect(page.getByRole('heading',{name:'Không có yêu cầu phù hợp',exact:true})).toBeVisible();
  await previous.focus();await page.keyboard.press('Enter');await expect(pagination).toContainText('Trang 1 ·');await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.goBack();await expect(pagination).toContainText('Trang 2 ·');await expect(search).toHaveValue(code);
  await page.goForward();await expect(pagination).toContainText('Trang 1 ·');await expect(search).toHaveValue(code);
  await page.getByRole('button',{name:'Xóa tìm kiếm',exact:true}).click();
  await expect(search).toHaveValue('');await expect(page.locator('.data-table tbody tr')).toHaveCount(20);
  let number=1;
  while(await next.isEnabled()){
    expect(number).toBeLessThan(30);await next.click();number++;
    await expect(pagination).toContainText('Trang '+number+' ·');await expect(previous).toBeEnabled();
    pages.push({number,rows:await page.locator('.data-table tbody tr').count(),cursor:new URL(page.url()).searchParams.get('cursor')});
  }
  expect(number).toBeGreaterThan(2);await expect(pagination).toContainText('Đã đến cuối danh sách');
  await previous.click();await expect(pagination).toContainText('Trang '+(number-1)+' ·');
  const firstDetail=page.locator('.data-table .request-title').first();await firstDetail.click();
  await expect(page.getByRole('navigation',{name:'Đường dẫn yêu cầu'})).toBeVisible();
  await page.goBack();await expect(pagination).toContainText('Trang '+(number-1)+' ·');await expect(previous).toBeEnabled();
  await page.getByRole('combobox',{name:'Ưu tiên',exact:true}).selectOption('HIGH');
  const filtered=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/v1'+(role==='USER'?'/requests/mine':'/manager/requests')&&url.searchParams.get('priority')==='HIGH';});
  await page.getByRole('button',{name:'Áp dụng',exact:true}).click();expect((await filtered).status()).toBe(200);
  await expect(pagination).toContainText('Trang 1 ·');await expect(previous).toBeDisabled();expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
  await search.fill('  không có kết quả 9z9z  ');await search.press('Enter');await expect(search).toHaveValue('  không có kết quả 9z9z  ');
  expect(new URL(page.url()).searchParams.get('priority')).toBe('HIGH');
  for(const query of queries){expect(query.limit).toBe('20');expect(query).not.toHaveProperty('search');expect(query).not.toHaveProperty('page');}
  await testInfo.attach('cursor-pages',{body:JSON.stringify({pages,queries}),contentType:'application/json'});await noOverflow(page);
});

test('Phase C: manager localized manual classification and routing values retain raw enums',async({page},testInfo)=>{
  const writes=[];page.on('request',request=>{if(request.method()!=='GET'&&/\/api\/v1\/(manager|routing-rules|templates|requests)/.test(new URL(request.url()).pathname))writes.push(request.url());});
  await login(page,'MANAGER');await page.goto('/manager/requests/25e78cde-aef9-4ff4-9bae-805d89e1b6ac');
  const manual=page.locator('#manual-request-plan');await expect(manual).toBeVisible();
  for(const [name,label,value]of [['Nhóm vấn đề','Mạng','NETWORK'],['Phân loại chi tiết','Kết nối IoT','IOT_CONNECTIVITY'],['Ưu tiên đề xuất','Cao','HIGH']])await expect(manual.getByRole('combobox',{name,exact:true}).getByRole('option',{name:label,exact:true})).toHaveAttribute('value',value);
  await page.goto('/manager/routing-rules');await expect(page).toHaveTitle('Quy tắc định tuyến — MobiFlow AI');
  const create=page.getByRole('button',{name:'Tạo quy tắc',exact:true});await expect(create).toBeEnabled();await create.click();
  await expect(page.getByRole('combobox',{name:'Giá trị 1',exact:true})).toHaveValue('MEDIUM');
  await expect(page.getByRole('combobox',{name:'Giá trị 1',exact:true}).getByRole('option',{name:'Trung bình',exact:true})).toHaveAttribute('value','MEDIUM');
  await page.getByRole('combobox',{name:'Trường 1',exact:true}).selectOption('category');
  await expect(page.getByRole('combobox',{name:'Giá trị 1',exact:true})).toHaveValue('NETWORK');
  await expect(page.getByRole('combobox',{name:'Giá trị 1',exact:true}).getByRole('option',{name:'Mạng',exact:true})).toHaveAttribute('value','NETWORK');
  await axe(page,testInfo,'localized-routing-editor');expect(writes).toEqual([]);
});
