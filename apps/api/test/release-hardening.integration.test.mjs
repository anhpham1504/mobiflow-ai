import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createReleaseHarness,workflowSnapshot} from './helpers/release-hardening-fixture.mjs';
import {RoutingService} from '../dist/routing/routing.service.js';
import {SlaAlertService} from '../dist/requests/sla-alert.service.js';
import {AuthorizationPolicyService} from '../dist/authorization/authorization-policy.service.js';
import {AnalysisWorker} from '../dist/ai/analysis-worker.js';
import {RecommendationService} from '../dist/ai/recommendation.service.js';
import {OperationalAiService} from '../dist/ai/operational-ai.service.js';
import {DocumentService} from '../dist/knowledge/document.service.js';
import {IngestionWorker} from '../dist/knowledge/ingestion-worker.js';
let s,request,responseTemplate,checklistTemplate,view,rule,note;
const checks={},metrics={},privateBody='M24_PRIVATE_CANARY_qui_riêng_🙂';
const pass=name=>{checks[name]='PASS';};
const expected=r=>({expectedRevision:r.currentRevision,expectedRuleVersion:r.version});
before(async()=>{s=await createReleaseHarness(process.env.M24_DATABASE_URL);});
after(async()=>{mkdirSync('artifacts/m24',{recursive:true});writeFileSync('artifacts/m24/api-report.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,metrics,synthetic:true,deterministicAiCalls:s?Object.fromEntries(Object.entries(s.captured).map(([k,v])=>[k,v.length])):null,liveAi:'NOT RUN',rateWaitsSeconds:s?.rateWaitsSeconds},null,2));if(s)await s.close();});
const call=(actor,path,body,method,status)=>s.call(actor.token,path,body,method).then(r=>{assert.equal(r.status,status??(body===undefined?200:201),JSON.stringify(r.body));return r.body.data;});
async function business(id){const snapshot=await workflowSnapshot(s.prisma,id);delete snapshot.notification;return snapshot;}

test('M24 integrated templates/routing/collaboration/preferences require explicit human business commands',async()=>{
 responseTemplate=await call(s.manager,'/templates',{type:'RESPONSE',name:'M24 response',content:{body:'Phản hồi mẫu do người dùng chỉnh sửa.'}});
 checklistTemplate=await call(s.manager,'/templates',{type:'CHECKLIST',name:'M24 checklist',content:{items:[{text:'Kiểm tra APN',required:false}]}});
 request=await s.create('integrated');const before=await workflowSnapshot(s.prisma,request.id),routing=s.app.get(RoutingService),targets=await routing.targets(s.manager.actor,{});
 assert.equal((await routing.evaluate(request.id,s.manager.actor)).status,'NO_MATCH');
 const definition={name:'M24 routing',priority:10,target:{type:'TEAM',id:targets[0].id},conditions:[{field:'priority',operator:'EQ',values:['MEDIUM']}]};
 rule=await routing.create(s.manager.actor,definition,randomUUID());rule=await routing.lifecycle(rule.id,s.manager.actor,expected(rule),'ACTIVE',randomUUID());
 assert.equal((await routing.evaluate(request.id,s.manager.actor)).status,'MATCH');
 let conflict=await routing.create(s.manager.actor,{...definition,name:'M24 conflict',target:{type:'TEAM',id:targets[1].id}},randomUUID());conflict=await routing.lifecycle(conflict.id,s.manager.actor,expected(conflict),'ACTIVE',randomUUID());
 assert.equal((await routing.evaluate(request.id,s.manager.actor)).status,'CONFLICT');await routing.lifecycle(conflict.id,s.manager.actor,expected(conflict),'INACTIVE',randomUUID());
 await call(s.manager,'/templates/'+checklistTemplate.id);assert.deepEqual(await workflowSnapshot(s.prisma,request.id),before);
 const actions=[{text:'Bước đã được quản lý sửa',required:false,sourceIds:[],provenance:'HUMAN'}];
 request=await s.command(s.manager,'/manager/requests/'+request.id+'/triage',{expectedVersion:request.version,finalDecision:{...s.decision,actions},sourceTemplateRevisionId:checklistTemplate.current.id});
 assert.equal(request.currentAssignee,null);assert.equal(request.sla,null);assert.equal(await s.prisma.checklist.count({where:{requestId:request.id}}),0);
 await call(s.manager,'/templates/'+checklistTemplate.id+'/archive',{expectedRevision:1},'POST',200);
 request=await s.command(s.manager,'/manager/requests/'+request.id+'/submit-approval',{expectedVersion:request.version,manualDraftRevision:request.manualDraftRevision});
 assert.equal(await s.prisma.checklist.count({where:{requestId:request.id}}),0);
 request=await s.command(s.manager,'/manager/approvals/'+request.id+'/accept',{expectedVersion:request.version,reviewKind:'MANUAL',manualDraftRevision:request.pendingDraftRevision,acknowledgedMissingFields:[]});
 assert.equal(request.status,'ASSIGNED');assert.equal(request.checklist.sourceTemplateRevisionId,checklistTemplate.current.id);
 const assigned=await business(request.id);await call(s.staff,'/templates/'+responseTemplate.id);assert.deepEqual(await business(request.id),assigned);
 await call(s.manager,'/requests/'+request.id+'/watch',{},'PUT',200);
 note=await call(s.staff,'/requests/'+request.id+'/internal-notes',{body:privateBody,mentionedUserIds:[s.manager.actor.id]});
 assert.deepEqual(await business(request.id),assigned);
 const event=await s.prisma.auditLog.findFirstOrThrow({where:{resourceId:note.id}}),notices=await s.prisma.notification.findMany({where:{eventId:event.id}});
 assert.equal(notices.length,1);assert.equal(notices[0].recipientId,s.manager.actor.id);assert.equal(notices[0].type,'INTERNAL_NOTE_MENTION');
 view=await call(s.staff,'/saved-request-views',{name:'M24 assigned',filters:{status:'ASSIGNED'}});assert.deepEqual(await business(request.id),assigned);
 const rows=await call(s.staff,'/staff/work-queue?status=ASSIGNED');assert.ok(rows.some(r=>r.id===request.id));assert.ok(rows.every(r=>r.currentAssignee.id===s.staff.actor.id));
 const sent=await s.command(s.staff,'/requests/'+request.id+'/messages',{expectedVersion:request.version,body:'Nội dung cuối đã được nhân viên xác nhận.',sourceTemplateRevisionId:responseTemplate.current.id},201);
 assert.equal(sent.version,request.version+1);assert.equal((await s.prisma.requestMessage.findUniqueOrThrow({where:{id:sent.message.id}})).sourceTemplateRevisionId,responseTemplate.current.id);
 assert.equal(await s.prisma.notification.count({where:{requestId:request.id,type:'REQUEST_WATCH_ACTIVITY'}}),0);
 assert.equal((await s.call(s.staff.token,'/requests/'+request.id+'/messages',{expectedVersion:request.version,body:'Stale'})).status,409);
 request=await call(s.staff,'/requests/'+request.id);pass('humanControlAndIntegratedWorkflow');
});

test('M24 integrated RBAC/IDOR/current notifications and USER projection privacy',async()=>{
 for(const path of ['/requests/'+request.id+'/internal-notes','/requests/'+request.id+'/watch','/templates','/routing-rules'])assert.equal((await s.call(s.user.token,path)).status,403,path);
 for(const path of ['/requests/'+request.id,'/requests/'+request.id+'/internal-notes'])assert.equal((await s.call(s.otherStaff.token,path)).status,404,path);
 assert.equal((await s.call(s.staff.token,'/routing-rules')).status,403);assert.equal((await s.call(s.staff.token,'/templates',{type:'RESPONSE',name:'Denied',content:{body:'Denied'}})).status,403);
 assert.equal((await s.call(s.staff.token,'/templates/'+checklistTemplate.id)).status,404);
 for(const actor of [s.user,s.manager])assert.equal((await s.call(actor.token,'/saved-request-views/'+view.id)).status,404);
 assert.equal((await s.call(s.manager.token,'/requests/'+randomUUID()+'/routing/evaluate',{})).status,404);
 const forbidden=[privateBody,note.id,responseTemplate.id,responseTemplate.current.id,checklistTemplate.id,checklistTemplate.current.id,view.id,rule.id];
 for(const path of ['/requests/'+request.id,'/requests/'+request.id+'/history','/dashboard/user','/notifications']){
   const r=await s.call(s.user.token,path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const text=JSON.stringify(r.body);for(const value of forbidden)assert.equal(text.includes(value),false,path+' private data');
   assert.doesNotMatch(text,/INTERNAL_NOTE_MENTION|REQUEST_WATCH_ACTIVITY|SLA_(?:REMINDER|AT_RISK_ESCALATION|BREACH_ESCALATION)|sourceTemplateRevisionId|mentionedUserIds/);
 }
 await s.prisma.request.update({where:{id:request.id},data:{currentAssigneeId:s.otherStaff.actor.id}});
 assert.equal((await s.call(s.staff.token,'/requests/'+request.id+'/internal-notes')).status,404);
 const stale=await call(s.staff,'/notifications');assert.ok(!stale.some(r=>r.requestId===request.id&&/^(INTERNAL_NOTE_|REQUEST_WATCH_|SLA_)/.test(r.type)));
 await s.prisma.request.update({where:{id:request.id},data:{currentAssigneeId:s.staff.actor.id}});pass('rbacIdorPrivacyCurrentRecipients');
});

test('M24 actual AI builders exclude all V1.3 private objects with deterministic providers',async()=>{
 let fixture=await s.create('ai-isolation');await call(s.manager,'/requests/'+fixture.id+'/watch',{},'PUT',200);
 const canary=await call(s.manager,'/requests/'+fixture.id+'/internal-notes',{body:privateBody+' AI',mentionedUserIds:[]});
 const run=await s.machine.scheduleAnalysis(fixture.id,s.manager.actor,fixture.version,false,randomUUID());await s.app.get(AnalysisWorker).tick();assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}})).status,'SUCCEEDED');
 fixture=await s.prisma.request.findUniqueOrThrow({where:{id:fixture.id}});const docs=s.app.get(DocumentService);
 for(const doc of await s.prisma.knowledgeDocument.findMany({where:{status:{not:'DISABLED'}}}))await docs.command(doc.id,s.manager.actor,doc.version,'disable',randomUUID(),'Synthetic M24 isolation');
 const buffer=Buffer.from('Synthetic SOP: kiểm tra SIM và APN cho thiết bị IoT mất kết nối tại Amata.');
 const doc=await docs.upload(s.manager.actor,{title:'M24 synthetic SOP'},{originalname:'m24.txt',mimetype:'text/plain',buffer,size:buffer.length},randomUUID());await s.app.get(IngestionWorker).tick();assert.equal((await docs.detail(doc.id,s.manager.actor)).status,'READY');
 const recommendation=s.app.get(RecommendationService),rec=await recommendation.schedule(fixture.id,s.manager.actor,fixture.version,randomUUID());await recommendation.cycle(AbortSignal.timeout(30000));assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:rec.id}})).status,'SUCCEEDED');
 fixture=await s.assign(fixture);const before=await business(fixture.id),operations=s.app.get(OperationalAiService),copilot=await operations.scheduleCopilot(fixture.id,s.staff.actor,{expectedVersion:fixture.version,action:'SUMMARIZE_REQUEST'},randomUUID());
 for(let i=0;i<6&&['QUEUED','RUNNING'].includes((await s.prisma.aiRun.findUniqueOrThrow({where:{id:copilot.id}})).status);i++)await operations.cycle(AbortSignal.timeout(30000));assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:copilot.id}})).status,'SUCCEEDED');assert.deepEqual(await business(fixture.id),before);
 assert.ok(s.captured.intake.length&&s.captured.embedding.length&&s.captured.structured.length>=2);
 for(const value of [privateBody,canary.id,responseTemplate.id,checklistTemplate.id,rule.id,view.id,'RequestInternalNote','RequestWatcher','SavedRequestView','SlaOperationalAlert'])assert.equal(JSON.stringify(s.captured).includes(value),false,'Private AI context '+value);
 pass('deterministicAiIsolationNoProtectedWrites');
});

