import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {cpus,totalmem,platform} from 'node:os';
import {Client} from 'pg';
import {createSlaAlertHarness,workflowSnapshot} from './helpers/sla-alert-fixture.mjs';
import {SlaAlertService} from '../dist/requests/sla-alert.service.js';
import {SlaMonitorService} from '../dist/requests/sla-monitor.service.js';
import {assessSla,changeSla,clockFields} from '../dist/requests/sla-clock.js';
import {slaStateSql,slaRemainingSql} from '../dist/requests/sla-sql.js';
import {Prisma} from '../dist/generated/prisma/client.js';
import {RoutingService} from '../dist/routing/routing.service.js';
let s,owner,worker;const checks={},metrics={};
before(async()=>{s=await createSlaAlertHarness(process.env.M22_DATABASE_URL);owner=new Client({connectionString:process.env.M22_OWNER_DATABASE_URL});await owner.connect();worker=s.app.get(SlaAlertService);});
after(async()=>{const aiCalls=s?Object.values(s.captured).reduce((n,v)=>n+v.length,0):null;mkdirSync('artifacts/m22',{recursive:true});writeFileSync('artifacts/m22/api-report.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,metrics,aiCalls,synthetic:true,environment:{platform:platform(),node:process.version,cpu:cpus()[0]?.model,cpuCount:cpus().length,memoryBytes:totalmem()},logsSafe:!s?.logs.some(e=>JSON.stringify(e).includes('passwordHash'))},null,2));if(owner)await owner.end();if(s)await s.close();});
async function fresh(seconds=50){const r=await s.assign(await s.create()),row=await s.prisma.slaInstance.findUniqueOrThrow({where:{requestId:r.id}});const start=new Date(s.clock.now.getTime()-seconds*1000);await s.prisma.slaInstance.update({where:{id:row.id},data:{startedAt:start,dueAt:new Date(start.getTime()+100000),targetSeconds:100,assessedAt:start}});return {request:r,sla:await s.prisma.slaInstance.findUniqueOrThrow({where:{id:row.id}})};}
const observe=f=>worker.observe(f.sla.id,f.request.id,[s.manager.actor.id]);
const alerts=f=>s.prisma.slaOperationalAlert.findMany({where:{requestId:f.request.id},orderBy:{observedAt:'asc'}});
const notices=f=>s.prisma.notification.findMany({where:{requestId:f.request.id,slaAlertId:{not:null}}});
async function business(id){const value=await workflowSnapshot(s.prisma,id);delete value.notification;return value;}
async function privateCounts(){const names=['requestInternalNote','requestInternalNoteMention','requestWatcher','operationalTemplate','operationalTemplateRevision','routingRule','routingRuleRevision','aiRun','aiAnalysis','aiRecommendation'];return Object.fromEntries(await Promise.all(names.map(async name=>[name,await s.prisma[name].count()])));}
function pass(name){checks[name]='PASS';}

test('M22 real progression boundaries, persisted dedup/config/restart and no protected business mutation',async()=>{
  const f=await fresh(49),before=await business(f.request.id);await owner.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)',[f.request.id,s.otherStaff.actor.id]);const privateBefore=await privateCounts(),routing=s.app.get(RoutingService),originalEvaluate=routing.evaluate;let routingCalls=0;routing.evaluate=async()=>{routingCalls++;throw new Error('M22 must never invoke routing');};assert.deepEqual(await observe(f),{events:0,notifications:0});
  for(const [seconds,type,recipients] of [[50,'SLA_REMINDER',1],[80,'SLA_AT_RISK_ESCALATION',2],[101,'SLA_BREACH_ESCALATION',2]]){
    s.clock.now=new Date(f.sla.startedAt.getTime()+seconds*1000);const actual=await observe(f);assert.equal(actual.events,1);assert.equal(actual.notifications,recipients);assert.equal((await alerts(f)).at(-1).eventType,type);assert.deepEqual(await observe(f),{events:0,notifications:0});
    const policy=s.app.get((await import('../dist/authorization/authorization-policy.service.js')).AuthorizationPolicyService);const edited=new SlaAlertService(s.prisma,policy,{...s.env,SLA_ALERT_EARLY_RATIO:0.4},async()=>s.clock.now,e=>s.logs.push(e));assert.deepEqual(await edited.observe(f.sla.id,f.request.id,[s.manager.actor.id]),{events:0,notifications:0});
    if(seconds===80){const disabled=new SlaAlertService(s.prisma,policy,{...s.env,SLA_ALERT_AT_RISK_ENABLED:false},async()=>s.clock.now,e=>s.logs.push(e));assert.deepEqual(await disabled.observe(f.sla.id,f.request.id,[s.manager.actor.id]),{events:0,notifications:0});assert.deepEqual(await observe(f),{events:0,notifications:0});}
  }
  const restarted=new SlaAlertService(s.prisma,s.app.get((await import('../dist/authorization/authorization-policy.service.js')).AuthorizationPolicyService),{...s.env,SLA_ALERT_EARLY_RATIO:0.4},async()=>s.clock.now,e=>s.logs.push(e));assert.deepEqual(await restarted.observe(f.sla.id,f.request.id,[s.manager.actor.id]),{events:0,notifications:0});
  routing.evaluate=originalEvaluate;assert.equal(routingCalls,0);assert.deepEqual(await privateCounts(),privateBefore);assert.equal((await alerts(f)).length,3);assert.equal((await notices(f)).length,5);assert.ok(!(await notices(f)).some(n=>n.recipientId===s.otherStaff.actor.id));assert.deepEqual(await business(f.request.id),before);
  const audits=await s.prisma.auditLog.findMany({where:{resourceType:'SlaOperationalAlert',resourceId:{in:(await alerts(f)).map(a=>a.id)}}});assert.equal(audits.length,3);assert.ok(audits.every(a=>a.actorType==='SYSTEM'&&a.actorId===null&&a.requestId===null));
  pass('progression_dedup_restart_business_immutability');
});
test('M22 startup skipped levels and observation time never fabricate earlier delivery',async()=>{
  for(const [seconds,type] of [[90,'SLA_AT_RISK_ESCALATION'],[101,'SLA_BREACH_ESCALATION']]){const f=await fresh(seconds);assert.equal((await observe(f)).events,1);const rows=await alerts(f);assert.equal(rows.length,1);assert.equal(rows[0].eventType,type);assert.equal(rows[0].observedAt.getTime(),s.clock.now.getTime());assert.equal(rows[0].deadlineAt.getTime(),assessSla(f.sla,s.clock.now).dueAt.getTime());assert.deepEqual(await observe(f),{events:0,notifications:0});}
  pass('startup_skipped_levels_current_observation');
});
test('M22 controlled multi-worker PostgreSQL race creates one event/audit and one delivery per recipient',async()=>{
  /* M22_POST_REVIEW_RACE_BEGIN */
  const f=await fresh(90),policy=s.app.get((await import('../dist/authorization/authorization-policy.service.js')).AuthorizationPolicyService);
  const workers=Array.from({length:4},()=>new SlaAlertService(s.prisma,policy,s.env,async()=>s.clock.now,e=>s.logs.push(e)));
  await owner.query('BEGIN');await owner.query('SELECT id FROM "Request" WHERE id=$1 FOR UPDATE',[f.request.id]);
  const jobs=workers.map(instance=>instance.observe(f.sla.id,f.request.id,[s.manager.actor.id]));let results;
  try{let waiting=0;for(let i=0;i<200;i++){await owner.query('SELECT pg_stat_clear_snapshot()');waiting=Number((await owner.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%Request%' ")).rows[0].count);if(waiting>=4)break;await new Promise(r=>setTimeout(r,5));}assert.ok(waiting>=4,'All four independent worker transactions wait on the real PG barrier');metrics.concurrentWorkerWaiters=waiting;await owner.query('COMMIT');results=await Promise.all(jobs);}finally{await owner.query('ROLLBACK');await Promise.allSettled(jobs);}
  assert.equal(results.reduce((n,r)=>n+r.events,0),1);assert.equal(results.reduce((n,r)=>n+r.notifications,0),2);assert.equal((await alerts(f)).length,1);assert.equal((await notices(f)).length,2);
  /* M22_POST_REVIEW_RACE_END */
  assert.equal(await s.prisma.auditLog.count({where:{resourceType:'SlaOperationalAlert',resourceId:(await alerts(f))[0].id}}),1);pass('real_concurrent_worker_dedup');
});
test('M22 same-level handoff reconciles current recipient once and filters stale/USER before unread pagination/read',async()=>{
  const f=await fresh(50);await observe(f);const old=(await notices(f))[0];
  assert.equal((await s.call(s.staff.token,'/notifications?unreadOnly=true&limit=1')).status,200);
  const changed=await s.command(s.manager,'/manager/requests/'+f.request.id+'/reassign',{expectedVersion:f.request.version,teamId:s.decision.teamId,staffId:s.otherStaff.actor.id,reason:'Synthetic M22 human handoff'});
  const afterHandoff=await business(f.request.id);assert.equal((await s.call(s.manager.token,'/manager/requests/'+f.request.id+'/reassign',{expectedVersion:f.request.version,teamId:s.decision.teamId,staffId:s.staff.actor.id,reason:'Synthetic stale replay'})).status,409);assert.deepEqual(await business(f.request.id),afterHandoff);
  assert.deepEqual(await observe(f),{events:0,notifications:1});assert.equal((await alerts(f)).length,1);assert.deepEqual(await observe(f),{events:0,notifications:0});
  assert.equal((await s.call(s.staff.token,'/notifications/'+old.id+'/read',{read:true},'PATCH')).status,404);assert.equal((await s.prisma.notification.findUniqueOrThrow({where:{id:old.id}})).readAt,null);
  for(const actor of [s.staff,s.user]){let cursor='',rows=[];do{const r=await s.call(actor.token,'/notifications?unreadOnly=true&limit=100'+(cursor?'&cursor='+cursor:''));assert.equal(r.status,200);rows.push(...r.body.data);cursor=r.body.page.nextCursor;}while(cursor);assert.ok(!rows.some(n=>n.requestId===f.request.id&&n.type==='SLA_REMINDER'));}
  assert.equal((await s.call(s.user.token,'/notifications/'+old.id+'/read',{read:true},'PATCH')).status,404);
  s.clock.now=new Date(f.sla.startedAt.getTime()+101000);await observe(f);assert.ok((await notices(f)).filter(n=>n.type==='SLA_BREACHED').every(n=>[s.manager.actor.id,s.otherStaff.actor.id].includes(n.recipientId)));
  assert.equal(changed.currentAssignee.id,s.otherStaff.actor.id);pass('human_handoff_recipient_reconciliation_scope');
});
test('M22 no-recipient recovery, obsolete-level suppression, pause/resume/reopen and final lifecycle semantics',async()=>{
  const f=await fresh(50);await s.prisma.request.update({where:{id:f.request.id},data:{currentAssigneeId:null}});assert.deepEqual(await observe(f),{events:1,notifications:0});await s.prisma.request.update({where:{id:f.request.id},data:{currentAssigneeId:s.staff.actor.id}});assert.deepEqual(await observe(f),{events:0,notifications:1});
  let c=changeSla(f.sla,'REQUEST_USER_INFO',s.clock.now);await s.prisma.slaInstance.update({where:{id:f.sla.id},data:clockFields(c)});await s.prisma.request.update({where:{id:f.request.id},data:{status:'WAITING_USER'}});assert.deepEqual(await observe(f),{events:0,notifications:0});
  s.clock.now=new Date(s.clock.now.getTime()+100000);c=changeSla(c,'USER_PROVIDE_INFO',s.clock.now);await s.prisma.slaInstance.update({where:{id:f.sla.id},data:clockFields(c)});await s.prisma.request.update({where:{id:f.request.id},data:{status:'IN_PROGRESS'}});assert.deepEqual(await observe(f),{events:0,notifications:0});
  c=changeSla(c,'RESOLVE',s.clock.now);await s.prisma.slaInstance.update({where:{id:f.sla.id},data:clockFields(c)});await s.prisma.request.update({where:{id:f.request.id},data:{status:'RESOLVED'}});assert.deepEqual(await observe(f),{events:0,notifications:0});
  s.clock.now=new Date(s.clock.now.getTime()+100000);c=changeSla(c,'USER_REOPEN',s.clock.now);await s.prisma.slaInstance.update({where:{id:f.sla.id},data:clockFields(c)});await s.prisma.request.update({where:{id:f.request.id},data:{status:'IN_PROGRESS'}});assert.deepEqual(await observe(f),{events:0,notifications:0});assert.equal((await alerts(f)).length,1);
  for(const action of ['CANCEL','USER_CONFIRM']){const terminal=await fresh(101);await s.prisma.slaInstance.update({where:{id:terminal.sla.id},data:clockFields(changeSla(terminal.sla,action,s.clock.now))});await s.prisma.request.update({where:{id:terminal.request.id},data:{status:action==='CANCEL'?'CANCELED':'CLOSED'}});assert.deepEqual(await observe(terminal),{events:0,notifications:0});}
  pass('no_recipient_and_canonical_lifecycle');
});
test('M22 notification failure and required audit failure atomically roll back then retry safely',async()=>{
  for(const target of ['Notification','AuditLog']){const f=await fresh(90),before={alerts:await s.prisma.slaOperationalAlert.count(),audits:await s.prisma.auditLog.count(),notices:await s.prisma.notification.count()};
    await owner.query('CREATE FUNCTION m22_fail_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'Synthetic M22 injected rollback\'; END; $$');await owner.query('CREATE TRIGGER m22_fail BEFORE INSERT ON "'+target+'" FOR EACH ROW EXECUTE FUNCTION m22_fail_write()');
    try{await assert.rejects(observe(f));assert.deepEqual({alerts:await s.prisma.slaOperationalAlert.count(),audits:await s.prisma.auditLog.count(),notices:await s.prisma.notification.count()},before);}finally{await owner.query('DROP TRIGGER m22_fail ON "'+target+'"');await owner.query('DROP FUNCTION m22_fail_write()');}
    assert.deepEqual(await observe(f),{events:1,notifications:2});assert.deepEqual(await observe(f),{events:0,notifications:0});
  }pass('notification_and_audit_failure_atomic_retry');
});
test('M22 lock-barrier scan-to-insert lifecycle/reassignment/role revocation uses current state',async()=>{
  let barriers=0;
  for(const change of ['pause','resolve','close','reassign','role']){const f=await fresh(50);await owner.query('BEGIN');await owner.query('SELECT id FROM "Request" WHERE id=$1 FOR UPDATE',[f.request.id]);const job=observe(f);
    try{
      let waiting=false;for(let i=0;i<200;i++){await owner.query('SELECT pg_stat_clear_snapshot()');waiting=Number((await owner.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%Request%' ")).rows[0].count)>0;if(waiting)break;await new Promise(r=>setTimeout(r,5));}assert.ok(waiting,'Observed real blocked worker before concurrent commit');barriers++;
      if(change==='reassign')await owner.query('UPDATE "Request" SET "currentAssigneeId"=$1 WHERE id=$2',[s.otherStaff.actor.id,f.request.id]);
      else if(change==='role')await owner.query('UPDATE "User" SET active=false WHERE id=$1',[s.staff.actor.id]);
      else{const status={pause:'WAITING_USER',resolve:'RESOLVED',close:'CLOSED'}[change];await owner.query('UPDATE "Request" SET status=$1 WHERE id=$2',[status,f.request.id]);const c=changeSla(f.sla,{pause:'REQUEST_USER_INFO',resolve:'RESOLVE',close:'USER_CONFIRM'}[change],s.clock.now);await owner.query('UPDATE "SlaInstance" SET "pausedAt"=$1,"resolvedHoldAt"=$2,"stoppedAt"=$3,"stopReason"=$4 WHERE id=$5',[c.pausedAt,c.resolvedHoldAt,c.stoppedAt,c.stopReason,f.sla.id]);}
      await owner.query('COMMIT');const result=await job;
      if(change==='reassign'){assert.equal(result.notifications,1);assert.equal((await notices(f))[0].recipientId,s.otherStaff.actor.id);}else assert.equal(result.notifications,0);
      if(!['reassign','role'].includes(change))assert.equal(result.events,0);
    }finally{await owner.query('ROLLBACK');await owner.query('UPDATE "User" SET active=true WHERE id=$1',[s.staff.actor.id]);await job.catch(()=>undefined);}
  }metrics.lockBarriers=barriers;pass('state_at_insert_real_lock_barriers');
});
test('M22 M12 scalar/SQL boundaries/calendar regression and canonical monitor persists without legacy delivery',async()=>{
  const f=await fresh(0);let parity=0;for(const seconds of [49,50,79,80,99,100,101]){const at=new Date(f.sla.startedAt.getTime()+seconds*1000);const [sql]=await s.prisma.$queryRaw(Prisma.sql`WITH clock AS (SELECT ${at}::timestamptz AS "asOf") SELECT ${slaStateSql} AS state,${slaRemainingSql}::int AS remaining FROM "SlaInstance" s CROSS JOIN clock WHERE s."id"=${f.sla.id}::uuid`);const scalar=assessSla(f.sla,at);assert.equal(sql.state,scalar.status);assert.equal(sql.remaining,scalar.remainingSeconds);parity++;}
  const before=await s.prisma.notification.count();await s.app.get(SlaMonitorService).tick(new Date(f.sla.startedAt.getTime()+101000));const after=await s.prisma.slaInstance.findUniqueOrThrow({where:{id:f.sla.id}});assert.equal(after.status,'BREACHED');assert.equal(after.breachedAt.getTime(),after.dueAt.getTime()+1000);assert.equal(await s.prisma.notification.count(),before);
  metrics.scalarSqlParity=parity;pass('canonical_m12_and_monitor_regression');
});
test('M22 forged trigger/role/foreign ID/unknown schema and private history/context are rejected',async()=>{
  const f=await fresh(90);await observe(f);for(const actor of [s.user,s.staff,s.manager])for(const path of ['/requests/'+f.request.id+'/sla/escalate','/requests/'+f.request.id+'/sla-alerts','/sla-alerts/run'])assert.equal((await s.call(actor.token,path,{})).status,404);
  const event=(await alerts(f))[0];const userHistory=await s.call(s.user.token,'/requests/'+f.request.id+'/history');assert.equal(userHistory.status,200);assert.ok(!JSON.stringify(userHistory.body).includes(event.id));
  for(const actor of [s.user,s.staff,s.manager])assert.equal((await s.call(actor.token,'/notifications/'+randomUUID()+'/read',{read:true},'PATCH')).status,404);
  assert.equal((await s.call(s.staff.token,'/notifications/'+(await notices(f))[0].id+'/read',{read:true,actorType:'SYSTEM'},'PATCH')).status,400);
  const contract=await fetch(s.base+'/api/docs-json').then(r=>r.json());assert.ok(!Object.keys(contract.paths).some(p=>p.includes('sla-alert')||p.includes('escalate')));
  const detail=await s.call(s.user.token,'/requests/'+f.request.id);assert.equal(detail.status,200);assert.ok(!/slaAlertId|thresholdKey|configIdentity/.test(JSON.stringify(detail.body)));
  assert.equal(Object.values(s.captured).reduce((n,v)=>n+v.length,0),0);pass('security_private_contract_no_public_trigger');
});
test('M22 durable multi-batch fairness, error isolation, restart, behind-cursor transition and measured fixture',async()=>{
  // Stop earlier fixtures from participating; test-only owner setup never touches developer data.
  await owner.query('UPDATE "Request" SET status=\'CANCELED\' WHERE status IN (\'ASSIGNED\',\'IN_PROGRESS\')');
  await s.prisma.slaAlertScanProgress.update({where:{id:'M22_PRIMARY'},data:{cursorId:null,version:{increment:1}}});
  const policy=await s.prisma.slaPolicy.findFirstOrThrow({where:{active:true}}),count=300,batch=s.env.SLA_ALERT_BATCH_SIZE,requests=[],clocks=[];
  for(let i=1;i<=count;i++){const id=randomUUID(),slaId='80000000-0000-4000-8000-'+String(i).padStart(12,'0'),seconds=i%4===0?10:i%4===1?50:i%4===2?90:101,start=new Date(s.clock.now.getTime()-seconds*1000);requests.push({id,publicCode:'M22-PERF-'+i,createdById:s.user.actor.id,currentAssigneeId:s.staff.actor.id,title:'Synthetic fair scan '+i,description:'Synthetic bounded mixed-state M22 fixture',status:'IN_PROGRESS',createdAt:new Date(start.getTime()-1000)});clocks.push({id:slaId,requestId:id,policyId:policy.id,policyVersion:policy.version,targetSeconds:100,startedAt:start,dueAt:new Date(start.getTime()+100000),assessedAt:start});}
  assert.ok(count>=Math.max(300,3*batch));await s.prisma.request.createMany({data:requests});await s.prisma.slaInstance.createMany({data:clocks});
  for(const row of clocks.slice(0,batch))await worker.observe(row.id,row.requestId,[s.manager.actor.id]);
  const failedId=clocks[batch+2].requestId;await owner.query('CREATE FUNCTION m22_fail_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."requestId"=\''+failedId+'\'::uuid THEN RAISE EXCEPTION \'Synthetic one-item failure\'; END IF; RETURN NEW; END; $$');await owner.query('CREATE TRIGGER m22_fail_item BEFORE INSERT ON "SlaOperationalAlert" FOR EACH ROW EXECUTE FUNCTION m22_fail_item()');
  const ticks=[];const startQueries=s.queries.length;try{for(let i=0;i<4;i++)ticks.push(await worker.tick());}finally{await owner.query('DROP TRIGGER m22_fail_item ON "SlaOperationalAlert"');await owner.query('DROP FUNCTION m22_fail_item()');}
  assert.equal(ticks.reduce((n,t)=>n+t.scanned,0),300);assert.equal(ticks.reduce((n,t)=>n+t.failures,0),1);assert.equal(ticks[3].wrapped,true);assert.ok(await s.prisma.slaOperationalAlert.findFirst({where:{requestId:clocks.at(-2).requestId}}));
  const queries=s.queries.slice(startQueries),candidateSql=queries.filter(q=>q.sql.includes('FROM "public"."SlaInstance"')&&q.sql.includes('ORDER BY')&&q.sql.includes('LIMIT')).length,projectionQueries=queries.filter(q=>q.sql.includes('FROM "public"."SlaInstance"')&&!q.sql.includes('FOR UPDATE')&&!q.sql.includes('ORDER BY')).length;
  assert.equal(candidateSql,4);assert.equal(projectionQueries,300);
  const initialCount=await s.prisma.slaOperationalAlert.count();s.clock.now=new Date(s.clock.now.getTime()+100000);const restarted=new SlaAlertService(s.prisma,s.app.get((await import('../dist/authorization/authorization-policy.service.js')).AuthorizationPolicyService),s.env,async()=>s.clock.now,e=>s.logs.push(e));
  const rescan=[];for(let i=0;i<4;i++)rescan.push(await restarted.tick());assert.ok(await s.prisma.slaOperationalAlert.findFirst({where:{requestId:clocks[3].requestId,eventType:'SLA_BREACH_ESCALATION'}}));assert.ok(await s.prisma.slaOperationalAlert.findFirst({where:{requestId:failedId}}));assert.ok(await s.prisma.slaOperationalAlert.count()>initialCount);
  const steady=[];for(let i=0;i<4;i++)steady.push(await restarted.tick());assert.equal(steady.reduce((n,t)=>n+t.events+t.notifications,0),0);
  metrics.performance={fixture:count,batchSize:batch,ticks,candidateSql,projectionQueries,notificationInserts:queries.filter(q=>q.sql.startsWith('INSERT INTO "public"."Notification"')).length,recipients: ticks.reduce((n,t)=>n+t.notifications,0),maximumCoverageTicks:4,rescan,steady,limitations:'Local synthetic samples; no enterprise SLO'};pass('fairness_error_progress_restart_performance');
});
