import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
import {recommendationResponseSchema} from '@mobiflow/contracts';
import {AiFailure} from '../dist/ai/provider.js';
import {saveEvidence} from '../../../scripts/verification/evidence.mjs';
import {createRecommendationHarness,businessSnapshot,humanDecision,syntheticAnalysis,syntheticEmbeddings,recommendationFixture} from './helpers/recommendation-v2-fixture.mjs';
import {decideRecommendationEvidence} from '../dist/ai/recommendation-evidence-decision.js';
import {recommendationSnapshot} from '../dist/ai/recommendation-snapshot.js';
import {parseRecommendationV2} from '../dist/ai/recommendation-output.js';

const databaseUrl=process.env.M14_DATABASE_URL;
if(!databaseUrl||new URL(databaseUrl).pathname!=='/mobiflow_m14_test'||!['localhost','127.0.0.1'].includes(new URL(databaseUrl).hostname))throw new Error('Dedicated local M14 test DB required');
const path=id=>'/manager/requests/'+id+'/ai/recommendation';
const review=(s,r,view,kind,extra={})=>s.call(s.manager.token,'/manager/approvals/'+r.id+'/'+kind,{expectedVersion:r.version,reviewKind:'AI',recommendationId:view.recommendationId,...extra});

test('V1.3 real PostgreSQL evidence decision publication, bounded repair and historical compatibility',async t=>{
  const checks=[];
  const check=async(name,work,options={})=>t.test(name,async()=>{const s=await createRecommendationHarness(databaseUrl,options),start=performance.now();try{await work(s);checks.push({name,result:'PASS',durationMs:Math.round(performance.now()-start)});}catch(error){checks.push({name,result:'FAIL',message:error.message});throw error;}finally{await s.close();}});
  try{
    await check('relevant MOBILE procedure plus missing location and no candidates publishes sufficient advisory without business mutation',async s=>{
      await s.upload('Áp dụng khi điện thoại di động bị mất sóng. Xác nhận phạm vi và kiểm tra trạng thái SIM; ghi lại kết quả để quản lý xem xét. '+randomUUID(),'Nguồn kiểm tra điện thoại');
      const staff=await s.prisma.user.findMany({where:{role:'STAFF',available:true}});await s.prisma.user.updateMany({where:{id:{in:staff.map(user=>user.id)}},data:{available:false}});
      try{
        const analysis={...syntheticAnalysis,subcategory:'MOBILE_NETWORK',entities:{...syntheticAnalysis.entities,location:null},missingFields:['location']};
        const request=await s.create(undefined,analysis),before=await businessSnapshot(s.prisma,request.id),run=await s.recommend(request),view=await s.service.view(request.id,s.manager.actor);
        assert.equal(run.status,'SUCCEEDED',run.errorCode);assert.equal(run.retryCount,0);assert.equal(view.recommendation.evidenceStatus,'SUFFICIENT');assert.equal(view.recommendation.recommendedAction.action,'REQUEST_USER_INFO');assert.equal(view.recommendation.suggestedStaffId,null);assert.equal(view.recommendation.suggestedTeamId,null);assert.deepEqual(view.recommendation.missingInformation.map(item=>item.field),['location']);assert.equal(view.recommendation.procedureSources.length,1);assert.deepEqual(view.recommendation.suggestedChecklist,[]);assert.equal(view.recommendation.warnings.some(w=>w.code==='INSUFFICIENT_EVIDENCE'),false);
        const stored=recommendationSnapshot(run.retrievalSnapshotJson);assert.equal(stored.evidenceDecision.evidenceStatus,'SUFFICIENT');assert.deepEqual(stored.evidenceDecision.selectedProcedureSourceIds,view.recommendation.procedureSources.map(source=>source.sourceId));assert.equal(JSON.stringify(view).includes('_evidenceDecision'),false);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
      }finally{await s.prisma.user.updateMany({where:{id:{in:staff.map(user=>user.id)}},data:{available:true}});}
    });
    const seen=[];
    await check('one rejected status flip repairs under identical backend decision and publishes only the validated attempt',async s=>{
      await s.upload();const request=await s.create(),before=await businessSnapshot(s.prisma,request.id),run=await s.recommend(request);
      assert.equal(run.status,'SUCCEEDED',run.errorCode);assert.equal(run.retryCount,1);assert.equal(seen.length,2);assert.deepEqual(seen[0],seen[1]);
      const failures=await s.prisma.auditLog.findMany({where:{resourceId:run.id,action:'RECOMMENDATION_ATTEMPT_FAILED'}});assert.equal(failures.length,1);assert.equal(failures[0].safeAfterJson.validationRule,'EVIDENCE_DECISION_MISMATCH');assert.equal(await s.prisma.aiRecommendation.count({where:{aiRunId:run.id}}),1);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    },{hook:async(e,r,signal,format,decision)=>{seen.push({decision,format});if(seen.length===1){r.evidenceStatus='INSUFFICIENT_EVIDENCE';r.procedureSources=[];r.suggestedChecklist=[];r.warnings.push({code:'INSUFFICIENT_EVIDENCE',text:'Synthetic deliberate invalid branch.',referenceIds:[e.requestContext.id]});}}});
    const rejectedDecisions=[];
    await check('both invalid provider attempts fail with retained decision and no artifact or business changes',async s=>{
      await s.upload();const request=await s.create(),before=await businessSnapshot(s.prisma,request.id),run=await s.recommend(request);
      assert.equal(run.status,'FAILED');assert.equal(run.errorCode,'INVALID_REFERENCE');assert.equal(run.retryCount,1);assert.equal(rejectedDecisions.length,2);assert.deepEqual(rejectedDecisions[0],rejectedDecisions[1]);assert.deepEqual(recommendationSnapshot(run.retrievalSnapshotJson).evidenceDecision,rejectedDecisions[0]);
      const failures=await s.prisma.auditLog.findMany({where:{resourceId:run.id,action:'RECOMMENDATION_ATTEMPT_FAILED'}});assert.equal(failures.length,2);assert.ok(failures.every(failure=>failure.safeAfterJson.validationRule==='EVIDENCE_DECISION_MISMATCH'));assert.equal(await s.prisma.aiRecommendation.count({where:{aiRunId:run.id}}),0);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    },{hook:async(e,r,signal,format,decision)=>{rejectedDecisions.push(decision);r.evidenceStatus='INSUFFICIENT_EVIDENCE';r.procedureSources=[];r.suggestedChecklist=[];r.warnings.push({code:'INSUFFICIENT_EVIDENCE',text:'Synthetic deliberate invalid branch.',referenceIds:[e.requestContext.id]});}});
    for(const mutation of ['sufficient-to-insufficient','insufficient-to-sufficient','forged-decision','missing-decision','unselected-procedure'])await check('direct publication blocks '+mutation+' before invalidating pending artifact or writing business state',async s=>{
      if(mutation==='insufficient-to-sufficient')await s.upload('Khi có sai lệch hóa đơn, đối chiếu kỳ cước. Phân loại tham khảo BILLING / BILLING_DISCREPANCY. '+randomUUID(),'Nguồn hóa đơn');else await s.upload();
      if(mutation==='unselected-procedure')await s.upload('Áp dụng cho SIM IoT mất kết nối. Xác nhận trạng thái APN, ghi lại kết quả. Phân loại NETWORK / IOT_CONNECTIVITY. '+randomUUID(),'Một nguồn kiểm tra khác');
      const request=await s.create(),before=await businessSnapshot(s.prisma,request.id),original=await s.recommend(request);assert.equal(original.status,'SUCCEEDED',original.errorCode);const view=await s.service.view(request.id,s.manager.actor),e=view.evidence,d=decideRecommendationEvidence(e,s.env.RAG_MAX_DISTANCE),run=await s.service.schedule(request.id,s.manager.actor,request.version,randomUUID());
      const authorization=recommendationSnapshot(run.retrievalSnapshotJson).authorization,snapshot={...e,_authorization:authorization,_evidenceDecision:globalThis.structuredClone(d)};
      let result=globalThis.structuredClone(view.recommendation),expectedRule;
      if(mutation==='sufficient-to-insufficient'){result.evidenceStatus='INSUFFICIENT_EVIDENCE';result.procedureSources=[];result.suggestedChecklist=[];result.warnings.push({code:'INSUFFICIENT_EVIDENCE',text:'Synthetic invalid flip.',referenceIds:[request.id]});expectedRule='EVIDENCE_DECISION_MISMATCH';}
      if(mutation==='insufficient-to-sufficient'){assert.equal(e.sources.length>0,true);assert.equal(d.evidenceStatus,'INSUFFICIENT_EVIDENCE');result=recommendationFixture(e);expectedRule='EVIDENCE_DECISION_MISMATCH';}
      if(mutation==='forged-decision'){snapshot._evidenceDecision.evidenceStatus='INSUFFICIENT_EVIDENCE';snapshot._evidenceDecision.evidenceReasonCode='NO_ALLOWED_RELEVANT_PROCEDURE';snapshot._evidenceDecision.eligibleProcedureSourceIds=[];snapshot._evidenceDecision.selectedProcedureSourceIds=[];expectedRule='EVIDENCE_DECISION_CONTEXT_MISMATCH';}
      if(mutation==='missing-decision')delete snapshot._evidenceDecision;
      if(mutation==='unselected-procedure'){const alternative=e.sources.find(source=>!d.selectedProcedureSourceIds.includes(source.sourceId));assert.ok(alternative);result.procedureSources=[{sourceId:alternative.sourceId}];result.suggestedChecklist=[];result.evidence=[result.evidence[0],{type:'KNOWLEDGE',referenceId:alternative.sourceId,excerpt:alternative.excerpt.slice(0,200),relevance:'Nguồn kiến thức được truy xuất để tham khảo.'}];expectedRule='PROCEDURE_DECISION_MEMBERSHIP';}
      assert.doesNotThrow(()=>parseRecommendationV2(JSON.stringify(result),e),'Old public parser accepts the controlled bypass, so this exercises the new independent guard.');
      await s.prisma.aiRun.update({where:{id:run.id},data:{status:'RUNNING',startedAt:new Date(),retrievalSnapshotJson:snapshot}});
      const artifactsBefore=await s.prisma.aiRecommendation.findMany({where:{requestId:request.id},orderBy:{id:'asc'}}),auditsBefore=await s.prisma.auditLog.count({where:{requestId:request.id}});
      await assert.rejects(()=>s.machine.publishRecommendation(run.id,result,{provider:'test',model:'guard',digest:'test-only'},100,1),error=>mutation==='missing-decision'?error.code==='AI_INVALID_CONTEXT':error.code==='INVALID_REFERENCE'&&error.repairFeedback.startsWith(expectedRule+':'));
      assert.deepEqual(await s.prisma.aiRecommendation.findMany({where:{requestId:request.id},orderBy:{id:'asc'}}),artifactsBefore);assert.equal(await s.prisma.auditLog.count({where:{requestId:request.id}}),auditsBefore);assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}})).status,'RUNNING');assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    });
    await check('historical V2 insufficient choice without decision metadata remains readable and reviewable',async s=>{
      const {request,before,run,view}=await ready(s),stored=recommendationSnapshot(run.retrievalSnapshotJson),historical=globalThis.structuredClone(view.recommendation);
      historical.evidenceStatus='INSUFFICIENT_EVIDENCE';historical.procedureSources=[];historical.suggestedChecklist=[];historical.warnings.push({code:'INSUFFICIENT_EVIDENCE',text:'Historical decision requiring human verification.',referenceIds:[request.id]});
      await s.prisma.aiRun.update({where:{id:run.id},data:{promptVersion:'grounded-recommendation.v2.12',safeResultJson:historical,retrievalSnapshotJson:{...stored.evidence,_authorization:stored.authorization}}});
      await s.prisma.aiRecommendation.update({where:{id:view.recommendationId},data:{evidenceStatus:historical.evidenceStatus,procedureRefsJson:[],actionsJson:[]}});
      const response=await s.call(s.manager.token,path(request.id)+'?aiRunId='+run.id);assert.equal(response.status,200);assert.deepEqual(response.body.data.recommendation,historical);assert.equal((await review(s,request,response.body.data,'accept',{acknowledgedMissingFields:[]})).status,200);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    });
  }finally{await saveEvidence(process.env.EVIDENCE_DECISION_DATABASE_PATH??'artifacts/evidence-decision-postgres.json',{at:new Date().toISOString(),synthetic:true,database:'mobiflow_m14_test',provider:'deterministic controlled test provider; not live inference or human review',result:checks.length===9&&checks.every(check=>check.result==='PASS')?'PASS':'FAIL',checks});}
});
async function ready(s,{source=true,analysis=syntheticAnalysis}={}){
  if(source)await s.upload();const request=await s.create(undefined,analysis),before=await businessSnapshot(s.prisma,request.id),run=await s.recommend(request);
  assert.equal(run.status,'SUCCEEDED',run.errorCode);const view=await s.service.view(request.id,s.manager.actor);
  assert.equal(view.schemaVersion,'recommendation.v2');assert.equal(view.reviewStatus,'PENDING');assert.equal(view.stale,false);
  assert.equal(JSON.stringify(view).includes(s.manager.actor.sessionId),false);
  assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
  return {request,before,run,view};
}