test('M24 bounded scheduler fairness, handoff, policy edit and persisted dedup',async()=>{
 const fixtures=[];
 for(let i=0;i<5;i++){
   const row=await s.assign(await s.create('fairness-'+i)),sla=await s.prisma.slaInstance.findUniqueOrThrow({where:{requestId:row.id}}),start=new Date(s.clock.now.getTime()-90000);
   await s.prisma.slaInstance.update({where:{id:sla.id},data:{startedAt:start,dueAt:new Date(start.getTime()+100000),targetSeconds:100,assessedAt:start}});fixtures.push({row,sla});
 }
 const policy=s.app.get(AuthorizationPolicyService),worker=new SlaAlertService(s.prisma,policy,{...s.env,SLA_ALERT_BATCH_SIZE:2},async()=>s.clock.now,()=>{}),before=await business(fixtures[0].row.id),ticks=[];
 for(let i=0;i<30;i++){const tick=await worker.tick();ticks.push(tick);assert.ok(tick.scanned<=2);if(await s.prisma.slaOperationalAlert.count({where:{requestId:{in:fixtures.map(f=>f.row.id)}}})===5)break;}
 assert.equal(await s.prisma.slaOperationalAlert.count({where:{requestId:{in:fixtures.map(f=>f.row.id)}}}),5);assert.ok(ticks.length>1);assert.deepEqual(await business(fixtures[0].row.id),before);
 const target=fixtures[0],events=await s.prisma.slaOperationalAlert.findMany({where:{requestId:target.row.id}});assert.equal(events.length,1);
 await s.prisma.request.update({where:{id:target.row.id},data:{currentAssigneeId:s.otherStaff.actor.id}});
 const restarted=new SlaAlertService(s.prisma,policy,{...s.env,SLA_ALERT_EARLY_RATIO:0.4},async()=>s.clock.now,()=>{});const delta=await restarted.observe(target.sla.id,target.row.id,[s.manager.actor.id]);assert.equal(delta.events,0);
 assert.equal(await s.prisma.slaOperationalAlert.count({where:{requestId:target.row.id}}),1);
 const notices=await s.prisma.notification.findMany({where:{slaAlertId:events[0].id}});assert.equal(new Set(notices.map(n=>n.recipientId)).size,notices.length);assert.ok(notices.some(n=>n.recipientId===s.otherStaff.actor.id));
 const current=await call(s.staff,'/notifications');assert.ok(!current.some(n=>n.requestId===target.row.id&&n.type.startsWith('SLA_')));
 metrics.scheduler={fixtures:5,batch:2,ticks:ticks.length,samples:ticks.map(t=>({scanned:t.scanned,durationMs:t.durationMs,events:t.events})),policyEditNewEvents:delta.events};pass('schedulerFairnessHandoffPolicyDedup');
});

