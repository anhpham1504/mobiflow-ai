import AxeBuilder from '@axe-core/playwright';
import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {recommendationResponseSchema,requestResponseSchema} from '@mobiflow/contracts';
import {signIn} from './m4-helpers.mjs';
/* global document,window,getComputedStyle */

const fixtures=JSON.parse(readFileSync('artifacts/m14/browser-fixtures.json','utf8'));
if(fixtures.runId!==process.env.M14_BROWSER_RUN_ID)throw new Error('Run this suite through the guarded M14 browser runner');
const panelOf=page=>page.getByRole('region',{name:'Đề xuất AI và quyết định của quản lý',exact:true});
const report=(name,data)=>writeFileSync('artifacts/m14/browser-'+name+'.json',JSON.stringify({runId:fixtures.runId,...data},null,2)+'\n');
async function managerLogin(page,scenario){
  const email=fixtures.managers[scenario];await signIn(page,email);
  // Page navigation rotates the UI refresh SID. API assertions use an independent real session,
  // so an intentionally consumed browser access token cannot contaminate the business assertions.
  const response=await fetch('http://localhost:3001/api/v1/auth/login',{method:'POST',headers:{Origin:'http://localhost:3000','X-CSRF-Protection':'1','Content-Type':'application/json'},body:JSON.stringify({email,password:'MobiFlowDemo!2026'})});
  expect(response.status).toBe(200);return (await response.json()).data.accessToken;
}
async function call(page,token,path,body){
  const response=await page.request.fetch('http://localhost:3001/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,Origin:'http://localhost:3000','X-CSRF-Protection':'1'},...(body===undefined?{}:{data:body})});
  return {status:response.status(),body:await response.json()};
}
async function job(page,token,id){const response=await call(page,token,'/manager/requests/'+id+'/ai/recommendation');expect(response.status).toBe(200);return recommendationResponseSchema.parse(response.body).data;}
async function detail(page,token,id){const response=await call(page,token,'/requests/'+id);expect(response.status).toBe(200);return requestResponseSchema.parse(response.body).data;}
const business=view=>({status:view.status,version:view.version,currentAssignee:view.currentAssignee,sla:view.sla,checklist:view.checklist,category:view.category,subcategory:view.subcategory,priority:view.priority});
async function open(page,name){await page.goto('/manager/requests/'+fixtures.requests[name].id);await expect(panelOf(page).getByRole('status')).not.toHaveText('Đang tải đề xuất…');return panelOf(page);}
async function generate(page,{keyboard=false}={}){
  const panel=panelOf(page),button=panel.getByRole('button',{name:'Tạo đề xuất AI',exact:true});
  if(keyboard){await page.keyboard.press('Tab');await button.focus();await expect(button).toBeFocused();expect(await button.evaluate(element=>parseFloat(getComputedStyle(element).outlineWidth)>0)).toBe(true);await page.keyboard.press('Enter');}else await button.click();
  await expect(panel.getByRole('status')).toContainText('AI đang tổng hợp');await expect(button).toBeDisabled();
  await expect(panel.getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toBeVisible({timeout:30000});return panel;
}
function observe(page,{expectedHttp=[]}={}){
  const errors=[],failed=[],external=[],expected=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()!=='error')return;const value=message.text();if(/kaspersky-labs\.com/.test(value))external.push(value);else if(expectedHttp.length&&/Failed to load resource/.test(value)&&expectedHttp.some(code=>value.includes(String(code))))expected.push(value);else errors.push(value);});
  page.on('requestfailed',request=>{if(!/ERR_ABORTED/.test(request.failure()?.errorText??'')&&!/kaspersky-labs\.com/.test(request.url()))failed.push(request.url());});
  return {errors,failed,external,expected};
}
function clean(observation){expect(observation.errors).toEqual([]);expect(observation.failed).toEqual([]);return {consoleErrors:observation.errors,failedRequests:observation.failed,expectedTransportConsoleErrors:observation.expected,externalCspBlocks:observation.external.length};}
async function axe(page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(result.violations.map(row=>({id:row.id,impact:row.impact,nodes:row.nodes.map(node=>node.target)}))).toEqual([]);return {violations:result.violations.length};}