test('M14 isolated PostgreSQL recommendation V1/V2 contract, artifact-only reviews, stale/race/security/failure gates',async t=>{
  const checks=[];
  async function check(name,work,options={}){await t.test(name,async()=>{
    const s=await createRecommendationHarness(databaseUrl,options),start=performance.now();
    try{await work(s);checks.push({name,result:'PASS',durationMs:Math.round(performance.now()-start)});}catch(error){checks.push({name,result:'FAIL',message:error.message});throw error;}finally{await s.close();}
  });}
  try{
    await check('thirteen released migrations and nullable legacy confidence; V1 history and explicit approval remain intact',async s=>{
      assert.equal(Number((await s.prisma.$queryRawUnsafe('SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'))[0].count),13);
      const column=(await s.prisma.$queryRawUnsafe(`SELECT is_nullable FROM information_schema.columns WHERE table_name='AiRecommendation' AND column_name='confidence'`))[0];assert.equal(column.is_nullable,'YES');
      await s.upload();const r=await s.create(),run=await s.recommend(r,'recommendation.v1');assert.equal(run.status,'SUCCEEDED',run.errorCode);
      const request=await s.prisma.request.findUniqueOrThrow({where:{id:r.id}}),before=await s.service.view(r.id,s.manager.actor);
      assert.equal(before.schemaVersion,'recommendation.v1');assert.equal(before.recommendation.confidence,.5);assert.equal(request.status,'PENDING_APPROVAL');assert.equal(request.version,r.version+1);
      const response=await review(s,request,before,'accept',{acknowledgedMissingFields:[]});assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.data.status,'ASSIGNED');
      assert.equal(await s.prisma.assignment.count({where:{requestId:r.id,decisionKind:'AI_ACCEPT'}}),1);assert.equal(await s.prisma.slaInstance.count({where:{requestId:r.id}}),1);
      const artifact=await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:before.recommendationId}});assert.equal(Number(artifact.confidence),.5);
      const historical=await s.call(s.manager.token,path(r.id)+'?aiRunId='+run.id);assert.equal(historical.status,200);recommendationResponseSchema.parse(historical.body);assert.deepEqual(historical.body.data.recommendation,before.recommendation);
    });
    await check('V2 HTTP generation, validated read, no confidence and manager-only RBAC/IDOR',async s=>{
      await s.upload();const r=await s.create(),before=await businessSnapshot(s.prisma,r.id);
      for(const [token,status]of [[null,401],[s.user.token,403],[s.staff.token,403]]){
        assert.equal((await s.call(token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:r.version})).status,status);
        assert.equal((await s.call(token,path(r.id))).status,status);
        assert.equal((await s.call(token,'/manager/approvals/'+r.id+'/accept',{expectedVersion:r.version,reviewKind:'AI',recommendationId:randomUUID(),acknowledgedMissingFields:[]})).status,status);
      }
      assert.equal((await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:r.version,schemaVersion:'recommendation.v1'})).status,400);
      const generated=await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:r.version});assert.equal(generated.status,202,JSON.stringify(generated.body));await s.service.cycle(AbortSignal.timeout(30000));
      const response=await s.call(s.manager.token,path(r.id));assert.equal(response.status,200);recommendationResponseSchema.parse(response.body);const v=response.body.data;assert.equal(v.schemaVersion,'recommendation.v2');assert.equal(v.status,'SUCCEEDED');assert.equal(v.stale,false);assert.equal('confidence' in v.recommendation,false);assert.equal(v.evidence.requestContext.version,r.version);assert.equal(v.evidence.requestContext.status,'TRIAGED');assert.match(response.headers.get('cache-control')??'',/no-store/);
      assert.equal((await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:v.recommendationId}})).confidence,null);assert.deepEqual(await businessSnapshot(s.prisma,r.id),before);
      const other=await s.create();assert.equal((await s.call(s.manager.token,path(other.id)+'?aiRunId='+v.aiRunId)).status,404);
      const mismatch=await review(s,other,v,'reject',{reason:'Không thuộc yêu cầu này'});assert.equal(mismatch.status,409);
      const serialized=JSON.stringify(v);for(const secret of ['systemPrompt','rawResponse','accessToken','chainOfThought'])assert.equal(serialized.includes(secret),false);
    });
    await check('ACCEPTED records agreement once, preserves original and has no operational effects',async s=>{
      const {request,before,view,run}=await ready(s),body={acknowledgedMissingFields:[]};
      const response=await review(s,request,view,'accept',body);assert.equal(response.status,200,JSON.stringify(response.body));
      const after=await s.service.view(request.id,s.manager.actor);assert.equal(after.reviewStatus,'ACCEPTED');assert.equal(after.reviewerId,s.manager.actor.id);assert.ok(after.reviewedAt);assert.equal(after.finalDecision,null);assert.deepEqual(after.recommendation,view.recommendation);assert.equal(after.stale,false);
      assert.deepEqual((await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}})).safeResultJson,view.recommendation);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
      const audits=await s.prisma.auditLog.count({where:{resourceId:view.recommendationId,action:'AI_RECOMMENDATION_V2_ACCEPTED'}});assert.equal(audits,1);
      assert.equal((await review(s,request,view,'accept',body)).status,409);assert.equal((await review(s,request,view,'reject',{reason:'Replay'})).status,409);assert.equal(await s.prisma.auditLog.count({where:{resourceId:view.recommendationId,action:'AI_RECOMMENDATION_V2_ACCEPTED'}}),audits);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    });
    await check('MODIFIED stores separate human plan; explicit manual approval alone applies business changes',async s=>{
      const {request,before,view}=await ready(s),decision=humanDecision(view),response=await review(s,request,view,'modify',{finalDecision:decision});assert.equal(response.status,200,JSON.stringify(response.body));
      const after=await s.service.view(request.id,s.manager.actor);assert.equal(after.reviewStatus,'MODIFIED');assert.deepEqual(after.recommendation,view.recommendation);assert.deepEqual(after.finalDecision,decision);assert.deepEqual(after.managerChanges.original,view.recommendation);assert.equal(after.managerChanges.final.priority,'MEDIUM');assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
      await s.machine.transition(request.id,'MANUAL_TRIAGE',s.manager.actor,{expectedVersion:request.version,finalDecision:decision},randomUUID());let current=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});assert.equal(await s.prisma.assignment.count({where:{requestId:request.id}}),0);
      await s.machine.transition(request.id,'SUBMIT_FOR_APPROVAL',s.manager.actor,{expectedVersion:current.version,manualDraftRevision:current.manualDraftRevision},randomUUID());current=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});assert.equal(await s.prisma.assignment.count({where:{requestId:request.id}}),0);
      await s.machine.transition(request.id,'APPROVE_AND_ASSIGN',s.manager.actor,{expectedVersion:current.version,reviewKind:'MANUAL',manualDraftRevision:current.manualDraftRevision,acknowledgedMissingFields:decision.acknowledgedMissingFields},randomUUID());current=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}});assert.equal(current.status,'ASSIGNED');assert.equal(await s.prisma.assignment.count({where:{requestId:request.id,decisionKind:'MANUAL'}}),1);assert.equal(await s.prisma.slaInstance.count({where:{requestId:request.id}}),1);assert.deepEqual((await s.service.view(request.id,s.manager.actor)).recommendation,view.recommendation);
    });
    await check('REJECTED preserves original and reason without request/business mutation',async s=>{
      const {request,before,view}=await ready(s),reason='Quản lý không sử dụng phương án này.';assert.equal((await review(s,request,view,'reject',{reason})).status,200);
      const after=await s.service.view(request.id,s.manager.actor);assert.equal(after.reviewStatus,'REJECTED');assert.equal(after.managerChanges.reason,reason);assert.equal(after.reviewerId,s.manager.actor.id);assert.ok(after.reviewedAt);assert.deepEqual(after.recommendation,view.recommendation);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    });
    await check('zero SOP and missing facts stay explicit; agreement requires exact missing acknowledgement',async s=>{
      const analysis={...syntheticAnalysis,entities:{...syntheticAnalysis.entities,location:null,startedAt:null},missingFields:['location','startedAt']};
      const {request,before,view}=await ready(s,{source:false,analysis});assert.equal(view.recommendation.evidenceStatus,'INSUFFICIENT_EVIDENCE');assert.deepEqual(view.recommendation.procedureSources,[]);assert.deepEqual(view.recommendation.suggestedChecklist,[]);assert.deepEqual(view.recommendation.missingInformation.map(v=>v.field),analysis.missingFields);assert.deepEqual(view.recommendation.warnings.map(v=>v.code).sort(),['INSUFFICIENT_EVIDENCE','MISSING_INFORMATION']);
      assert.equal((await review(s,request,view,'accept',{acknowledgedMissingFields:[]})).status,422);assert.equal((await review(s,request,view,'accept',{acknowledgedMissingFields:analysis.missingFields})).status,200);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    });
    await check('new generation supersedes a pending artifact and request changes make current review stale',async s=>{
      const {request,before,view}=await ready(s),second=await s.recommend(request),old=await s.service.view(request.id,s.manager.actor,view.aiRunId),latest=await s.service.view(request.id,s.manager.actor);
      assert.equal(second.status,'SUCCEEDED');assert.notEqual(latest.recommendationId,view.recommendationId);assert.equal(old.stale,true);assert.deepEqual(old.recommendation,view.recommendation);assert.equal((await review(s,request,old,'reject',{reason:'Superseded'})).status,409);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
      await s.machine.transition(request.id,'MESSAGE',s.user.actor,{expectedVersion:request.version,body:'Dữ kiện mới sau generation.'},randomUUID());const current=await s.prisma.request.findUniqueOrThrow({where:{id:request.id}}),stale=await s.service.view(request.id,s.manager.actor);assert.equal(stale.stale,true);assert.equal((await review(s,current,latest,'accept',{acknowledgedMissingFields:[]})).status,409);assert.equal((await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:latest.recommendationId}})).status,'PENDING');
    });
    for(const mutation of ['source','candidate','policy'])await check('review revalidates '+mutation+' and leaves artifact untouched',async s=>{
      const {request,before,view}=await ready(s);let restore;
      if(mutation==='source'){const source=view.evidence.sources[0],doc=await s.prisma.knowledgeDocument.findUniqueOrThrow({where:{id:source.documentId}});await s.docs.command(doc.id,s.manager.actor,doc.version,'disable',randomUUID(),'Synthetic M14 source invalidation');}
      if(mutation==='candidate'){const id=view.recommendation.suggestedStaffId;await s.prisma.user.update({where:{id},data:{available:false}});restore=()=>s.prisma.user.update({where:{id},data:{available:true}});}
      if(mutation==='policy'){const policy=view.evidence.policy;await s.prisma.slaPolicy.update({where:{id:policy.id},data:{version:{increment:1}}});restore=()=>s.prisma.slaPolicy.update({where:{id:policy.id},data:{version:policy.version}});}
      try{assert.equal((await s.service.view(request.id,s.manager.actor)).stale,true);for(const kind of ['accept','modify','reject'])assert.equal((await review(s,request,view,kind,kind==='modify'?{finalDecision:humanDecision(view)}:kind==='reject'?{reason:'Recheck'}:{acknowledgedMissingFields:[]})).status,409);assert.equal((await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:view.recommendationId}})).status,'PENDING');assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);}finally{if(restore)await restore();}
    });
    await check('inactive, changed-role and revoked manager sessions cannot read/generate/review',async s=>{
      const {request,before,view}=await ready(s);
      for(const mutation of ['inactive','role','revoked']){
        const manager=await s.login('manager@mobiflow.local');
        if(mutation==='revoked')await s.prisma.refreshSession.update({where:{id:manager.actor.sessionId},data:{revokedAt:new Date()}});
        else await s.prisma.user.update({where:{id:manager.actor.id},data:mutation==='inactive'?{active:false}:{role:'USER'}});
        try{for(const [route,body]of [[path(request.id),undefined],['/manager/requests/'+request.id+'/ai/recommend',{expectedVersion:request.version}],['/manager/approvals/'+request.id+'/accept',{expectedVersion:request.version,reviewKind:'AI',recommendationId:view.recommendationId,acknowledgedMissingFields:[]}]])assert.ok([401,403].includes((await s.call(manager.token,route,body)).status));}finally{if(mutation!=='revoked')await s.prisma.user.update({where:{id:manager.actor.id},data:{active:true,role:'MANAGER'}});}
      }
      assert.equal((await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:view.recommendationId}})).status,'PENDING');assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    });
    for(const invalidation of ['revoked','expired']){
      let embeddingCalls=0,modelCalls=0;
      await check('queued '+invalidation+' session fails before embedding or inference',async s=>{
        const request=await s.create(),before=await businessSnapshot(s.prisma,request.id),run=await s.service.schedule(request.id,s.manager.actor,request.version,randomUUID());
        const session=await s.prisma.refreshSession.update({where:{id:s.manager.actor.sessionId},data:invalidation==='revoked'?{revokedAt:new Date()}:{createdAt:new Date(Date.now()-60000),expiresAt:new Date(Date.now()-1000)}});
        if(invalidation==='expired')assert.ok(session.expiresAt<new Date()&&session.createdAt<session.expiresAt);else assert.ok(session.revokedAt);
        await s.service.cycle(AbortSignal.timeout(30000));
        const failed=await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}});assert.equal(failed.status,'FAILED');assert.equal(embeddingCalls,0);assert.equal(modelCalls,0);assert.equal(await s.prisma.requestEmbedding.count({where:{requestId:request.id}}),0);assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:request.id}}),0);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
      },{embeddingProvider:{...syntheticEmbeddings,embedQuery:async()=>{embeddingCalls++;return syntheticEmbeddings.embedQuery();}},provider:{generateStructured:async()=>{modelCalls++;throw new Error('Revoked queued run must never call inference');}}});
    }
    await check('concurrent advisory reviews have one winner; audit failure rolls back review',async s=>{
      const {request,before,view}=await ready(s),responses=await Promise.all([review(s,request,view,'accept',{acknowledgedMissingFields:[]}),review(s,request,view,'reject',{reason:'Concurrent review'})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(await s.prisma.auditLog.count({where:{resourceId:view.recommendationId,action:{in:['AI_RECOMMENDATION_V2_ACCEPTED','AI_RECOMMENDATION_V2_REJECTED']}}}),1);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
      const pending=await ready(s),ownerUrl=process.env.M14_OWNER_DATABASE_URL;if(!ownerUrl||new URL(ownerUrl).pathname!=='/mobiflow_m14_test')throw new Error('Isolated owner URL required for rollback fixture');const owner=new Client({connectionString:ownerUrl});await owner.connect();
      try{await owner.query(`CREATE FUNCTION m14_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'AI_RECOMMENDATION_V2_%' AND NEW.action <> 'AI_RECOMMENDATION_V2_CREATED' THEN RAISE EXCEPTION 'synthetic M14 audit failure'; END IF; RETURN NEW; END $$`);await owner.query('CREATE TRIGGER m14_test_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION m14_test_reject_audit()');const response=await review(s,pending.request,pending.view,'accept',{acknowledgedMissingFields:[]});assert.equal(response.status,500);const artifact=await s.prisma.aiRecommendation.findUniqueOrThrow({where:{id:pending.view.recommendationId}});assert.equal(artifact.status,'PENDING');assert.equal(artifact.reviewedAt,null);assert.equal(artifact.managerChangesJson,null);assert.deepEqual(await businessSnapshot(s.prisma,pending.request.id),pending.before);}finally{await owner.query('DROP TRIGGER IF EXISTS m14_test_audit ON "AuditLog"');await owner.query('DROP FUNCTION IF EXISTS m14_test_reject_audit()');await owner.end();}
    });
    for(const race of ['message','candidate','manager','revoked-session','expired-session']){
      let s,request,restore,mutationApplied=false;
      await check('late publication rejects '+race+' race without publishing or erasing human work',async harness=>{
        s=harness;await s.upload();request=await s.create();
        try{const run=await s.recommend(request);assert.equal(mutationApplied,true,'Race fixture mutation must actually complete');assert.equal(run.status,'FAILED');assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:request.id}}),0);assert.equal(await s.prisma.assignment.count({where:{requestId:request.id}}),0);assert.equal((await s.prisma.request.findUniqueOrThrow({where:{id:request.id}})).status,'TRIAGED');if(race==='message')assert.equal(await s.prisma.requestMessage.count({where:{requestId:request.id,body:'New human context during AI generation'}}),1);}finally{if(restore)await restore();}
      },{hook:async(e,r)=>{
        if(race==='message')await s.machine.transition(request.id,'MESSAGE',s.user.actor,{expectedVersion:request.version,body:'New human context during AI generation'},randomUUID());
        if(race==='candidate'){const id=r.suggestedStaffId;await s.prisma.user.update({where:{id},data:{available:false}});restore=()=>s.prisma.user.update({where:{id},data:{available:true}});}
        if(race==='manager'){await s.prisma.user.update({where:{id:s.manager.actor.id},data:{active:false}});restore=()=>s.prisma.user.update({where:{id:s.manager.actor.id},data:{active:true}});}
        if(race==='revoked-session')await s.prisma.refreshSession.update({where:{id:s.manager.actor.sessionId},data:{revokedAt:new Date()}});
        if(race==='expired-session'){const session=await s.prisma.refreshSession.update({where:{id:s.manager.actor.sessionId},data:{createdAt:new Date(Date.now()-60000),expiresAt:new Date(Date.now()-1000)}});assert.ok(session.expiresAt<new Date()&&session.createdAt<session.expiresAt);}
        mutationApplied=true;
      }});
    }
    await check('new generation rejects captured unsupported relevance before publication on both attempts without business changes',async s=>{
      await s.upload();const request=await s.create(),before=await businessSnapshot(s.prisma,request.id),run=await s.recommend(request);
      assert.equal(run.status,'FAILED');assert.equal(run.errorCode,'INVALID_REFERENCE');assert.equal(run.retryCount,1);
      const attempts=await s.prisma.auditLog.findMany({where:{resourceId:run.id,action:'RECOMMENDATION_ATTEMPT_FAILED'},orderBy:{createdAt:'asc'}});
      assert.equal(attempts.length,2);assert.ok(attempts.every(a=>a.safeAfterJson.validationRule==='EVIDENCE_RELEVANCE_PROVENANCE'));
      assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:request.id}}),0);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    },{hook:async(e,r)=>{r.evidence[0].relevance='Dữ kiện mô tả hiện tượng mất kết nối do HTML có event, nhưng';}});
    await check('historical V2 relevance stays readable and reviewable without applying new generation presentation retroactively',async s=>{
      const {request,before,run,view}=await ready(s),historical=globalThis.structuredClone(view.recommendation);
      historical.evidence[0].relevance='Nội dung yêu cầu được cung cấp trong snapshot lịch sử.';
      await s.prisma.aiRun.update({where:{id:run.id},data:{safeResultJson:historical,promptVersion:'grounded-recommendation.v2.11'}});
      const response=await s.call(s.manager.token,path(request.id)+'?aiRunId='+run.id);assert.equal(response.status,200);recommendationResponseSchema.parse(response.body);assert.deepEqual(response.body.data.recommendation,historical);
      const accepted=await review(s,request,response.body.data,'accept',{acknowledgedMissingFields:[]});assert.equal(accepted.status,200,JSON.stringify(accepted.body));
      const after=await s.service.view(request.id,s.manager.actor);assert.deepEqual(after.recommendation,historical);assert.equal(after.reviewStatus,'ACCEPTED');assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);
    });
    for(const failure of ['unavailable','timeout','malformed','fabricated-source','embedding'])await check('bounded '+failure+' failure leaves core workflow available',async s=>{
      const request=await s.create(),before=await businessSnapshot(s.prisma,request.id),run=await s.recommend(request);assert.equal(run.status,'FAILED');assert.equal(await s.prisma.aiRecommendation.count({where:{requestId:request.id}}),0);assert.deepEqual(await businessSnapshot(s.prisma,request.id),before);assert.ok(run.retryCount<=1);const view=await s.service.view(request.id,s.manager.actor);assert.equal(view.recommendation,null);
      await s.machine.transition(request.id,'MANUAL_TRIAGE',s.manager.actor,{expectedVersion:request.version,finalDecision:{category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:s.staff.actor.id,actions:[],acknowledgedMissingFields:[],reason:'Manual core workflow remains usable during AI outage.'}},randomUUID());
    },failure==='embedding'?{embeddingProvider:{...syntheticEmbeddings,embedQuery:async()=>{throw new Error('Synthetic embedding unavailable');}}}:failure==='fabricated-source'?{hook:async(e,r)=>{r.evidence[0].referenceId=randomUUID();}}:{provider:{generateStructured:async()=>{if(failure==='malformed')return {raw:'{"private":"RAW_M14_INVALID"}',outputSize:30,identity:{provider:'test',model:'m14-invalid',digest:'test-only'}};throw new AiFailure(failure==='timeout'?'AI_TIMEOUT':'AI_MODEL_UNAVAILABLE');}}});
    await check('OpenAPI versions/review errors and unknown query/body fields match shared transport',async s=>{
      const response=await fetch(s.base+'/api/docs-json'),spec=await response.json();assert.equal(response.status,200);for(const route of ['/api/v1/manager/requests/{id}/ai/recommend','/api/v1/manager/requests/{id}/ai/recommendation'])assert.ok(spec.paths[route]);const r=await s.create();assert.equal((await s.call(s.manager.token,path(r.id)+'?unknown=true')).status,400);assert.equal((await s.call(s.manager.token,path(r.id)+'?aiRunId=bad')).status,400);assert.equal((await s.call(s.manager.token,'/manager/requests/'+r.id+'/ai/recommend',{expectedVersion:r.version,execute:true})).status,400);
    });
  }finally{
    await saveEvidence(process.env.M14_DATABASE_EVIDENCE_PATH??'docs/v1.2/evidence/M14_DATABASE.json',{checkedAt:new Date().toISOString(),result:checks.length&&checks.every(c=>c.result==='PASS')?'PASS':'FAIL',synthetic:true,database:'mobiflow_m14_test',provider:'deterministic test-only structured/embedding providers; no live-model claim',checks,limitations:'Targeted M14 and directly affected V1 approval regression only. No historical broad suites or live inference are represented by this report.'});
  }
});