test('M24 current guards reject strict/media/origin/payload/rate/session violations',async()=>{
 const path='/saved-request-views',body={name:'M24 guard',filters:{}};
 assert.equal((await s.call(s.staff.token,path,{...body,ownerUserId:s.manager.actor.id})).status,400);
 assert.equal((await s.call(s.staff.token,path,{...body,filters:{where:{}}})).status,400);
 assert.equal((await s.call(s.staff.token,path,body,'POST',{Origin:'https://invalid.example'})).status,403);
 assert.equal((await s.call(s.staff.token,path,body,'POST',{'Content-Type':'text/plain'})).status,415);
 assert.equal((await s.call(s.staff.token,path,{...body,name:'x'.repeat(70000)})).status,413);
 const seed=await s.prisma.user.findUniqueOrThrow({where:{id:s.staff.actor.id}}),row=await s.prisma.user.create({data:{id:randomUUID(),email:randomUUID()+'@synthetic.local',displayName:'M24 rate',passwordHash:seed.passwordHash,role:'STAFF'}}),actor=await s.login(row.email),original=Date.now;let now=original();Date.now=()=>now;
 try{for(let i=0;i<120;i++)assert.equal((await s.call(actor.token,path,undefined,'GET',{},1)).status,200);const limited=await s.call(actor.token,path,undefined,'GET',{},1);assert.equal(limited.status,429);const retry=Number(limited.headers.get('retry-after'));assert.ok(retry>0);now+=retry*1000+1;assert.equal((await s.call(actor.token,path)).status,200);await s.prisma.refreshSession.update({where:{id:actor.actor.sessionId},data:{revokedAt:new Date()}});assert.equal((await s.call(actor.token,path)).status,401);}finally{Date.now=original;}
 pass('transportRateSessionGuards');
});