test('M14 actual V2 generation and all three advisory decisions preserve business state; explicit manual approval applies the human plan',async({browser,page})=>{
  const observation=observe(page),token=await managerLogin(page,'reviews'),decisions=[];let modified;
  for(const [name,action,label]of [['accept','accept','Đã chấp nhận đề xuất'],['modify','modify','Đã chỉnh sửa đề xuất'],['reject','reject','Đã từ chối đề xuất']]){
    const id=fixtures.requests[name].id,panel=await open(page,name),before=business(await detail(page,token,id));await expect(panel).toContainText('Chưa có đề xuất.');
    await generate(page,{keyboard:name==='accept'});const original=await job(page,token,id);expect(original.schemaVersion).toBe('recommendation.v2');expect(original.stale).toBe(false);expect(original.recommendation).not.toHaveProperty('confidence');expect(business(await detail(page,token,id))).toEqual(before);
    await expect(panel.getByText('recommendation.v2',{exact:true})).toBeVisible();await expect(panel.getByRole('heading',{name:'Bước tiếp theo được đề xuất'})).toBeVisible();await expect(panel.getByRole('heading',{name:'Căn cứ của đề xuất'})).toBeVisible();await expect(panel.getByText(/Chấp nhận chỉ ghi nhận sự đồng ý/)).toBeVisible();await expect(panel).not.toContainText('điểm xếp hạng');await expect(panel).not.toContainText('chưa hiệu chuẩn');
    const source=panel.locator('.recommendation-evidence').getByRole('link').filter({hasText:'SOP M14 browser'}).first();await expect(source).toBeVisible();const href=await source.getAttribute('href');expect(href).toMatch(/\/knowledge\/sources\//);
    if(name==='accept'){await source.click();await expect(page.getByRole('heading',{name:'Nguồn tham chiếu',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'SOP M14 browser',exact:true})).toBeVisible();await page.goto('/manager/requests/'+id);await expect(panel.getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toBeVisible();}
    if(action==='modify'){
      const form=panel.getByRole('group',{name:'Quyết định của quản lý — sửa đề xuất',exact:true});
      await expect(form).toBeVisible();await form.getByRole('combobox',{name:'Ưu tiên cuối cùng',exact:true}).selectOption('MEDIUM');await form.getByRole('textbox',{name:'Kế hoạch do quản lý xác nhận',exact:true}).fill('Kế hoạch riêng do quản lý lập để kiểm tra thiết bị.');await form.getByRole('textbox',{name:'Lý do sửa',exact:true}).fill('Quản lý thay đổi phương án sau khi xem xét nguồn.');
      page.once('dialog',dialog=>dialog.accept());await form.getByRole('button',{name:'Lưu chỉnh sửa đề xuất',exact:true}).click();
    }else if(action==='reject'){
      const form=panel.getByRole('group',{name:'Từ chối đề xuất AI',exact:true});await form.getByLabel('Lý do từ chối',{exact:true}).fill('Quản lý không sử dụng phương án này.');page.once('dialog',dialog=>dialog.accept());await form.getByRole('button',{name:'Từ chối đề xuất AI',exact:true}).click();
    }else{page.once('dialog',dialog=>dialog.accept());await panel.getByRole('button',{name:'Chấp nhận đề xuất',exact:true}).click();}
    const reviewed=panel.getByRole('region',{name:'Quyết định của quản lý',exact:true});await expect(reviewed).toContainText(label);await expect(reviewed).toContainText('Đề xuất chưa được thực hiện.');await expect(reviewed.getByText(/Người review:/)).toBeVisible();expect(business(await detail(page,token,id))).toEqual(before);
    const after=await job(page,token,id);expect(after.recommendation).toEqual(original.recommendation);expect(after.reviewerId).toBeTruthy();expect(after.reviewedAt).toBeTruthy();expect(after.reviewStatus).toBe(action==='modify'?'MODIFIED':action==='reject'?'REJECTED':'ACCEPTED');
    if(action==='modify'){expect(after.finalDecision.actions[0].provenance).toBe('HUMAN');expect(after.finalDecision.priority).toBe('MEDIUM');modified=after;await expect(reviewed).toContainText('Kế hoạch riêng do quản lý lập');}
    if(action==='reject'){expect(after.managerChanges.reason).toBe('Quản lý không sử dụng phương án này.');await expect(reviewed).toContainText(after.managerChanges.reason);}
    decisions.push({decision:after.reviewStatus,requestStatus:before.status,requestVersion:before.version,noOperationalMutation:true,originalPreserved:true,humanProvenance:true});
  }
  const id=fixtures.requests.modify.id;await open(page,'modify');const panel=panelOf(page);await panel.getByRole('link',{name:'phần phân loại thủ công',exact:true}).click();const form=page.locator('#manual-request-plan');
  await form.getByRole('combobox',{name:'Phân loại chi tiết',exact:true}).selectOption('IOT_CONNECTIVITY');await form.getByRole('combobox',{name:'Ưu tiên đề xuất',exact:true}).selectOption('MEDIUM');await form.getByRole('combobox',{name:'Nhóm / Nhân sự xử lý',exact:true}).selectOption(modified.finalDecision.teamId+'|'+modified.finalDecision.staffId);await form.getByRole('textbox',{name:'Các bước xử lý (mỗi dòng một bước bắt buộc)',exact:true}).fill(modified.finalDecision.actions.map(item=>item.text).join('\n'));await form.getByRole('textbox',{name:'Lý do phương án / lý do để trống checklist',exact:true}).fill(modified.finalDecision.reason);await form.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();
  await expect(page.getByRole('button',{name:'Gửi duyệt phương án',exact:true})).toBeVisible();expect((await detail(page,token,id)).currentAssignee).toBeNull();await page.getByRole('button',{name:'Gửi duyệt phương án',exact:true}).click();await expect(page.getByRole('button',{name:'Duyệt và phân công',exact:true})).toBeVisible();expect((await detail(page,token,id)).currentAssignee).toBeNull();await page.getByRole('button',{name:'Duyệt và phân công',exact:true}).click();
  await expect(page.locator('.request-state-summary')).toContainText('Đã phân công');const assigned=await detail(page,token,id);expect(assigned.status).toBe('ASSIGNED');expect(assigned.currentAssignee.id).toBe(modified.finalDecision.staffId);expect(assigned.sla).toBeTruthy();expect(assigned.checklist.items[0].text).toBe(modified.finalDecision.actions[0].text);
  expect((await job(page,token,id)).recommendation).toEqual(modified.recommendation);
  const directory=await call(page,token,'/users/staff'),staffEmail=directory.body.data.find(staff=>staff.id===modified.finalDecision.staffId).email,staffContext=await browser.newContext();
  try{const staff=await staffContext.newPage();await signIn(staff,staffEmail);await staff.goto('/staff/requests/'+id);await expect(staff.getByRole('heading',{name:'Checklist đã duyệt',exact:true})).toBeVisible();await expect(staff.locator('.checklist-row')).toContainText(modified.finalDecision.actions[0].text);await expect(panelOf(staff)).toHaveCount(0);}finally{await staffContext.close();}
  await open(page,'history');await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI V1 — bản gốc',exact:true})).toBeVisible();await expect(panelOf(page).getByText('recommendation.v1',{exact:true})).toBeVisible();await expect(panelOf(page)).toContainText('chưa hiệu chuẩn');
  report('reviews',{provider:'deterministic test-only',decisions,manualBoundary:{draftNoAssignment:true,submittedNoAssignment:true,explicitApprovalAssigned:true,originalV2Preserved:true,staffSeesApprovedHumanChecklistOnly:true},historicalV1Readable:true,sourceUiReadable:true,keyboardGenerate:true,...clean(observation)});
});

test('M14 bounded model fixture failure and explicit retry; USER and STAFF cannot see the manager advisory panel',async({browser,page})=>{
  const observation=observe(page),token=await managerLogin(page,'states'),panel=await open(page,'retry'),id=fixtures.requests.retry.id,before=business(await detail(page,token,id));await panel.getByRole('button',{name:'Tạo đề xuất AI',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Chưa tạo được đề xuất',{timeout:30000});const failed=await job(page,token,id);expect(failed.status).toBe('FAILED');expect(failed.recommendation).toBeNull();expect(business(await detail(page,token,id))).toEqual(before);await generate(page);expect((await job(page,token,id)).status).toBe('SUCCEEDED');expect(business(await detail(page,token,id))).toEqual(before);
  const userContext=await browser.newContext(),staffContext=await browser.newContext();
  try{
    const user=await userContext.newPage(),staff=await staffContext.newPage();await signIn(user,'user@mobiflow.local');await user.goto('/user/requests/'+id);await expect(user.getByRole('heading',{name:'Nội dung yêu cầu',exact:true})).toBeVisible();await expect(panelOf(user)).toHaveCount(0);await signIn(staff,'staff.iot@mobiflow.local');await staff.goto('/staff/requests/'+id);await expect(staff.getByRole('main').getByRole('alert')).toContainText('Không tìm thấy');await expect(panelOf(staff)).toHaveCount(0);
  }finally{await userContext.close();await staffContext.close();}
  report('states',{actualQueuedJobFailure:true,invalidResultNotPublished:true,explicitRetrySucceeded:true,coreUnchanged:true,userPanelAbsent:true,unassignedStaffDenied:true,...clean(observation)});
});

test('M14 real long escaped V2 content, missing information, keyboard review and four-width Axe/overflow checks',async({page})=>{
  const observation=observe(page);await managerLogin(page,'responsive');const panel=await open(page,'escape');await generate(page);await expect(panel.locator('.recommendation-summary')).toContainText('<img src=x onerror="window.M14_XSS=true">');await expect(panel.locator('.recommendation-checklist')).toContainText('<script>window.M14_XSS=true</script>');expect(await page.evaluate(()=>window.M14_XSS)).toBeUndefined();await expect(panel.locator('img,script')).toHaveCount(0);
  const sizes=[];for(const width of [360,768,1440,1920]){
    await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);sizes.push({width,overflow:false,...await axe(page)});await page.screenshot({path:`artifacts/m14/screenshots/recommendation-v2-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('link',{name:'Đi tới nội dung',exact:true}).focus();await page.keyboard.press('Enter');expect(await page.evaluate(()=>document.activeElement?.id)).toBe('main');
  await open(page,'missing');await generate(page);await expect(panelOf(page).getByRole('heading',{name:'Thông tin cần bổ sung',exact:true})).toBeVisible();await expect(panelOf(page).locator('.recommendation-missing')).toContainText('Câu hỏi:');await expect(panelOf(page).locator('.recommendation-missing')).toContainText('Ảnh hưởng:');await expect(panelOf(page).locator('.recommendation-missing li')).toHaveCount(2);
  const accept=panelOf(page).getByRole('region',{name:'Chấp nhận đề xuất AI',exact:true});await accept.getByLabel(/Tôi hiểu đề xuất đang thiếu địa điểm/).check();await accept.getByLabel(/Tôi hiểu đề xuất đang thiếu thời điểm bắt đầu/).check();await accept.getByRole('button',{name:'Chấp nhận đề xuất',exact:true}).focus();await expect(accept.getByRole('button',{name:'Chấp nhận đề xuất',exact:true})).toBeFocused();page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Enter');await expect(panelOf(page).getByRole('region',{name:'Quyết định của quản lý'})).toContainText('Đã chấp nhận đề xuất');await axe(page);
  report('responsive',{escapedHtmlLiteral:true,noInjectedElementOrExecution:true,sizes,keyboardSkipLink:true,keyboardReview:true,missingQuestionsAndImpact:true,...clean(observation)});
});

test('M14 safe loading/invalid/permission-lost projections, real stale and superseded artifacts, and canceled request-switch responses',async({page})=>{
  const observation=observe(page,{expectedHttp:[403,503]}),token=await managerLogin(page,'race'),id=fixtures.requests.stale.id;await open(page,'stale');await generate(page);const original=await job(page,token,id),target='**/api/v1/manager/requests/'+id+'/ai/recommendation';
  let release,seen;const held=new Promise(resolve=>{release=resolve;}),called=new Promise(resolve=>{seen=resolve;});
  await page.route(target,async route=>{seen();await held;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'PRIVATE_STACK_M14'},requestId:fixtures.runId})});});
  await panelOf(page).getByRole('button',{name:'Tải lại đề xuất',exact:true}).click();await called;await expect(panelOf(page).getByRole('status')).toContainText('Đang tải đề xuất');await axe(page);release();await expect(panelOf(page).getByRole('alert')).toContainText('Không thể thực hiện yêu cầu');await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toHaveCount(0);await expect(page.getByText('PRIVATE_STACK_M14')).toHaveCount(0);
  await page.unroute(target);await panelOf(page).getByRole('button',{name:'Tải lại đề xuất',exact:true}).click();await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toBeVisible();
  await page.route(target,route=>route.fulfill({status:200,contentType:'application/json',body:'{"data":{"private":"RAW_INVALID_M14"}}'}));await panelOf(page).getByRole('button',{name:'Tải lại đề xuất',exact:true}).click();await expect(panelOf(page).getByRole('alert')).toContainText('Dữ liệu dịch vụ không hợp lệ');await expect(page.getByText('RAW_INVALID_M14')).toHaveCount(0);await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toHaveCount(0);
  await page.unroute(target);await page.route(target,route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:'FORBIDDEN',message:'PRIVATE_PERMISSION_M14'},requestId:fixtures.runId})}));await panelOf(page).getByRole('button',{name:'Tải lại đề xuất',exact:true}).click();await expect(panelOf(page).getByRole('status')).toContainText('không có quyền xem đề xuất');await expect(panelOf(page).getByRole('button',{name:'Tạo đề xuất AI',exact:true})).toHaveCount(0);await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toHaveCount(0);await page.unroute(target);await page.reload();await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toBeVisible();
  await generate(page);const latest=await job(page,token,id);expect(latest.aiRunId).not.toBe(original.aiRunId);const oldResponse=await call(page,token,'/manager/requests/'+id+'/ai/recommendation?aiRunId='+original.aiRunId),old=recommendationResponseSchema.parse(oldResponse.body).data;expect(old.stale).toBe(true);expect(old.recommendation).toEqual(original.recommendation);
  await page.route(target,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(oldResponse.body)}));await panelOf(page).getByRole('button',{name:'Tải lại đề xuất',exact:true}).click();await expect(panelOf(page).getByRole('alert')).toContainText('Đề xuất đã cũ.');await expect(panelOf(page).getByRole('button',{name:'Chấp nhận đề xuất',exact:true})).toBeDisabled();await page.unroute(target);
  const current=await detail(page,token,id);const message=await call(page,token,'/requests/'+id+'/messages',{expectedVersion:current.version,body:'Synthetic new human context after M14 recommendation.'});expect(message.status).toBe(201);await page.reload();await expect(panelOf(page).getByRole('alert')).toContainText('Đề xuất đã cũ.');await expect(panelOf(page).getByRole('button',{name:'Chấp nhận đề xuất',exact:true})).toBeDisabled();
  // Delayed response after navigation is a UI projection. Refresh rotation revokes the initiating SID;
  // its unfinished job must fail closed rather than publishing under a consumed session.
  const a=fixtures.requests.asyncA.id,b=fixtures.requests.asyncB.id;await open(page,'asyncA');let releasePost,seenPost;const heldPost=new Promise(resolve=>{releasePost=resolve;}),calledPost=new Promise(resolve=>{seenPost=resolve;});
  await page.route('**/api/v1/manager/requests/'+a+'/ai/recommend',async route=>{const response=await route.fetch();seenPost();await heldPost;try{await route.fulfill({response});}catch{/* Unmounted request cancels its operation signal. */}});
  await panelOf(page).getByRole('button',{name:'Tạo đề xuất AI',exact:true}).click();await calledPost;await open(page,'asyncB');await expect(panelOf(page)).toContainText('Chưa có đề xuất.');releasePost();await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toHaveCount(0);await expect(page).toHaveURL(new RegExp('/manager/requests/'+b+'$'));await page.unroute('**/api/v1/manager/requests/'+a+'/ai/recommend');
  await generate(page);const currentB=await job(page,token,b);expect(currentB.requestId).toBe(b);let releasePoll,seenPoll;const heldPoll=new Promise(resolve=>{releasePoll=resolve;}),calledPoll=new Promise(resolve=>{seenPoll=resolve;});
  await page.route('**/api/v1/manager/requests/'+b+'/ai/recommendation',async route=>{const response=await route.fetch();seenPoll();await heldPoll;try{await route.fulfill({response});}catch{/* Aborted superseded poll is expected. */}});
  await panelOf(page).getByRole('button',{name:'Tải lại đề xuất',exact:true}).click();await calledPoll;await open(page,'asyncA');releasePoll();await expect(page).toHaveURL(new RegExp('/manager/requests/'+a+'$'));await expect(panelOf(page).getByRole('status')).toContainText('Chưa tạo được đề xuất',{timeout:30000});const rotated=await job(page,token,a);expect(rotated.status).toBe('FAILED');expect(['UNAUTHORIZED','STALE_CONTEXT']).toContain(rotated.errorCode);await expect(panelOf(page).getByRole('heading',{name:'Đề xuất AI — bản gốc',exact:true})).toHaveCount(0);await page.unroute('**/api/v1/manager/requests/'+b+'/ai/recommendation');
  await generate(page);await expect(panelOf(page).locator('.recommendation-evidence')).toContainText(fixtures.requests.asyncA.publicCode);await expect(panelOf(page).locator('.recommendation-evidence')).not.toContainText(fixtures.requests.asyncB.publicCode);
  report('race',{uiTransportProjections:['held loading','503 sanitized failure + retry','invalid 200 rejected','403 clears payload and hides generate','real superseded artifact response','delayed generation/poll after navigation'],realSupersession:true,realRequestChangeStale:true,staleReviewDisabled:true,sessionRotationCancelsUnfinishedJob:true,explicitRetryAfterRotationSucceeded:true,canceledGenerationDoesNotPopulateNewRequest:true,canceledPollDoesNotPopulateNewRequest:true,...clean(observation)});
});
