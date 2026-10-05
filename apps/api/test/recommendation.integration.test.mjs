import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {saveEvidence} from '../../../scripts/verification/evidence.mjs';
const writeFile=(path,contents)=>saveEvidence(path,JSON.parse(contents));
import {parseApiEnvironment} from '@mobiflow/config';
import {recommendationResponseSchema} from '@mobiflow/contracts';
import {createApplication} from '../dist/app.js';
import {AuthService} from '../dist/auth/auth.service.js';
import {RequestStateMachineService} from '../dist/requests/request-state-machine.service.js';
import {AnalysisWorker} from '../dist/ai/analysis-worker.js';
import {RecommendationService} from '../dist/ai/recommendation.service.js';
import {RequestVectors} from '../dist/ai/tools/request-vectors.js';
import {DomainTools} from '../dist/ai/tools/domain-tools.js';
import {candidates} from '../dist/ai/tools/staff.js';
import {DocumentService} from '../dist/knowledge/document.service.js';
import {IngestionWorker} from '../dist/knowledge/ingestion-worker.js';
import {AiFailure} from '../dist/ai/provider.js';
import {identityKey} from '../dist/knowledge/embedding-provider.js';
import {resolutionSummaryPromptVersion} from '../dist/ai/prompts/copilot.js';
import {Client} from 'pg';
const db=process.env.M2_INTEGRATION_DATABASE_URL;
if(!db||new URL(db).pathname!=='/mobiflow_m2_test'||!['localhost','127.0.0.1'].includes(new URL(db).hostname))throw Error('Dedicated local test DB required');
const analysis={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:null,location:'Amata',affectedCount:17,startedAt:'8 giờ'},missingFields:[],confidence:.8,reasonSummary:'Synthetic deterministic fixture; not live inference.'};
const baseIdentity={provider:'test',model:'m6-fixture',digest:'deterministic-test-only',dimension:1024,revision:'test.v1'},identity={...baseIdentity,key:identityKey(baseIdentity)},vector=Array.from({length:1024},(_,i)=>i===0?1:0);
const embeddings={probe:async()=>({identity,vectors:[vector],latencyMs:0}),embedDocuments:async texts=>({identity,vectors:texts.map(()=>vector),latencyMs:0}),embedQuery:async()=>({identity,vectors:[vector],latencyMs:0})};
let integrationPort=22000;
function fixture(e){const candidate=e.candidates.candidates[0],source=e.sources[0];return {suggestedPriority:e.policy?.priority??e.analysis.prioritySuggestion,suggestedTeamId:candidate?.teamId??null,suggestedStaffId:candidate?.staffId??null,suggestedSlaMinutes:e.policy?.targetMinutes??null,procedureSources:source?[{sourceId:source.sourceId}]:[],actions:source?[{text:'Kiểm tra SIM theo tài liệu.',sourceIds:[source.sourceId]}]:[],similarCaseAlert:{detected:e.similar.returnedCount>0,count:e.similar.returnedCount},confidence:.5,reasonSummary:'Đề xuất fixture có kiểm tra tham chiếu.',evidenceStatus:source?'SUFFICIENT':'INSUFFICIENT_EVIDENCE'};}
async function setup(t,{real=false,hook,provider,embed=embeddings,envOverrides={}}={}){
  const env=parseApiEnvironment({...process.env,NODE_ENV:'test',DATABASE_URL:db,AI_AUTO_ANALYZE:'false',AI_RAG_ENABLED:'false',KNOWLEDGE_STORAGE_ROOT:'artifacts/m5/integration-storage',EMBEDDING_DIMENSION:1024,...envOverrides});
  const generation={generateStructured:async messages=>{const {evidence}=JSON.parse(messages[1].content),r=fixture(evidence);if(hook)await hook(evidence,r);return {raw:JSON.stringify(r),outputSize:500,identity:{provider:'test',model:'m6-fixture',digest:'test-only'}};}};
  const s=await createApplication(env,{quiet:true,log:()=>{},aiWorker:false,knowledgeWorker:false,...(real?{}:{recommendationProvider:provider??generation,embeddingProvider:embed})});
  await s.app.listen(integrationPort++,'127.0.0.1');t.after(async()=>{await s.app.close();await s.prisma.$disconnect();await s.database.close();});
  const base=await s.app.getUrl();
  const call=async(token,path,body)=>{const response=await fetch(base+'/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{Origin:'http://localhost:3000','X-CSRF-Protection':'1','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const auth=s.app.get(AuthService),login=async email=>{const r=await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'});assert.equal(r.status,200);return {token:r.body.data.accessToken,actor:await auth.authenticateAccessToken('Bearer '+r.body.data.accessToken)};};
  const manager=await login('manager@mobiflow.local'),user=await login('user@mobiflow.local'),staff=await login('staff.iot@mobiflow.local');
  const machine=s.app.get(RequestStateMachineService),service=s.app.get(RecommendationService),vectors=s.app.get(RequestVectors),docs=s.app.get(DocumentService),ingestion=s.app.get(IngestionWorker),worker=s.app.get(AnalysisWorker);
  for(const d of await s.prisma.knowledgeDocument.findMany({where:{status:{not:'DISABLED'}}}))await docs.command(d.id,manager.actor,d.version,'disable',randomUUID(),'Isolate synthetic M6 corpus');
  async function create(text='17 SIM IoT tại Amata mất kết nối từ 8 giờ. Synthetic M6',live=false){
    const id=await machine.create(user.actor,{description:text},randomUUID()),r=await s.prisma.request.findUniqueOrThrow({where:{id}});
    const run=await machine.scheduleAnalysis(id,manager.actor,r.version,false,randomUUID());
    if(live)await worker.tick();else{await machine.claimAnalysis(run.id);await machine.finishAnalysis(run.id,{analysis,identity:{provider:'test',model:'fixture',digest:'test-only'},outputSize:500,retryCount:0,latencyMs:1,firstAttemptValid:true});}
    return s.prisma.request.findUniqueOrThrow({where:{id}});
  }
  // These historical M6/M7 fixtures return V1. V2's default/artifact-only path
  // is verified separately by recommendation-v2.integration.test.mjs.
  async function recommend(r){const run=await service.schedule(r.id,manager.actor,r.version,randomUUID(),'recommendation.v1');await service.cycle(AbortSignal.timeout(300000));return s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}});}
  return {...s,env,base,call,manager,user,staff,machine,service,vectors,docs,ingestion,worker,create,recommend};
}
test('M6 real PostgreSQL tools, atomic pending publication, concurrent scheduling, no business mutation and manager-only delivery',async t=>{
  const s=await setup(t),peer=await s.create(),r=await s.create();await s.vectors.index(peer.id,AbortSignal.timeout(30000));
  for(const [token,status]of [[null,401],[s.user.token,403],[s.staff.token,403]]){
    assert.equal((await s.call(token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:r.version})).status,status);
    assert.equal((await s.call(token,'/manager/requests/'+r.id+'/ai/recommendation')).status,status);
  }
  assert.equal((await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:r.version,actor:'SYSTEM'})).status,400);
  assert.equal((await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:r.version+1})).status,409);
  const runs=await Promise.all([s.service.schedule(r.id,s.manager.actor,r.version,randomUUID(),'recommendation.v1'),s.service.schedule(r.id,s.manager.actor,r.version,randomUUID(),'recommendation.v1')]);assert.equal(runs[0].id,runs[1].id);
  await s.service.cycle(AbortSignal.timeout(300000));const view=await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommendation');recommendationResponseSchema.parse(view.body);
  assert.equal(view.body.data.status,'SUCCEEDED',JSON.stringify(view.body));assert.equal(view.body.data.stale,false);
  assert.equal((await s.call(s.manager.token,'/ai/runs/'+runs[0].id)).body.data.purpose,'RECOMMENDATION');assert.equal((await s.call(s.user.token,'/ai/runs/'+runs[0].id)).status,404);assert.equal((await s.call(s.staff.token,'/ai/runs/'+runs[0].id)).status,403);
  assert.ok(view.body.data.evidence.similar.cases.some(c=>c.requestId===peer.id));assert.equal(view.body.data.toolCalls.length,6);
  const after=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});assert.equal(after.status,'PENDING_APPROVAL');assert.equal(after.reviewKind,'AI');assert.equal(after.currentAssigneeId,null);assert.equal(after.category,null);assert.equal(after.priority,'MEDIUM');assert.equal(after.version,r.version+1);
  for(const table of ['assignment','slaInstance','checklist'])assert.equal(await s.prisma[table].count({where:{requestId:r.id}}),0);
  assert.equal(await s.prisma.requestStatusHistory.count({where:{requestId:r.id,action:'SUBMIT_FOR_APPROVAL'}}),1);
  assert.equal(await s.prisma.notification.count({where:{requestId:r.id,type:'APPROVAL_REQUIRED'}}),1);
  await s.machine.transition(r.id,'MESSAGE',s.user.actor,{expectedVersion:after.version,body:'Thông tin cập nhật.'},randomUUID());assert.equal((await s.service.view(r.id,s.manager.actor)).stale,true);
  for(let i=0;i<3;i++)assert.equal((await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:after.version})).status,409);
  assert.equal((await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:after.version})).status,429);
});
test('M7 manager accepts, modifies or rejects the current AI recommendation with immutable provenance',async t=>{
  async function pending(t){const s=await setup(t),buffer=Buffer.from('# M7 synthetic SOP\n17 SIM IoT tại Amata mất kết nối. Kiểm tra SIM và APN trước khi xử lý.\n'+randomUUID());const doc=await s.docs.upload(s.manager.actor,{title:'M7 approval source '+randomUUID()},{originalname:'m7.txt',mimetype:'text/plain',buffer,size:buffer.length},randomUUID());await s.ingestion.tick();assert.equal((await s.docs.detail(doc.id,s.manager.actor)).status,'READY');const original=await s.create(),run=await s.recommend(original);assert.equal(run.status,'SUCCEEDED',run.errorCode);const request=await s.prisma.request.findUniqueOrThrow({where:{id:original.id}}),recommendation=await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:request.pendingRecommendationId}}),view=await s.service.view(request.id,s.manager.actor);return {s,request,recommendation,view};}
  await t.test('accept is atomic and a concurrent replay loses',async t=>{const {s,request,recommendation}=await pending(t);const body={expectedVersion:request.version,reviewKind:'AI',recommendationId:recommendation.id,acknowledgedMissingFields:[]};const results=await Promise.all([s.call(s.manager.token,'/manager/approvals/'+request.id+'/accept',body),s.call(s.manager.token,'/manager/approvals/'+request.id+'/accept',body)]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);const current=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});assert.equal(current.status,'ASSIGNED');assert.equal(await s.prisma.assignment.count({where:{requestId:request.id,recommendationId:recommendation.id,decisionKind:'AI_ACCEPT'}}),1);assert.equal(await s.prisma.slaInstance.count({where:{requestId:request.id}}),1);assert.equal((await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:recommendation.id}})).status,'ACCEPTED');});
  await t.test('modify retains original and final values separately',async t=>{const {s,request,recommendation,view}=await pending(t),candidate=view.evidence.candidates.candidates[0],decision={category:view.evidence.analysis.category,subcategory:view.evidence.analysis.subcategory,priority:'MEDIUM',teamId:candidate.teamId,staffId:candidate.staffId,actions:[{text:'Kế hoạch do quản lý xác nhận.',required:true,sourceIds:[],provenance:'HUMAN'}],acknowledgedMissingFields:[],reason:'Quản lý điều chỉnh ưu tiên và kế hoạch'};const response=await s.call(s.manager.token,'/manager/approvals/'+request.id+'/modify',{expectedVersion:request.version,reviewKind:'AI',recommendationId:recommendation.id,finalDecision:decision});assert.equal(response.status,200,JSON.stringify(response.body));const reviewed=await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:recommendation.id}});assert.equal(reviewed.status,'MODIFIED');assert.equal(reviewed.suggestedPriority,'HIGH');assert.equal(reviewed.finalDecisionJson.priority,'MEDIUM');assert.equal(reviewed.managerChangesJson.original.priority,'HIGH');});
  await t.test('reject returns to TRIAGED without assignment and preserves artifact',async t=>{const {s,request,recommendation}=await pending(t);const response=await s.call(s.manager.token,'/manager/approvals/'+request.id+'/reject',{expectedVersion:request.version,reviewKind:'AI',recommendationId:recommendation.id,reason:'Nguồn đúng nhưng cần phân loại lại thủ công'});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.data.status,'TRIAGED');assert.equal(await s.prisma.assignment.count({where:{requestId:request.id}}),0);const reviewed=await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:recommendation.id}});assert.equal(reviewed.status,'REJECTED');assert.equal(reviewed.managerChangesJson.reason,'Nguồn đúng nhưng cần phân loại lại thủ công');});
  await t.test('accept rechecks staff availability and leaves the review untouched',async t=>{const {s,request,recommendation}=await pending(t);await s.prisma.user.update({where:{id:recommendation.suggestedStaffId},data:{available:false}});try{const response=await s.call(s.manager.token,'/manager/approvals/'+request.id+'/accept',{expectedVersion:request.version,reviewKind:'AI',recommendationId:recommendation.id,acknowledgedMissingFields:[]});assert.equal(response.status,409,JSON.stringify(response.body));assert.equal(response.body.error.code,'STALE_RECOMMENDATION');assert.equal(await s.prisma.assignment.count({where:{requestId:request.id}}),0);assert.equal((await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:recommendation.id}})).status,'PENDING');assert.equal((await s.prisma.request.findUniqueOrThrow({where:{id:request.id}})).status,'PENDING_APPROVAL');}finally{await s.prisma.user.update({where:{id:recommendation.suggestedStaffId},data:{available:true}});}});
  await t.test('notification failure rolls back decision, assignment, SLA and review status',async t=>{const owner=new URL(process.env.M4_INTEGRATION_OWNER_URL),dbOwner=new Client({connectionString:owner.toString()});await dbOwner.connect();const {s,request,recommendation}=await pending(t);try{await dbOwner.query(`CREATE FUNCTION m7_test_reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic M7 notification failure'; END $$`);await dbOwner.query('CREATE TRIGGER m7_test_notification BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION m7_test_reject_notification()');const response=await s.call(s.manager.token,'/manager/approvals/'+request.id+'/accept',{expectedVersion:request.version,reviewKind:'AI',recommendationId:recommendation.id,acknowledgedMissingFields:[]});assert.equal(response.status,500);assert.equal(await s.prisma.assignment.count({where:{requestId:request.id}}),0);assert.equal(await s.prisma.slaInstance.count({where:{requestId:request.id}}),0);assert.equal((await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:recommendation.id}})).status,'PENDING');assert.equal((await s.prisma.request.findUniqueOrThrow({where:{id:request.id}})).status,'PENDING_APPROVAL');}finally{await dbOwner.query('DROP TRIGGER IF EXISTS m7_test_notification ON "Notification"');await dbOwner.query('DROP FUNCTION IF EXISTS m7_test_reject_notification()');await dbOwner.end();}});
});
test('M6 staff hard filters and exact workload states; candidate precision/recall cases are deterministic',async t=>{
  const s=await setup(t),team='20000000-0000-4000-8000-000000000001',staffId=s.staff.actor.id,rows=[];
  const baseline=await candidates(s.prisma,team,['IOT']);assert.equal(baseline.length,2);
  const check=async(name,expected)=>{const actual=await candidates(s.prisma,team,['IOT']);assert.deepEqual(actual.map(c=>c.staffId).sort(),expected.slice().sort());rows.push({name,expected,actual:actual.map(c=>c.staffId),precision:actual.length?actual.filter(c=>expected.includes(c.staffId)).length/actual.length:null,recall:expected.length?actual.filter(c=>expected.includes(c.staffId)).length/expected.length:null});};
  const ids=baseline.map(c=>c.staffId);await check('multiple valid',ids);
  for(const [name,data,restore]of [['inactive',{active:false},{active:true}],['unavailable',{available:false},{available:true}],['wrong role',{role:'USER'},{role:'STAFF'}]]){await s.prisma.user.update({where:{id:staffId},data});try{await check(name,ids.filter(id=>id!==staffId));}finally{await s.prisma.user.update({where:{id:staffId},data:restore});}}
  await s.prisma.teamMember.updateMany({where:{teamId:team,userId:staffId},data:{active:false}});try{await check('inactive membership',ids.filter(id=>id!==staffId));}finally{await s.prisma.teamMember.updateMany({where:{teamId:team,userId:staffId},data:{active:true}});}
  assert.equal((await candidates(s.prisma,team,['BILLING'])).length,0);rows.push({name:'missing required skill',expected:[],actual:[]});
  await s.prisma.team.update({where:{id:team},data:{active:false}});try{await check('inactive team / zero',[]);}finally{await s.prisma.team.update({where:{id:team},data:{active:true}});}
  const before=baseline.find(c=>c.staffId===staffId).activeWorkload,r=await s.create();
  const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:team,staffId,actions:[],acknowledgedMissingFields:[],reason:'Synthetic workload lifecycle'};
  await s.machine.transition(r.id,'MANUAL_TRIAGE',s.manager.actor,{expectedVersion:r.version,finalDecision:decision},randomUUID());let q=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});
  await s.machine.transition(q.id,'SUBMIT_FOR_APPROVAL',s.manager.actor,{expectedVersion:q.version,manualDraftRevision:q.manualDraftRevision},randomUUID());q=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});
  await s.machine.transition(q.id,'APPROVE_AND_ASSIGN',s.manager.actor,{expectedVersion:q.version,reviewKind:'MANUAL',manualDraftRevision:q.manualDraftRevision,acknowledgedMissingFields:[]},randomUUID());
  assert.equal((await candidates(s.prisma,team,['IOT'])).find(c=>c.staffId===staffId).activeWorkload,before+1);
  for(const [action,actor,body]of [['START_WORK',s.staff.actor,{}],['REQUEST_USER_INFO',s.staff.actor,{body:'Thông tin cần bổ sung?'}],['USER_PROVIDE_INFO',s.user.actor,{body:'Thông tin đã được bổ sung.'}],['RESOLVE',s.staff.actor,{rootCause:'Synthetic cause',resolution:'Synthetic solution',verification:'Synthetic verified'}]]){q=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});await s.machine.transition(q.id,action,actor,{expectedVersion:q.version,...body},randomUUID());assert.equal((await candidates(s.prisma,team,['IOT'])).find(c=>c.staffId===staffId).activeWorkload,before+(action==='RESOLVE'?0:1));}
  await mkdir('docs/verification/evidence',{recursive:true});await writeFile('docs/verification/evidence/M6_CANDIDATE_EVAL.json',JSON.stringify({at:new Date().toISOString(),cases:rows.length,rows,workloadStatesVerified:['ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED'],zeroCandidate:true,multipleCandidate:true},null,2)+'\n');
});
test('M6 late publication rejects request, cancel, initiator and candidate races; results do not overwrite human work',async t=>{
  for(const race of ['message','cancel','staff','actor'])await t.test(race,async t=>{
    let s,r;const hook=async()=>{
      if(race==='message')await s.machine.transition(r.id,'MESSAGE',s.user.actor,{expectedVersion:r.version,body:'Thông tin mới trong lúc AI chạy.'},randomUUID());
      if(race==='cancel')await s.machine.transition(r.id,'CANCEL',s.manager.actor,{expectedVersion:r.version,reason:'Cancel during generation'},randomUUID());
      if(race==='staff')await s.prisma.user.update({where:{id:s.staff.actor.id},data:{available:false}});
      if(race==='actor')await s.prisma.user.update({where:{id:s.manager.actor.id},data:{active:false}});
    };
    s=await setup(t,{hook});r=await s.create();let run;
    try{run=await s.recommend(r);}finally{await s.prisma.user.update({where:{id:s.staff.actor.id},data:{available:true}});await s.prisma.user.update({where:{id:s.manager.actor.id},data:{active:true}});}
    assert.equal(run.status,race==='cancel'?'CANCELED':'FAILED');assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:r.id}}),0);assert.equal(await s.prisma.assignment.count({where:{requestId:r.id}}),0);
    assert.equal((await s.prisma.request.findUniqueOrThrow({where:{id:r.id}})).status,race==='cancel'?'CANCELED':'TRIAGED');
  });
});
test('M6 fake references, LLM offline, embedding offline and tool database errors fail without publishing',async t=>{
  for(const failure of ['fake-staff','fake-source','llm','embedding','tool'])await t.test(failure,async t=>{
    const s=await setup(t,{hook:failure==='fake-staff'?async(e,r)=>{r.suggestedStaffId=randomUUID();}:failure==='fake-source'?async(e,r)=>{r.procedureSources=[{sourceId:'KD-'+randomUUID()+'-G1-C0'}];}:undefined,provider:failure==='llm'?{generateStructured:async()=>{throw new AiFailure('AI_MODEL_UNAVAILABLE');}}:undefined,embed:failure==='embedding'?{...embeddings,embedQuery:async()=>{throw Error('offline');}}:embeddings});
    const r=await s.create();if(failure==='tool')s.app.get(DomainTools).session=()=>({call:async()=>{throw Error('database unavailable');}});
    const run=await s.recommend(r);assert.equal(run.status,'FAILED');assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:r.id}}),0);assert.equal((await s.prisma.request.findUniqueOrThrow({where:{id:r.id}})).status,'TRIAGED');
  });
});
test('M6 empty candidates, message history, vector binding, real endpoint outages, leases and atomic rollback',async t=>{
  await t.test('zero candidate is explicit; latest message included; no history match is success',async t=>{
    const s=await setup(t),r=await s.create();
    await s.machine.transition(r.id,'MESSAGE',s.user.actor,{expectedVersion:r.version,body:'Thông tin bổ sung: Amata, 18 SIM. Không tự assign.'},randomUUID());
    await s.prisma.team.update({where:{code:'NETWORK_OPERATIONS'},data:{active:false}});
    try{const current=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}}),run=await s.recommend(current);assert.equal(run.status,'SUCCEEDED',run.errorCode);const v=await s.service.view(r.id,s.manager.actor);assert.equal(v.recommendation.suggestedStaffId,null);assert.deepEqual(v.evidence.workload.workloads,[]);assert.ok(v.evidence.history.events.some(e=>e.payload.body?.includes('18 SIM')));assert.equal(v.toolCalls.length,5);}finally{await s.prisma.team.update({where:{code:'NETWORK_OPERATIONS'},data:{active:true}});}
  });
  await t.test('self, stale version, incompatible model, canceled and out-of-window vectors excluded',async t=>{
    const s=await setup(t),r=await s.create(),peer=await s.create();await s.vectors.index(r.id,AbortSignal.timeout(30000));await s.vectors.index(peer.id,AbortSignal.timeout(30000));
    const query=(model=identity,now=new Date())=>s.vectors.similar(s.prisma,r.id,model,30,5,now);
    assert.ok((await query()).cases.some(c=>c.requestId===peer.id));assert.ok((await query()).cases.every(c=>c.requestId!==r.id));
    assert.equal((await query({...identity,key:'f'.repeat(64)})).returnedCount,0);
    assert.equal((await query(identity,new Date(Date.now()+31*60000))).returnedCount,0);
    await s.machine.transition(peer.id,'MESSAGE',s.user.actor,{expectedVersion:peer.version,body:'New version excludes old embedding.'},randomUUID());assert.ok((await query()).cases.every(c=>c.requestId!==peer.id));
    await s.vectors.index(peer.id,AbortSignal.timeout(30000));await s.machine.transition(peer.id,'CANCEL',s.user.actor,{expectedVersion:peer.version+1,reason:'Synthetic exclusion'},randomUUID());assert.ok((await query()).cases.every(c=>c.requestId!==peer.id));
  });
  for(const kind of ['llm','embedding'])await t.test('actual HTTP adapter '+kind+' offline',async t=>{
    const s=await setup(t,{real:true,envOverrides:kind==='llm'?{OLLAMA_BASE_URL:'http://127.0.0.1:1',EMBEDDING_BASE_URL:process.env.EMBEDDING_BASE_URL??process.env.OLLAMA_BASE_URL,AI_ATTEMPT_TIMEOUT_MS:'1000'}:{EMBEDDING_BASE_URL:'http://127.0.0.1:1',EMBEDDING_TIMEOUT_MS:'250'}}),r=await s.create(),run=await s.recommend(r);
    assert.equal(run.status,'FAILED');assert.equal(run.errorCode,kind==='llm'?'AI_PROVIDER_UNAVAILABLE':'EMBEDDING_UNAVAILABLE');assert.equal((await s.prisma.request.findUniqueOrThrow({where:{id:r.id}})).status,'TRIAGED');assert.equal((await fetch(s.base+'/health/live')).status,200);
    await s.machine.transition(r.id,'MESSAGE',s.user.actor,{expectedVersion:r.version,body:'Manual messaging remains available.'},randomUUID());
  });
  await t.test('expired durable recommendation lease is failed without state transition',async t=>{
    const s=await setup(t),r=await s.create(),run=await s.service.schedule(r.id,s.manager.actor,r.version,randomUUID());await s.prisma.aiRun.update({where:{id:run.id},data:{status:'RUNNING',leaseUntil:new Date(Date.now()-1000)}});await s.service.cycle(AbortSignal.timeout(30000));assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}})).errorCode,'AI_TIMEOUT');assert.equal((await s.prisma.request.findUniqueOrThrow({where:{id:r.id}})).status,'TRIAGED');
  });
  await t.test('notification database failure rolls back recommendation, history and pending pointer',async t=>{
    const owner=new URL(process.env.M4_INTEGRATION_OWNER_URL);assert.equal(owner.pathname,'/mobiflow_m2_test');const dbOwner=new Client({connectionString:owner.toString()});await dbOwner.connect();
    const s=await setup(t),r=await s.create();
    try{
      await dbOwner.query(`CREATE FUNCTION m6_test_reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic notification failure'; END $$`);
      await dbOwner.query('CREATE TRIGGER m6_test_notification BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION m6_test_reject_notification()');
      const run=await s.recommend(r);assert.equal(run.status,'FAILED');assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:r.id}}),0);assert.equal(await s.prisma.requestStatusHistory.count({where:{requestId:r.id,action:'SUBMIT_FOR_APPROVAL'}}),0);const current=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});assert.equal(current.version,r.version);assert.equal(current.pendingRecommendationId,null);
    }finally{await dbOwner.query('DROP TRIGGER IF EXISTS m6_test_notification ON "Notification"');await dbOwner.query('DROP FUNCTION IF EXISTS m6_test_reject_notification()');await dbOwner.end();}
  });
});

