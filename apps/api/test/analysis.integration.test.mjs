import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
import {parseApiEnvironment} from '@mobiflow/config';
import {aiJobResponseSchema,aiExplanationSchema} from '@mobiflow/contracts';
import {createApplication} from '../dist/app.js';
import {AnalysisWorker} from '../dist/ai/analysis-worker.js';
import {RequestStateMachineService} from '../dist/requests/request-state-machine.service.js';
const databaseUrl=process.env.M2_INTEGRATION_DATABASE_URL;
if(!databaseUrl||new URL(databaseUrl).pathname!=='/mobiflow_m2_test')throw new Error('Dedicated local test database required');
const valid={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:null,location:null,affectedCount:17,startedAt:null},missingFields:['location','startedAt'],confidence:.8,reasonSummary:'Nhiều SIM mất kết nối, cần xác nhận vị trí và thời gian.'};
const generation={raw:JSON.stringify(valid),identity:{provider:'test',model:'fixture:1',digest:'fixture-only'},outputSize:500};
const completion={analysis:valid,identity:generation.identity,outputSize:500,retryCount:0,latencyMs:10,firstAttemptValid:true};
async function setup(t,{provider={generate:async()=>generation},auto=false}={}){
  const env=parseApiEnvironment({NODE_ENV:'test',AI_GENERATION_PROVIDER:'ollama',RAG_RETRIEVAL_MODE:'vector',AI_AUTO_ANALYZE:String(auto),DATABASE_URL:databaseUrl,JWT_SECRET:'a'.repeat(40),REFRESH_TOKEN_SECRET:'b'.repeat(40),OLLAMA_BASE_URL:'http://127.0.0.1:1',OLLAMA_MODEL:'missing:1',OLLAMA_EMBEDDING_MODEL:'unconfigured'});
  const logs=[];const s=await createApplication(env,{quiet:true,log:x=>logs.push(x),...(provider?{aiProvider:provider}:{}),aiWorker:false});
  await s.app.listen(0,'127.0.0.1');t.after(async()=>{await s.app.close();await s.database.close();await s.prisma.$disconnect();});
  const base=await s.app.getUrl();
  async function call(token,path,body,method=body===undefined?'GET':'POST'){
    const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:3000','X-CSRF-Protection':'1',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,body:await r.json()};
  }
  const login=async email=>{const r=await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'});assert.equal(r.status,200);return r.body.data.accessToken;};
  const user=await login('user@mobiflow.local'),manager=await login('manager@mobiflow.local'),staff=await login('staff.iot@mobiflow.local');
  async function command(token,path,body,status=200){const r=await call(token,path,body);assert.equal(r.status,status,JSON.stringify(r.body));return r.body.data;}
  const create=()=>command(user,'/requests',{description:'17 SIM IoT bị mất kết nối. Synthetic M4 integration.'},201);
  const detail=id=>command(manager,'/requests/'+id);
  const start=(r,token=user,retry=false)=>command(token,'/requests/'+r.id+'/ai/'+(retry?'retry':'analyze'),{expectedVersion:r.version},202);
  const worker=s.app.get(AnalysisWorker),machine=s.app.get(RequestStateMachineService);
  return {...s,logs,call,command,user,manager,staff,create,detail,start,worker,machine};
}
test('M4 automatic queue is atomic, manual triage cancels queued work, full success is advisory with role projections',async t=>{
  const s=await setup(t,{auto:true});let r=await s.create();
  const run=await s.prisma.aiRun.findFirstOrThrow({where:{requestId:r.id}});assert.equal(run.status,'QUEUED');assert.equal(run.contextVersion,1);
  assert.equal(r.status,'NEW');await s.worker.tick();r=await s.detail(r.id);assert.equal(r.status,'TRIAGED');assert.equal(r.version,3);assert.equal(r.category,null);assert.equal(r.priority,'MEDIUM');assert.equal(r.teamId,null);assert.equal(r.sla,null);
  assert.equal(await s.prisma.assignment.count({where:{requestId:r.id}}),0);assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:r.id}}),0);
  const owner=await s.call(s.user,'/ai/runs/'+run.id);aiJobResponseSchema.parse(owner.body);assert.equal(owner.body.data.status,'SUCCEEDED');assert.equal('analysis' in owner.body.data,false);assert.equal('model' in owner.body.data,false);
  const manager=await s.call(s.manager,'/requests/'+r.id+'/ai/explanation');aiExplanationSchema.parse(manager.body);assert.equal(manager.body.data.analysis.prioritySuggestion,'HIGH');assert.equal(manager.body.data.analysis.entities.location,null);
  assert.equal((await s.call(s.staff,'/ai/runs/'+run.id)).status,403);assert.equal((await s.call(s.staff,'/requests/'+r.id+'/ai/explanation')).status,404);
  await s.machine.finishAnalysis(run.id,completion);assert.equal((await s.detail(r.id)).version,3);assert.equal(await s.prisma.aiAnalysis.count({where:{aiRunId:run.id}}),1);
  const history=await s.prisma.requestStatusHistory.findMany({where:{requestId:r.id},orderBy:{requestVersion:'asc'}});assert.deepEqual(history.map(h=>h.action),['CREATE','START_AI_ANALYSIS','COMPLETE_AI_ANALYSIS']);assert.equal(history[1].actorType,'SYSTEM');
  const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:'10000000-0000-4000-8000-000000000003',actions:[],acknowledgedMissingFields:[],reason:'Human plan with no required checklist'};
  r=await s.command(s.manager,'/manager/requests/'+r.id+'/triage',{expectedVersion:r.version,finalDecision:decision});
  r=await s.command(s.manager,'/manager/requests/'+r.id+'/submit-approval',{expectedVersion:r.version,manualDraftRevision:r.manualDraftRevision});
  const review={expectedVersion:r.version,reviewKind:'MANUAL',manualDraftRevision:r.pendingDraftRevision,acknowledgedMissingFields:[]};
  await s.command(s.manager,'/manager/approvals/'+r.id+'/accept',review,422);
  r=await s.command(s.manager,'/manager/approvals/'+r.id+'/accept',{...review,acknowledgedMissingFields:['location','startedAt']});assert.equal(r.status,'ASSIGNED');
  const staffView=await s.call(s.staff,'/requests/'+r.id+'/ai/explanation');assert.ok(staffView.body.data.entities);assert.equal('analysis' in staffView.body.data,false);assert.equal(staffView.body.data.job,null);
  let manual=await s.create();const queued=await s.prisma.aiRun.findFirstOrThrow({where:{requestId:manual.id}});
  manual=await s.command(s.manager,'/manager/requests/'+manual.id+'/triage',{expectedVersion:manual.version,finalDecision:decision});
  assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:queued.id}})).status,'CANCELED');await s.worker.tick();assert.equal((await s.detail(manual.id)).status,'TRIAGED');
});
test('M4 concurrent starts dedupe, stale completion preserves messages, explicit retry succeeds, endpoint scope and DTOs enforce authority',async t=>{
  let release;let entered;const started=new Promise(r=>{entered=r;});
  const provider={generate:async()=>{entered();return new Promise(r=>{release=()=>r(generation);});}};
  const s=await setup(t,{provider});let r=await s.create();
  for(const token of [null,s.staff])assert.equal((await s.call(token,'/requests/'+r.id+'/ai/analyze',{expectedVersion:r.version})).status,token?403:401);
  await s.command(s.user,'/requests/'+r.id+'/ai/analyze',{expectedVersion:r.version,actorType:'SYSTEM'},400);
  await s.command(s.manager,'/requests/'+r.id+'/ai/analyze',{expectedVersion:r.version+1},409);
  const double=await Promise.all([s.start(r),s.start(r)]);assert.equal(double[0].aiRunId,double[1].aiRunId);assert.equal(await s.prisma.aiRun.count({where:{requestId:r.id}}),1);
  const running=s.worker.tick();await started;r=await s.detail(r.id);assert.equal(r.status,'AI_ANALYZING');
  await s.command(s.manager,'/manager/requests/'+r.id+'/triage',{expectedVersion:r.version,finalDecision:{category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'MEDIUM',teamId:randomUUID(),staffId:randomUUID(),actions:[],acknowledgedMissingFields:[],reason:'not allowed during active run'}},409);
  r=await s.command(s.user,'/requests/'+r.id+'/messages',{expectedVersion:r.version,body:'Thông tin mới phải được bảo toàn.'},201);
  release();await running;r=await s.detail(r.id);assert.equal(r.status,'NEW');assert.equal(r.aiAnalysisStatus,'FAILED');assert.equal(r.version,4);
  const failed=await s.prisma.aiRun.findUniqueOrThrow({where:{id:double[0].aiRunId}});assert.equal(failed.errorCode,'STALE_CONTEXT');assert.equal(await s.prisma.aiAnalysis.count({where:{requestId:r.id}}),0);assert.equal(await s.prisma.requestMessage.count({where:{requestId:r.id}}),1);
  const retry=await s.start(r,s.manager,true);const claimed=await s.machine.claimAnalysis(retry.aiRunId);assert.equal(claimed.input.messages.length,1);
  await s.machine.finishAnalysis(retry.aiRunId,completion);assert.equal((await s.detail(r.id)).status,'TRIAGED');
  const foreignUser=await s.prisma.user.create({data:{id:randomUUID(),email:randomUUID()+'@test.local',displayName:'Foreign',role:'USER',passwordHash:(await s.prisma.user.findUniqueOrThrow({where:{email:'user@mobiflow.local'}})).passwordHash}});
  const foreign=await s.prisma.request.create({data:{createdById:foreignUser.id,publicCode:'M4-'+randomUUID().slice(0,8),title:'Hidden',description:'Foreign synthetic data'}});
  await s.command(s.user,'/requests/'+foreign.id+'/ai/analyze',{expectedVersion:1},404);
  assert.equal((await s.call(s.user,'/requests/'+foreign.id+'/ai/explanation')).status,404);
  assert.equal((await s.call(s.user,'/ai/runs/'+randomUUID())).status,404);
});
test('M4 cancel beats late publication, revoked initiator cannot publish, expired lease recovers and replay is harmless',async t=>{
  const s=await setup(t);let r=await s.create();const job=await s.start(r);await s.machine.claimAnalysis(job.aiRunId);r=await s.detail(r.id);
  r=await s.command(s.user,'/requests/'+r.id+'/cancel',{expectedVersion:r.version,reason:'Cancel during inference'});
  await s.machine.finishAnalysis(job.aiRunId,completion);assert.equal((await s.detail(r.id)).status,'CANCELED');assert.equal(await s.prisma.aiAnalysis.count({where:{requestId:r.id}}),0);
  r=await s.create();const revoked=await s.start(r);await s.machine.claimAnalysis(revoked.aiRunId);
  const owner=await s.prisma.user.findUniqueOrThrow({where:{email:'user@mobiflow.local'}});await s.prisma.user.update({where:{id:owner.id},data:{active:false}});
  try{await s.machine.finishAnalysis(revoked.aiRunId,completion);assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:revoked.aiRunId}})).errorCode,'FORBIDDEN');assert.equal((await s.call(s.user,'/ai/runs/'+revoked.aiRunId)).status,401);}finally{await s.prisma.user.update({where:{id:owner.id},data:{active:true}});}
  r=await s.create();const expired=await s.start(r);await s.machine.claimAnalysis(expired.aiRunId);await s.prisma.aiRun.update({where:{id:expired.aiRunId},data:{leaseUntil:new Date(0),deadlineAt:new Date(0)}});await s.worker.tick();
  assert.equal((await s.detail(r.id)).status,'NEW');assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:expired.aiRunId}})).errorCode,'AI_TIMEOUT');
  const version=(await s.detail(r.id)).version;await s.machine.finishAnalysis(expired.aiRunId,completion);assert.equal((await s.detail(r.id)).version,version);
});
test('M4 invalid provider output exhausts only two attempts; failed publication rolls back analysis and state with real PostgreSQL trigger',async t=>{
  const s=await setup(t,{provider:{generate:async()=>({...generation,raw:'{"category":"NOT_ALLOWED"}'})}});let r=await s.create();const invalid=await s.start(r);await s.worker.tick();
  assert.equal((await s.detail(r.id)).status,'NEW');const run=await s.prisma.aiRun.findUniqueOrThrow({where:{id:invalid.aiRunId}});assert.equal(run.retryCount,1);assert.equal(run.errorCode,'AI_INVALID_OUTPUT');assert.equal(await s.prisma.aiAnalysis.count({where:{requestId:r.id}}),0);
  const ownerUrl=process.env.M4_INTEGRATION_OWNER_URL;if(!ownerUrl||new URL(ownerUrl).pathname!=='/mobiflow_m2_test')throw new Error('Dedicated owner URL required for rollback test');
  const owner=new Client({connectionString:ownerUrl});await owner.connect();
  const good=await setup(t);r=await good.create();const pending=await good.start(r);
  await owner.query(`CREATE FUNCTION m4_reject_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."action"='COMPLETE_AI_ANALYSIS' THEN RAISE EXCEPTION 'M4 synthetic audit write failure'; END IF; RETURN NEW; END $$`);
  await owner.query('CREATE TRIGGER m4_reject_completion BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION m4_reject_completion()');
  try{await good.worker.tick();assert.equal((await good.detail(r.id)).status,'NEW');assert.equal(await good.prisma.aiAnalysis.count({where:{requestId:r.id}}),0);assert.equal((await good.prisma.aiRun.findUniqueOrThrow({where:{id:pending.aiRunId}})).errorCode,'AI_PERSISTENCE_UNAVAILABLE');}
  finally{await owner.query('DROP TRIGGER m4_reject_completion ON "AuditLog"');await owner.query('DROP FUNCTION m4_reject_completion()');await owner.end();}
});
test('M4 real unreachable Ollama leaves API ready, records controlled failure, manual approval remains usable and trigger limits hold',async t=>{
  const s=await setup(t,{provider:null,auto:true});let r=await s.create();await s.worker.tick();r=await s.detail(r.id);assert.equal(r.status,'NEW');assert.equal(r.aiAnalysisStatus,'FAILED');
  const health=await s.call(null,'/health/ready');assert.equal(health.status,200);assert.equal(health.body.data.coreReady,true);assert.equal(health.body.data.components.OLLAMA_SERVER.status,'DOWN');
  const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:'10000000-0000-4000-8000-000000000003',actions:[],acknowledgedMissingFields:[],reason:'Offline human workflow'};
  r=await s.command(s.manager,'/manager/requests/'+r.id+'/triage',{expectedVersion:r.version,finalDecision:decision});r=await s.command(s.manager,'/manager/requests/'+r.id+'/submit-approval',{expectedVersion:r.version,manualDraftRevision:r.manualDraftRevision});r=await s.command(s.manager,'/manager/approvals/'+r.id+'/accept',{expectedVersion:r.version,reviewKind:'MANUAL',manualDraftRevision:r.pendingDraftRevision,acknowledgedMissingFields:[]});assert.equal(r.status,'ASSIGNED');
  let quota=await s.create();for(let i=0;i<3;i++)await s.start(quota);await s.command(s.user,'/requests/'+quota.id+'/ai/analyze',{expectedVersion:quota.version},429);
  quota=await s.command(s.user,'/requests/'+quota.id+'/cancel',{expectedVersion:quota.version,reason:'Cleanup queued synthetic quota test'});assert.equal(quota.status,'CANCELED');
  assert.ok(s.logs.every(x=>!JSON.stringify(x).includes('password')));
});
