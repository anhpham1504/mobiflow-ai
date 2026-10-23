import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {parseApiEnvironment} from '@mobiflow/config';
import {dashboardResponseSchema,requestListSchema,statuses} from '@mobiflow/contracts';
import {createApplication} from '../dist/app.js';
import {DashboardService,dashboardQuery} from '../dist/dashboard/dashboard.service.js';
import {AuthorizationPolicyService} from '../dist/authorization/authorization-policy.service.js';
import {slaView,assessSla,changeSla,clockFields} from '../dist/requests/sla-clock.js';
import {slaStateSql,slaRemainingSql} from '../dist/requests/sla-sql.js';
import {Prisma} from '../dist/generated/prisma/client.js';
import {expectedMigrationNames} from '../../../scripts/demo/release-core.mjs';

const url=process.env.M2_INTEGRATION_DATABASE_URL;
if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname)||new URL(url).pathname!=='/mobiflow_m2_test')throw new Error('Dedicated loopback integration DB required');
const env=parseApiEnvironment({NODE_ENV:'test',AI_GENERATION_PROVIDER:'ollama',RAG_RETRIEVAL_MODE:'vector',AI_AUTO_ANALYZE:'false',DATABASE_URL:url,WEB_ORIGIN:'http://localhost:3000',JWT_SECRET:'v12-test-jwt'.padEnd(48,'a'),REFRESH_TOKEN_SECRET:'v12-test-refresh'.padEnd(48,'b'),OLLAMA_BASE_URL:'http://127.0.0.1:1',OLLAMA_MODEL:'unconfigured',OLLAMA_EMBEDDING_MODEL:'unconfigured',AUTH_COOKIE_SECURE:'false'});