test('M6 source disable and policy changes invalidate publication and delivery',async t=>{
  for(const change of ['source','policy'])await t.test(change,async t=>{
    let s;const hook=async e=>{if(change==='source'){const doc=await s.prisma.knowledgeDocument.findUniqueOrThrow({where:{id:e.sources[0].documentId}});await s.docs.command(doc.id,s.manager.actor,doc.version,'disable',randomUUID(),'Synthetic race');}else await s.prisma.slaPolicy.update({where:{id:e.policy.id},data:{version:{increment:1}}});};
    s=await setup(t,{hook});const buffer=Buffer.from('# Synthetic SOP\n17 SIM IoT tại Amata mất kết nối từ 8 giờ. Kiểm tra SIM và APN; không tự phân công.');const doc=await s.docs.upload(s.manager.actor,{title:'Synthetic source race '+change},{originalname:'m6-'+change+'.txt',mimetype:'text/plain',buffer:Buffer.concat([buffer,Buffer.from('\n'+change)]),size:buffer.length+change.length+1},randomUUID());await s.ingestion.tick();assert.equal((await s.docs.detail(doc.id,s.manager.actor)).status,'READY');
    const r=await s.create(),run=await s.recommend(r);assert.equal(run.status,'FAILED');assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:r.id}}),0);
  });
  await t.test('published source becomes stale at delivery; immutable suggestion retained',async t=>{
    const s=await setup(t),buffer=Buffer.from('# Synthetic delivery SOP\nSIM IoT tại Amata mất kết nối. Kiểm tra APN và SIM.');
    const doc=await s.docs.upload(s.manager.actor,{title:'Synthetic delivery source'},{originalname:'m6-delivery.txt',mimetype:'text/plain',buffer,size:buffer.length},randomUUID());await s.ingestion.tick();const r=await s.create(),run=await s.recommend(r);assert.equal(run.status,'SUCCEEDED',run.errorCode);const before=await s.service.view(r.id,s.manager.actor);assert.equal(before.stale,false);
    const current=await s.prisma.knowledgeDocument.findUniqueOrThrow({where:{id:doc.id}});await s.docs.command(doc.id,s.manager.actor,current.version,'disable',randomUUID(),'Synthetic availability change');const after=await s.service.view(r.id,s.manager.actor);assert.equal(after.stale,true);assert.ok(after.staleReasons.includes('STALE_SOURCE'));assert.deepEqual(after.recommendation,before.recommendation);
  });
});

