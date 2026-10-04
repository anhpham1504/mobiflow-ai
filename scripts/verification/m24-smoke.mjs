import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {call,login,releaseDb,apiBase} from './m24-client.mjs';
import {saveEvidence} from './evidence.mjs';
const tokens=Object.fromEntries(await Promise.all([['user','user'],['staff','staff.iot'],['manager','manager'],['otherStaff','staff.network']].map(async([k,n])=>[k,await login(n)])));
const ids={user:'10000000-0000-4000-8000-000000000001',manager:'10000000-0000-4000-8000-000000000002',staff:'10000000-0000-4000-8000-000000000003',otherStaff:'10000000-0000-4000-8000-000000000004',team:'20000000-0000-4000-8000-000000000001'};
const command=async(role,path,body,status=200,method)=> (await call(tokens[role],path,body,method,status)).body.data;
const runId=randomUUID(),privateBody='M24 release private note '+runId;
const create=()=>command('user','/requests',{title:'M24 release '+randomUUID().slice(0,8),description:'Synthetic release: 17 SIM IoT mất kết nối tại Amata từ 8 giờ.'},201);
async function assign(row){row=await command('manager','/manager/requests/'+row.id+'/triage',{expectedVersion:row.version,finalDecision:{category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:ids.team,staffId:ids.staff,actions:[],acknowledgedMissingFields:[],reason:'Quản lý xác nhận phương án synthetic.'}});row=await command('manager','/manager/requests/'+row.id+'/submit-approval',{expectedVersion:row.version,manualDraftRevision:row.manualDraftRevision});return command('manager','/manager/approvals/'+row.id+'/accept',{expectedVersion:row.version,reviewKind:'MANUAL',manualDraftRevision:row.pendingDraftRevision,acknowledgedMissingFields:[]});}
const requests=[];for(let i=0;i<5;i++)requests.push(await assign(await create()));
const draft=await create(),row=requests[0];await command('manager','/requests/'+row.id+'/watch',{},200,'PUT');
await command('staff','/requests/'+row.id+'/internal-notes',{body:privateBody,mentionedUserIds:[ids.manager]},201);
const template=await command('manager','/templates',{type:'RESPONSE',name:'M24 release response '+runId.slice(0,8),content:{body:'Nội dung mẫu cần nhân viên kiểm tra trước khi gửi.'}},201);
const checklist=await command('manager','/templates',{type:'CHECKLIST',name:'M24 release checklist '+runId.slice(0,8),content:{items:[{text:'Kiểm tra cấu hình APN',required:false}]}},201);
let rule=await command('manager','/routing-rules',{name:'M24 release routing '+runId.slice(0,8),priority:10,target:{type:'TEAM',id:ids.team},conditions:[{field:'priority',operator:'EQ',values:['MEDIUM']}]},201);
rule=await command('manager','/routing-rules/'+rule.id+'/activate',{expectedRevision:rule.currentRevision,expectedRuleVersion:rule.version});
const view=await command('staff','/saved-request-views',{name:'M24 release assigned '+runId.slice(0,8),filters:{status:'ASSIGNED'}},201);
for(const role of ['user','staff','manager'])assert.equal((await call(tokens[role],'/dashboard/'+role)).status,200);
assert.equal((await call(tokens.manager,'/analytics?from=2026-10-01&to=2026-10-05')).status,200);
for(const path of ['/requests/'+row.id,'/requests/'+row.id+'/history','/dashboard/user','/notifications']){const r=await call(tokens.user,path);assert.equal(r.status,200);assert.ok(!JSON.stringify(r.body).includes(privateBody));assert.doesNotMatch(JSON.stringify(r.body),/sourceTemplateRevisionId|INTERNAL_NOTE_MENTION|mentionedUserIds/);}
assert.equal((await call(tokens.otherStaff,'/requests/'+row.id)).status,404);assert.equal((await call(tokens.manager,'/saved-request-views/'+view.id)).status,404);
assert.equal((await call(tokens.user,'/requests/'+row.id+'/internal-notes')).status,403);
const health=(await(await fetch(apiBase+'/health/ready')).json()).data;assert.equal(health.coreReady,true);assert.equal(health.aiReady,false);assert.equal(health.status,'DEGRADED');
const db=await releaseDb();try{for(const r of requests)await db.query('UPDATE "SlaInstance" SET "startedAt"=now()-interval \'90000 seconds\',"dueAt"=now()+interval \'10000 seconds\',"targetSeconds"=100000,"assessedAt"=now()-interval \'90000 seconds\' WHERE "requestId"=$1',[r.id]);}finally{await db.end();}
writeFileSync('artifacts/m24/production-fixtures.json',JSON.stringify({runId,tokens,ids,requests,draft,template,checklist,rule,view,privateBody},null,2));
await saveEvidence('docs/v1.3/evidence/M24_PRODUCTION_SMOKE.json',{checkedAt:new Date().toISOString(),result:'PASS',runId,production:true,synthetic:true,checks:{threeRoleLoginDashboard:'PASS',manualTriageSubmitApprove:'PASS',notesMentionsWatch:'PASS',templatesRoutingSavedViews:'PASS',privacyIdor:'PASS',managerAnalytics:'PASS',optionalAiDegraded:'PASS'},schedulerFixtures:requests.length,health});
console.log(JSON.stringify({event:'m24.production-smoke',result:'PASS',runId,requests:requests.length,coreReady:health.coreReady,aiReady:health.aiReady}));