test('M11 real PostgreSQL role aggregates, 120-row pagination invariant, query count/performance and OpenAPI; M12 SQL/scalar parity',async t=>{
  const s=await createApplication(env,{quiet:true,log:e=>{if(e.status===500)console.log(e);}});await s.app.listen(0,'127.0.0.1');
  t.after(async()=>{await s.app.close();await s.database.close();await s.prisma.$disconnect();});
  const base=await s.app.getUrl(),db=s.prisma,policy=new AuthorizationPolicyService(),service=s.app.get(DashboardService),tag=randomUUID().slice(0,8);
  const template=await db.user.findUniqueOrThrow({where:{email:'user@mobiflow.local'}});
  const makeUser=role=>db.user.create({data:{id:randomUUID(),email:`v12-${role.toLowerCase()}-${randomUUID()}@test.local`,displayName:'Synthetic '+role,passwordHash:template.passwordHash,role}});
  const owner=await makeUser('USER'),staff=await makeUser('STAFF'),foreignOwner=await makeUser('USER'),foreignStaff=await makeUser('STAFF');
  async function call(token,path){const r=await fetch(base+path,{headers:token?{Authorization:'Bearer '+token}:{} });return {status:r.status,body:await r.json(),headers:r.headers};}
  async function login(email){const r=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.WEB_ORIGIN,'X-CSRF-Protection':'1'},body:JSON.stringify({email,password:'MobiFlowDemo!2026'})});assert.equal(r.status,200);return (await r.json()).data.accessToken;}
  const actors={USER:{...owner,token:await login(owner.email)},STAFF:{...staff,token:await login(staff.email)},MANAGER:{...await db.user.findUniqueOrThrow({where:{email:'manager@mobiflow.local'}}),token:await login('manager@mobiflow.local')}};
  const snapshot=async role=>{const r=await call(actors[role].token,'/api/v1/dashboard/'+role.toLowerCase());assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.headers.get('cache-control'),'no-store');return dashboardResponseSchema.parse(r.body).data;};
  for(const role of ['USER','STAFF'])assert.ok(Object.values((await snapshot(role)).metrics).every(n=>n===0));
  for(const role of Object.keys(actors))for(const route of Object.keys(actors))assert.equal((await call(actors[role].token,'/api/v1/dashboard/'+route.toLowerCase())).status,role===route?200:403);
  assert.equal((await call(null,'/api/v1/dashboard/user')).status,401);
  for(const query of ['role=MANAGER','createdById='+foreignOwner.id,'assigneeId='+foreignStaff.id,'limit=1','cursor=forged','asOf=2026-01-01'])assert.equal((await call(actors.USER.token,'/api/v1/dashboard/user?'+query)).status,400);

  const fixture=(index,overrides={})=>({id:randomUUID(),publicCode:`V12-${tag}-${index}`,createdById:owner.id,currentAssigneeId:staff.id,title:'Synthetic aggregate '+index,description:'Deterministic isolated aggregate fixture.',status:'IN_PROGRESS',...overrides});
  const single=fixture(0);await db.request.create({data:single});assert.equal((await snapshot('USER')).metrics.inProgress,1);assert.equal((await snapshot('STAFF')).metrics.assignedToMe,1);
  await db.request.createMany({data:Array.from({length:119},(_,i)=>fixture(i+1))});
  const first={};for(const role of Object.keys(actors))first[role]=(await snapshot(role)).metrics;
  assert.equal(first.USER.openRequests,120);assert.equal(first.STAFF.assignedToMe,120);
  const listPath={USER:'/requests/mine',STAFF:'/staff/work-queue',MANAGER:'/manager/requests'};
  for(const role of Object.keys(actors))for(const limit of [1,10,20,50]){
    const r=await call(actors[role].token,'/api/v1'+listPath[role]+'?limit='+limit);assert.equal(r.status,200);const list=requestListSchema.parse(r.body);assert.equal(list.data.length,limit);
    assert.deepEqual((await snapshot(role)).metrics,first[role]);
    if(limit===1){const next=await call(actors[role].token,'/api/v1'+listPath[role]+'?limit=1&cursor='+list.page.nextCursor);assert.notEqual(next.body.data[0].id,list.data[0].id);assert.deepEqual((await snapshot(role)).metrics,first[role]);}
  }
  // Counter fixtures use the real DB; the production service never materializes this set.
  const injected=new Date('2026-09-30T16:59:59Z'),dayFrom=new Date('2026-09-29T17:00:00Z'),dayTo=new Date('2026-09-30T17:00:00Z');
  const policyRow=await db.slaPolicy.findFirstOrThrow({where:{active:true,category:null,priority:'HIGH'}});
  const additions=statuses.map((status,i)=>fixture(200+i,{status,currentAssigneeId:['NEW','AI_ANALYZING','TRIAGED','PENDING_APPROVAL'].includes(status)?null:staff.id,
    ...(status==='PENDING_APPROVAL'?{reviewKind:'MANUAL',manualDraftRevision:1,pendingDraftRevision:1}:{}),
    ...(status==='RESOLVED'||status==='CLOSED'?{resolvedAt:new Date(dayFrom.getTime()+1000)}:{})}));
  additions.push(fixture(300,{createdById:foreignOwner.id,currentAssigneeId:foreignStaff.id}),fixture(301,{currentAssigneeId:foreignStaff.id}),fixture(302,{status:'RESOLVED',resolvedAt:new Date(dayFrom.getTime()-1)}),fixture(303,{status:'CLOSED',resolvedAt:dayTo}));
  await db.request.createMany({data:additions});
  assert.equal((await call(actors.USER.token,'/api/v1/requests/'+additions[10].id)).status,404);
  assert.equal((await call(actors.STAFF.token,'/api/v1/requests/'+additions[11].id)).status,404);
  const start=new Date(injected.getTime()-5760*1000),offset=n=>new Date(start.getTime()+n*1000);
  const baseClock={startedAt:start,dueAt:offset(7200),targetSeconds:7200,pausedAt:null,totalPausedSeconds:0,resolvedHoldAt:null,totalResolvedHoldSeconds:0,stoppedAt:null,stopReason:null,status:'SAFE',breachedAt:null,assessedAt:start};
  const clocks=[baseClock,{...baseClock,startedAt:offset(-1441),dueAt:offset(5759)},changeSla(baseClock,'REQUEST_USER_INFO',offset(100)),changeSla(baseClock,'RESOLVE',offset(3600)),changeSla(baseClock,'CANCEL',offset(100)),changeSla({...baseClock,startedAt:offset(-1441),dueAt:offset(5759)},'RESOLVE',injected)];
  const slaRequests=[single,...['IN_PROGRESS','WAITING_USER','RESOLVED','CANCELED','CLOSED'].map(status=>additions.find(r=>r.status===status))];
  clocks[5]=changeSla(clocks[5],'USER_CONFIRM',injected);
  for(let i=0;i<clocks.length;i++)await db.slaInstance.create({data:{requestId:slaRequests[i].id,policyId:policyRow.id,policyVersion:policyRow.version,...clockFields(clocks[i])}});
  // Independent fixture oracle reconciles all role metrics, including seeded records.
  for(const role of Object.keys(actors)){
    const actual=await service.snapshot(actors[role],injected),rows=await db.request.findMany({where:policy.requestScope(actors[role]),include:{slaInstance:true}});
    assert.equal(actual.day.from,dayFrom.toISOString());assert.equal(actual.day.to,dayTo.toISOString());
    const count=predicate=>rows.filter(predicate).length,open=r=>!['CLOSED','CANCELED'].includes(r.status);
    const common={slaAtRisk:count(r=>open(r)&&r.slaInstance&&assessSla(r.slaInstance,injected).status==='AT_RISK'),slaBreached:count(r=>open(r)&&r.slaInstance&&assessSla(r.slaInstance,injected).status==='BREACHED')};
    const today=count(r=>['RESOLVED','CLOSED'].includes(r.status)&&r.resolvedAt>=dayFrom&&r.resolvedAt<dayTo);
    const expected=role==='USER'?{openRequests:count(open),inProgress:count(r=>r.status==='IN_PROGRESS'),waitingForUser:count(r=>r.status==='WAITING_USER'),resolved:count(r=>r.status==='RESOLVED'),closed:count(r=>r.status==='CLOSED'),...common}:role==='STAFF'?{assignedToMe:rows.length,active:count(r=>['ASSIGNED','IN_PROGRESS','WAITING_USER'].includes(r.status)),waitingForUser:count(r=>r.status==='WAITING_USER'),...common,resolvedToday:today}:{open:count(open),pendingApproval:count(r=>r.status==='PENDING_APPROVAL'),unassigned:count(r=>r.status==='PENDING_APPROVAL'&&!r.currentAssigneeId),...common,resolvedToday:today};
    assert.deepEqual(actual.metrics,expected);
  }
  // Every boundary/cycle is executed by both scalar and parameterized SQL evaluators.
  const parity=[];let c=baseClock;
  for(const seconds of [5759,5760,5761,7199,7200,7201])parity.push([baseClock,offset(seconds)]);
  for(const [action,seconds] of [['REQUEST_USER_INFO',100],['USER_PROVIDE_INFO',200],['REQUEST_USER_INFO',300],['USER_PROVIDE_INFO',500],['RESOLVE',600],['USER_REOPEN',900],['RESOLVE',1000],['USER_CONFIRM',2000]]){c=changeSla(c,action,offset(seconds));parity.push([c,offset(seconds+90000)]);}
  for(const seconds of [100,5760,7201])parity.push([changeSla(baseClock,'CANCEL',offset(seconds)),offset(90000)]);
  for(const [clock,time] of parity){
    await db.slaInstance.update({where:{requestId:single.id},data:clockFields(clock)});
    const [sql]=await db.$queryRaw(Prisma.sql`WITH clock AS (SELECT ${time}::timestamptz AS "asOf") SELECT ${slaStateSql} AS state,${slaRemainingSql}::int AS remaining FROM "SlaInstance" s CROSS JOIN clock WHERE s."requestId"=${single.id}::uuid`);
    const scalar=slaView(clock,time);assert.equal(sql.state,scalar.state);assert.equal(sql.remaining,scalar.remainingSeconds);
  }
  const contract=await call(null,'/api/docs-json');assert.equal(contract.status,200);
  const analytics=await call(actors.MANAGER.token,'/api/v1/analytics?windowDays=30');assert.equal(analytics.status,200,JSON.stringify(analytics.body));
  const since=new Date(new Date(analytics.body.data.overview.asOf).getTime()-30*86400000);
  assert.equal(analytics.body.data.overview.sla.denominator,await db.slaInstance.count({where:{request:{status:{not:'CANCELED'},createdAt:{gte:since}}}}));
  for(const role of Object.keys(actors)){const op=contract.body.paths['/api/v1/dashboard/'+role.toLowerCase()].get;assert.equal(op.operationId,'get'+role[0]+role.slice(1).toLowerCase()+'Dashboard');assert.ok(op.security.length);for(const code of [200,400,401,403,429])assert.ok(op.responses[code]);}
  const refs=[];function walk(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key==='$ref')refs.push(item);else walk(item);}}walk(contract.body);
  for(const ref of refs){if(ref.startsWith('#/'))assert.ok(ref.slice(2).split('/').reduce((value,key)=>value?.[key.replaceAll('~1','/').replaceAll('~0','~')],contract.body));}
  const query=dashboardQuery(actors.MANAGER,policy),samples=[];
  let queryCount=0;const counted=new DashboardService({$queryRaw:async statement=>{queryCount++;return db.$queryRaw(statement);}},policy);
  await counted.snapshot(actors.MANAGER);assert.equal(queryCount,1);
  for(let i=0;i<10;i++){const began=performance.now();await snapshot('MANAGER');samples.push(Number((performance.now()-began).toFixed(3)));}
  const explain=await db.$queryRaw(Prisma.sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query}`);
  const expectedMigrationCount=expectedMigrationNames().length,migrations=await db.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);assert.equal(migrations[0].count,expectedMigrationCount);
  const evidence={database:'mobiflow_m2_test',migrations:expectedMigrationCount,pagination:{authorizedRows:120,limits:[1,10,20,50],roles:Object.keys(actors),passed:true},parityCases:parity.length,aggregateStatements:queryCount,responseMs:samples,requestRows:await db.request.count(),explain};
  mkdirSync('artifacts/v1-2',{recursive:true});writeFileSync('artifacts/v1-2/integration.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,explain:'artifacts/v1-2/integration.json'}));
});