test('M8 Copilot adoption, canonical SLA assessment, factual summary and immutable feedback use real PostgreSQL',async t=>{
  const provider={generateStructured:async messages=>{
    const body=messages[1].content.slice(messages[1].content.indexOf('\n')+1),facts=JSON.parse(body.slice(0,body.indexOf('\nALLOWED_')));
    if(messages[0].content.includes('Tạo tóm tắt')){
      const event=facts.events.at(-1)??facts.events[0];
      return {raw:JSON.stringify({executiveSummary:facts.executiveSummary,timeline:[{eventId:event.eventId,summary:event.summary}]}),outputSize:500,identity:{provider:'test',model:'m8-fixture',digest:'test-only'}};
    }
    const source=facts.sources[0];return {raw:JSON.stringify({message:'Checklist nháp dựa trên trạng thái hiện tại.',items:source?[{text:'Xác minh kết nối thiết bị tại hiện trường',sourceIds:[source.sourceId]}]:[]}),outputSize:400,identity:{provider:'test',model:'m8-fixture',digest:'test-only'}};
  }};
  const s=await setup(t,{provider}),operational=s.app.get((await import('../dist/ai/operational-ai.service.js')).OperationalAiService),monitor=s.app.get((await import('../dist/requests/sla-monitor.service.js')).SlaMonitorService);
  const completeOperational=async runId=>{for(let i=0;i<100;i++){const run=await s.prisma.aiRun.findUniqueOrThrow({where:{id:runId}});if(['SUCCEEDED','FAILED','CANCELED'].includes(run.status))return run;await operational.cycle(AbortSignal.timeout(30000));}throw new Error('Operational run did not reach a terminal state within the bounded integration drain.');};
  const sop=Buffer.from('# SOP M8\nXác minh kết nối thiết bị tại hiện trường trước khi hoàn tất xử lý. '+randomUUID());const doc=await s.docs.upload(s.manager.actor,{title:'SOP M8 checklist'},{originalname:'m8.txt',mimetype:'text/plain',buffer:sop,size:sop.length},randomUUID());await s.ingestion.tick();assert.equal((await s.docs.detail(doc.id,s.manager.actor)).status,'READY');
  let r=await s.create('Thiết bị mất kết nối cần xử lý theo checklist M8.');
  const team='20000000-0000-4000-8000-000000000001',decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:team,staffId:s.staff.actor.id,actions:[],acknowledgedMissingFields:[],reason:'Phương án M8 tổng hợp'};
  await s.machine.transition(r.id,'MANUAL_TRIAGE',s.manager.actor,{expectedVersion:r.version,finalDecision:decision},randomUUID());r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});
  await s.machine.transition(r.id,'SUBMIT_FOR_APPROVAL',s.manager.actor,{expectedVersion:r.version,manualDraftRevision:r.manualDraftRevision},randomUUID());r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});
  await s.machine.transition(r.id,'APPROVE_AND_ASSIGN',s.manager.actor,{expectedVersion:r.version,reviewKind:'MANUAL',manualDraftRevision:r.manualDraftRevision,acknowledgedMissingFields:[]},randomUUID());r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});
  await s.machine.transition(r.id,'START_WORK',s.staff.actor,{expectedVersion:r.version},randomUUID());r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});
  assert.equal((await s.call(s.user.token,'/requests/'+r.id+'/ai/copilot/action',{expectedVersion:r.version,action:'GENERATE_CHECKLIST'})).status,403);
  const queued=await s.call(s.staff.token,'/requests/'+r.id+'/ai/copilot/action',{expectedVersion:r.version,action:'GENERATE_CHECKLIST'});assert.equal(queued.status,202,JSON.stringify(queued.body));
  await completeOperational(queued.body.data.aiRunId);
  const job=await s.call(s.staff.token,'/ai/operational-runs/'+queued.body.data.aiRunId);assert.equal(job.body.data.status,'SUCCEEDED',JSON.stringify(job.body));assert.equal(job.body.data.result.checklistDraft.length,1);
  const adopted=await s.call(s.staff.token,'/requests/'+r.id+'/checklist',{expectedVersion:r.version,sourceRunId:queued.body.data.aiRunId,items:job.body.data.result.checklistDraft});assert.equal(adopted.status,200,JSON.stringify(adopted.body));r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});const item=await s.prisma.checklistItem.findFirstOrThrow({where:{checklist:{requestId:r.id}}});
  assert.equal((await s.call(s.staff.token,'/requests/'+r.id+'/checklist',{expectedVersion:r.version,sourceRunId:queued.body.data.aiRunId,items:job.body.data.result.checklistDraft})).status,409);
  assert.equal((await s.call(s.staff.token,'/requests/'+r.id+'/checklist/'+item.id,{expectedVersion:r.version,operation:'COMPLETE'})).status,404); // helper is POST-only; PATCH is separately covered by workflow integration.
  await s.machine.transition(r.id,'CHECKLIST_EDIT',s.staff.actor,{expectedVersion:r.version,itemId:item.id,operation:'COMPLETE'},randomUUID());r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});
  // M12's canonical monitor persists clock assessment; M22 owns delivery and
  // its deduplication gate. The legacy monitor must not emit notifications.
  const sla=await s.prisma.slaInstance.findUniqueOrThrow({where:{requestId:r.id}}),notices=await s.prisma.notification.count();const riskAt=new Date(sla.startedAt.getTime()+sla.targetSeconds*800);await monitor.tick(riskAt);await monitor.tick(riskAt);assert.equal((await s.prisma.slaInstance.findUniqueOrThrow({where:{id:sla.id}})).status,'AT_RISK');assert.equal(await s.prisma.notification.count(),notices);
  await s.machine.transition(r.id,'RESOLVE',s.staff.actor,{expectedVersion:r.version,rootCause:'Mất kết nối tại thiết bị đầu cuối',resolution:'Khôi phục cấu hình kết nối thiết bị',verification:'Thiết bị đã kết nối và truyền dữ liệu'},randomUUID());r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id},include:{currentResolution:true}});const queuedSummary=await s.prisma.aiRun.findFirstOrThrow({where:{resolutionId:r.currentResolutionId,purpose:'RESOLUTION_SUMMARY'},orderBy:{createdAt:'desc'}});assert.equal(queuedSummary.promptVersion,resolutionSummaryPromptVersion);await completeOperational(queuedSummary.id);const summary=await s.prisma.aiRun.findUniqueOrThrow({where:{id:queuedSummary.id}});assert.equal(summary.status,'SUCCEEDED',summary.errorCode);assert.equal(summary.safeResultJson.rootCause,r.currentResolution.rootCause);
  await s.machine.transition(r.id,'USER_CONFIRM',s.user.actor,{expectedVersion:r.version},randomUUID());r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});assert.equal((await s.call(s.user.token,'/requests/'+r.id+'/feedback',{expectedVersion:r.version,rating:5,comment:'Đã xử lý tốt'})).status,201);r=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}});assert.equal((await s.call(s.user.token,'/requests/'+r.id+'/feedback',{expectedVersion:r.version,rating:4})).status,409);assert.equal(await s.prisma.feedback.count({where:{requestId:r.id}}),1);
});

test('M9 analytics are manager-only, bounded, historical and exclude private prompt content',async t=>{
  const s=await setup(t),r=await s.create();
  const run=await s.prisma.aiRun.findFirstOrThrow({where:{requestId:r.id,purpose:'ANALYSIS'},orderBy:{createdAt:'desc'}});
  await s.prisma.aiRun.update({where:{id:run.id},data:{latencyMs:123,retryCount:1,errorSummary:'safe classification only'}});
  for(const [token,status] of [[null,401],[s.user.token,403],[s.staff.token,403]])assert.equal((await s.call(token,'/analytics?windowDays=30')).status,status);
  assert.equal((await s.call(s.manager.token,'/analytics?windowDays=0')).status,400);assert.equal((await s.call(s.manager.token,'/analytics?windowDays=366')).status,400);assert.equal((await s.call(s.manager.token,'/analytics?windowDays=abc')).status,400);
  const response=await s.call(s.manager.token,'/analytics?windowDays=30');assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.data.overview.windowDays,30);assert.ok(response.body.data.ai.runs.total>=1);assert.equal(response.body.data.ai.runs.repairedSuccess>=1,true);
  const serialized=JSON.stringify(response.body);assert.equal(serialized.includes(r.description),false);assert.equal(serialized.includes('"prompt":'),false);assert.equal(serialized.includes('retrievalSnapshotJson'),false);assert.equal(serialized.includes('safeResultJson'),false);
});

test('M6 actual Ollama embeddings, scoped PostgreSQL similarity, fixed evaluations and real grounded recommendation pipeline',async t=>{
  const s=await setup(t,{real:true}),raw=await readFile('datasets/ai-evaluation/m6-cases.json','utf8'),dataset=JSON.parse(raw),hash=createHash('sha256').update(raw).digest('hex');
  const manifest=JSON.parse(await readFile('datasets/knowledge/manifest.json','utf8'));
  for(const m of manifest){const buffer=await readFile('datasets/knowledge/'+m.file);let doc=await s.prisma.knowledgeDocument.findUnique({where:{sha256:createHash('sha256').update(buffer).digest('hex')}});if(doc){await s.docs.command(doc.id,s.manager.actor,doc.version,'reindex',randomUUID());}else{doc=await s.docs.upload(s.manager.actor,{title:m.title},{originalname:m.file,mimetype:m.file.endsWith('.pdf')?'application/pdf':'text/plain',buffer,size:buffer.length},randomUUID());}await s.ingestion.tick();assert.equal((await s.docs.detail(doc.id,s.manager.actor)).status,'READY');}
  const corpus=[];for(const c of dataset.corpus){const r=await s.create(c.text,true);assert.equal(r.status,'TRIAGED');const indexed=await s.vectors.index(r.id,AbortSignal.timeout(60000));corpus.push({...c,id:r.id,identity:indexed.identity});}
  const similar=[];
  for(const c of dataset.similarQueries){const r=await s.create(c.text,true);assert.equal(r.status,'TRIAGED');const indexed=await s.vectors.index(r.id,AbortSignal.timeout(60000));const start=performance.now(),result=await s.vectors.similar(s.prisma,r.id,indexed.identity,30,5,new Date());const expected=corpus.filter(p=>c.expected.includes(p.code)).map(p=>p.id),rank=result.cases.findIndex(p=>expected.includes(p.requestId))+1;
    similar.push({id:c.id,expected,rank,returned:result.cases,negative:!expected.length,latencyMs:Math.round(performance.now()-start)});
    const scoped=await s.vectors.similar(s.prisma,r.id,indexed.identity,30,5,new Date(),s.staff.actor.id);assert.ok(scoped.cases.every(c=>c.requestId!==r.id));assert.equal(scoped.returnedCount,0);
    await s.machine.transition(r.id,'CANCEL',s.manager.actor,{expectedVersion:r.version,reason:'Synthetic query evaluation complete; exclude query from subsequent candidates'},randomUUID());
  }
  const positives=similar.filter(r=>!r.negative),negatives=similar.filter(r=>r.negative),similarMetrics={cases:similar.length,positives:positives.length,Hit1:positives.filter(r=>r.rank===1).length/positives.length,Hit3:positives.filter(r=>r.rank>0&&r.rank<=3).length/positives.length,Hit5:positives.filter(r=>r.rank>0&&r.rank<=5).length/positives.length,MRR:positives.reduce((v,r)=>v+(r.rank?1/r.rank:0),0)/positives.length,negativeNoMatch:negatives.filter(r=>!r.returned.length).length,negatives:negatives.length};
  await writeFile('docs/verification/evidence/M6_SIMILAR_CASE_EVAL.json',JSON.stringify({at:new Date().toISOString(),datasetHash:hash,identity:corpus[0].identity,metrics:similarMetrics,results:similar},null,2)+'\n');
  const recommendations=[];
  for(const c of dataset.recommendations){const r=await s.create(c.input,true);if(r.status!=='TRIAGED'){recommendations.push({id:c.id,status:'FAILED_ANALYSIS'});continue;}const run=await s.recommend(r),view=await s.service.view(r.id,s.manager.actor);const rec=view.recommendation,e=view.evidence;
    recommendations.push({id:c.id,status:run.status,errorCode:run.errorCode,latencyMs:run.latencyMs,identity:run.modelIdentityJson,requestId:r.id,analysisCategory:e?.analysis.category??null,categoryMatch:e?.analysis.category===c.category,priorityMatch:rec?.suggestedPriority===c.priority,candidateMatch:rec?.suggestedStaffId?e.candidates.candidates.find(p=>p.staffId===rec.suggestedStaffId)?.skillCodes.includes(c.skill):false,referenceValid:run.status==='SUCCEEDED',schemaValid:run.status==='SUCCEEDED',recommendation:rec,toolCalls:view.toolCalls,sourceIds:e?.sources.map(p=>p.sourceId)??[],missingFields:e?.analysis.missingFields??[]});
    assert.equal(await s.prisma.assignment.count({where:{requestId:r.id}}),0);assert.equal(await s.prisma.slaInstance.count({where:{requestId:r.id}}),0);
    const failures=await s.prisma.auditLog.findMany({where:{resourceId:run.id,action:'RECOMMENDATION_ATTEMPT_FAILED'},select:{safeAfterJson:true}});
    recommendations.at(-1).attemptFailures=failures.map(f=>f.safeAfterJson);
    await writeFile('docs/verification/evidence/M6_RECOMMENDATION_PROGRESS.json',JSON.stringify({at:new Date().toISOString(),datasetHash:hash,status:'IN_PROGRESS',results:recommendations}));
    console.log(JSON.stringify({id:c.id,status:run.status,errorCode:run.errorCode,failures}));
  }
  const times=recommendations.map(r=>r.latencyMs).filter(Number.isFinite).sort((a,b)=>a-b),metrics={cases:recommendations.length,schemaValid:recommendations.filter(r=>r.schemaValid).length,referenceValid:recommendations.filter(r=>r.referenceValid).length,candidateValid:recommendations.filter(r=>r.referenceValid).length,category:recommendations.filter(r=>r.categoryMatch).length,priority:recommendations.filter(r=>r.priorityMatch).length,staffRecommendation:recommendations.filter(r=>r.candidateMatch).length,p50:times[Math.ceil(times.length*.5)-1],p95:times[Math.ceil(times.length*.95)-1]};
  await writeFile('docs/verification/evidence/M6_RECOMMENDATION_EVAL.json',JSON.stringify({at:new Date().toISOString(),datasetHash:hash,metrics,results:recommendations,limitations:'Small synthetic development set; ID membership does not establish semantic correctness. Model disagreement is retained; no generalized accuracy claim.'},null,2)+'\n');
  await writeFile('docs/verification/evidence/M6_RECOMMENDATION_PROGRESS.json',JSON.stringify({at:new Date().toISOString(),datasetHash:hash,status:'COMPLETED',metrics,results:recommendations},null,2)+'\n');
  assert.equal(recommendations[0].status,'SUCCEEDED','Primary actual-model gate failed');assert.ok(recommendations[0].sourceIds.length);assert.equal(recommendations[0].analysisCategory,'NETWORK');
});
