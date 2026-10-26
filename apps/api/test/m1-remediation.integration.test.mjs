import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {AnalysisWorker} from '../dist/ai/analysis-worker.js';
import {OperationalAiService} from '../dist/ai/operational-ai.service.js';
import {hash} from '../dist/knowledge/chunker.js';
import {createReleaseHarness} from './helpers/release-hardening-fixture.mjs';

const url=process.env.M24_DATABASE_URL;
assert.ok(url&&new URL(url).pathname==='/mobiflow_m24_test'&&['127.0.0.1','localhost'].includes(new URL(url).hostname),'Dedicated loopback M24 test target required');

const actionOf=messages=>/Action=([A-Z_]+)/.exec(messages[0].content)?.[1]??null;
const userPayload=messages=>JSON.parse(messages[1].content.slice(messages[1].content.indexOf('\n')+1,messages[1].content.lastIndexOf('\nALLOWED_')));
const allowedOf=messages=>JSON.parse(messages[1].content.slice(messages[1].content.lastIndexOf('\n')+1));
test('M1 DEFECT-01/02/03 remediation uses real PostgreSQL and deterministic barriers',async t=>{
  let structuredHook=async()=>{},analysisHook=async()=>{};
  const structuredGenerate=async(messages,generation)=>{
    const action=actionOf(messages);
    if(!action){
      const facts=userPayload(messages);await structuredHook({action:'RESOLUTION_SUMMARY',messages,facts,allowed:{}});
      const selected=facts.events.slice(0,Math.min(3,facts.events.length));
      return generation({executiveSummary:facts.executiveSummary,timeline:selected.map(event=>({eventId:event.eventId,summary:event.summary}))});
    }
    const allowed=allowedOf(messages),facts=userPayload(messages);await structuredHook({action,messages,facts,allowed});
    if(action==='FIND_SOP')return generation({message:'Nguồn SOP synthetic phù hợp.',sourceIds:allowed.sourceIds});
    if(action==='SUGGEST_NEXT_STEP')return generation({message:'Bước synthetic có căn cứ.',steps:allowed.sourceIds.length?[{text:'Kiểm tra trạng thái SIM theo SOP.',sourceIds:allowed.sourceIds}]:[]});
    if(action==='GENERATE_CHECKLIST')return generation({message:facts.checklistGeneration.message,items:facts.checklistGeneration.items});
    if(action==='SUMMARIZE_REQUEST')return generation({summary:'Tóm tắt synthetic.',eventIds:allowed.eventIds.slice(0,3)});
    if(action==='FIND_SIMILAR_REQUESTS')return generation({message:'Ca synthetic.',caseIds:allowed.caseIds});
    return generation({reasonSummary:'Giải thích synthetic.'});
  };
  const s=await createReleaseHarness(url,{port:33059,structuredGenerate,analysisGenerate:async(input,generation)=>{await analysisHook(input);return generation({intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:null,location:'Amata',affectedCount:17,startedAt:'08:00'},missingFields:[],confidence:0.9,reasonSummary:'Synthetic deterministic analysis.'});}});
  t.after(()=>s.close());
  const operational=s.app.get(OperationalAiService),worker=s.app.get(AnalysisWorker);

  const latest=async id=>s.prisma.request.findUniqueOrThrow({where:{id}});
  const freshStaff=async()=>{const id=randomUUID();await s.prisma.refreshSession.create({data:{id,familyId:randomUUID(),userId:s.staff.actor.id,tokenHash:randomUUID().replaceAll('-','').repeat(2),expiresAt:new Date(Date.now()+3600000)}});return {token:null,cookie:null,actor:{...s.staff.actor,sessionId:id}};};
  const prepare=async(start=false)=>{
    const actor=await freshStaff(),id=await s.machine.create(s.user.actor,{title:'Synthetic M1 '+randomUUID(),description:'17 SIM IoT tại Amata mất kết nối từ 8 giờ; dữ liệu synthetic M1.'},randomUUID());let request=await latest(id);
    await s.machine.transition(id,'MANUAL_TRIAGE',s.manager.actor,{expectedVersion:request.version,finalDecision:s.decision},randomUUID());request=await latest(id);
    await s.machine.transition(id,'SUBMIT_FOR_APPROVAL',s.manager.actor,{expectedVersion:request.version,manualDraftRevision:request.manualDraftRevision},randomUUID());request=await latest(id);
    await s.machine.transition(id,'APPROVE_AND_ASSIGN',s.manager.actor,{expectedVersion:request.version,reviewKind:'MANUAL',manualDraftRevision:request.pendingDraftRevision,acknowledgedMissingFields:[]},randomUUID());request=await latest(id);
    if(start){await s.machine.transition(request.id,'START_WORK',actor.actor,{expectedVersion:request.version},randomUUID());request=await latest(request.id);}
    return {actor,request};
  };
  const queue=async(request,actor,action='SUMMARIZE_REQUEST')=>operational.scheduleCopilot(request.id,actor.actor,{expectedVersion:request.version,action},randomUUID());
  const runOne=async id=>{await operational.cycle(AbortSignal.timeout(30000));return s.prisma.aiRun.findUniqueOrThrow({where:{id}});};
  const calls=()=>s.captured.structured.length;
  const revoke=async(actor,reason='M1_TEST_REVOKE')=>s.prisma.refreshSession.update({where:{id:actor.actor.sessionId},data:{revokedAt:new Date(),revocationReason:reason}});

  await t.test('DEFECT-01 seven adversarial cases and positive controls',async t=>{
    await t.test('TC-SEC-001 actual logout before worker prevents provider dispatch',async()=>{
      const f=await prepare(),login=await s.login('staff.iot@mobiflow.local'),run=await operational.scheduleCopilot(f.request.id,login.actor,{expectedVersion:f.request.version,action:'SUMMARIZE_REQUEST'},randomUUID()),before=calls();
      const response=await fetch(s.base+'/api/v1/auth/logout',{method:'POST',headers:{Origin:s.env.WEB_ORIGIN,'X-CSRF-Protection':'1',Cookie:login.cookie.split(';')[0]}});
      assert.equal(response.status,204);const ended=await runOne(run.id);assert.equal(calls(),before);assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'FORBIDDEN');
    });
    await t.test('TC-SEC-002 revoked session before worker prevents provider dispatch',async()=>{
      const f=await prepare(),run=await queue(f.request,f.actor),before=calls();await revoke(f.actor);const ended=await runOne(run.id);assert.equal(calls(),before);assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'FORBIDDEN');assert.equal(await s.prisma.auditLog.count({where:{resourceId:run.id,action:'COPILOT_FAILED',outcome:'FAILED'}}),1);
    });
    await t.test('TC-SEC-003 expired session before worker prevents provider dispatch',async()=>{
      const f=await prepare(),run=await queue(f.request,f.actor),before=calls(),session=await s.prisma.refreshSession.findUniqueOrThrow({where:{id:f.actor.actor.sessionId}});await s.prisma.refreshSession.update({where:{id:session.id},data:{expiresAt:new Date(session.createdAt.getTime()+1)}});const ended=await runOne(run.id);assert.equal(calls(),before);assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'FORBIDDEN');
    });
    await t.test('TC-SEC-004 disabled account before worker prevents provider dispatch',async()=>{
      const f=await prepare(),run=await queue(f.request,f.actor),before=calls();await s.prisma.user.update({where:{id:f.actor.actor.id},data:{active:false}});try{const ended=await runOne(run.id);assert.equal(calls(),before);assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'FORBIDDEN');}finally{await s.prisma.user.update({where:{id:f.actor.actor.id},data:{active:true}});}
    });
    await t.test('TC-SEC-005 changed assignee prevents provider dispatch',async()=>{
      const f=await prepare(),run=await queue(f.request,f.actor),before=calls();await s.prisma.request.update({where:{id:f.request.id},data:{currentAssigneeId:s.otherStaff.actor.id,version:{increment:1}}});const ended=await runOne(run.id);assert.equal(calls(),before);assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'STALE_CONTEXT');
    });
    await t.test('TC-SEC-006 in-flight revocation prevents publication',async()=>{
      const f=await prepare(),run=await queue(f.request,f.actor);let entered;const providerEntered=new Promise(resolve=>{entered=resolve;});let release;const gate=new Promise(resolve=>{release=resolve;});
      structuredHook=async()=>{entered();await gate;};const pending=operational.cycle(AbortSignal.timeout(30000));await providerEntered;await revoke(f.actor);release();await pending;structuredHook=async()=>{};
      const ended=await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}});assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'FORBIDDEN');assert.equal(ended.safeResultJson,null);
    });
    await t.test('TC-SEC-007 revoked analysis session prevents provider dispatch',async()=>{
      const sessionId=randomUUID();await s.prisma.refreshSession.create({data:{id:sessionId,familyId:randomUUID(),userId:s.user.actor.id,tokenHash:randomUUID().replaceAll('-','').repeat(2),expiresAt:new Date(Date.now()+3600000)}});const owner={actor:{...s.user.actor,sessionId}},id=await s.machine.create(owner.actor,{title:'Synthetic analysis M1',description:'17 SIM IoT synthetic mất kết nối tại Amata.'},randomUUID()),request=await latest(id),run=await s.machine.scheduleAnalysis(request.id,owner.actor,request.version,false,randomUUID()),before=s.captured.intake.length;await revoke(owner);await worker.tick();const ended=await s.prisma.aiRun.findUniqueOrThrow({where:{id:run.id}});assert.equal(s.captured.intake.length,before);assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'FORBIDDEN');
    });
    await t.test('valid session and legitimate refresh rotation remain authorized',async()=>{
      let f=await prepare(),run=await queue(f.request,f.actor);assert.equal((await runOne(run.id)).status,'SUCCEEDED');
      f=await prepare();const login=await s.login('staff.iot@mobiflow.local');run=await operational.scheduleCopilot(f.request.id,login.actor,{expectedVersion:f.request.version,action:'SUMMARIZE_REQUEST'},randomUUID());const rotated=await fetch(s.base+'/api/v1/auth/refresh',{method:'POST',headers:{Origin:s.env.WEB_ORIGIN,'X-CSRF-Protection':'1',Cookie:login.cookie.split(';')[0]}});assert.equal(rotated.status,200);assert.equal((await runOne(run.id)).status,'SUCCEEDED');
    });
    await t.test('provider failure never creates successful output and authorization failure cannot be retried implicitly',async()=>{
      const f=await prepare(),run=await queue(f.request,f.actor);structuredHook=async()=>{throw Object.assign(new Error('synthetic provider failure'),{code:'AI_PROVIDER_UNAVAILABLE'});};let ended=await runOne(run.id);structuredHook=async()=>{};assert.equal(ended.status,'FAILED');assert.equal(ended.safeResultJson,null);
      const denied=await prepare(),deniedRun=await queue(denied.request,denied.actor),before=calls();await revoke(denied.actor);ended=await runOne(deniedRun.id);await operational.cycle(AbortSignal.timeout(30000));assert.equal(ended.status,'FAILED');assert.equal(calls(),before);
    });
  });

  const addSource=async(marker,index=0)=>{
    const id=randomUUID(),content=`Phân loại tham khảo NETWORK / IOT_CONNECTIVITY. ${marker} ${index}. Kiểm tra trạng thái SIM trước khi xử lý.`;
    await s.prisma.knowledgeDocument.create({data:{id,title:`SOP ${marker} ${index}`,originalFileName:`${marker}-${index}.txt`,storageKey:`m1/${id}.txt`,mimeType:'text/plain',byteSize:BigInt(Buffer.byteLength(content)),sha256:hash(id),status:'READY',uploadedById:s.manager.actor.id,version:1,activeGeneration:1,indexedAt:new Date()}});
    const chunk=await s.prisma.knowledgeChunk.create({data:{sourceId:`KD-${id}-G1-C0`,documentId:id,generation:1,chunkIndex:0,content,contentHash:hash(content),startOffset:0,endOffset:Array.from(content).length,metadataJson:{profile:'m1'}}});return {id,content,chunk};
  };
  const grounded=async(marker,action='FIND_SOP',start=false,count=1)=>{
    await s.prisma.knowledgeDocument.updateMany({where:{status:'READY'},data:{status:'DISABLED'}});
    const docs=[];for(let i=0;i<count;i++)docs.push(await addSource(marker,i));const f=await prepare(start);await s.prisma.request.update({where:{id:f.request.id},data:{title:`Synthetic ${marker}`,description:`${marker} SIM IoT mất kết nối cần tra cứu SOP.`}});f.request=await latest(f.request.id);return {...f,docs,run:await queue(f.request,f.actor,action)};
  };
  const expectStale=async(f,mutate)=>{structuredHook=async()=>mutate(f);const before=calls(),ended=await runOne(f.run.id);structuredHook=async()=>{};assert.equal(calls(),before+1);assert.equal(ended.status,'FAILED');assert.equal(ended.errorCode,'STALE_SOURCE');assert.equal(ended.safeResultJson,null);const view=await operational.view(ended.id,f.actor.actor);assert.equal(view.result,null);};

  await t.test('DEFECT-02 eight source-currentness cases',async t=>{
    await t.test('TC-RAG-001 current READY source publishes',async()=>{const f=await grounded('M1RAGREADY');const ended=await runOne(f.run.id);assert.equal(ended.status,'SUCCEEDED',ended.errorCode);assert.equal(ended.safeResultJson.sources.length,1);});
    await t.test('TC-RAG-002 PROCESSING source is not published',async()=>expectStale(await grounded('M1RAGPROCESS'),f=>s.prisma.knowledgeDocument.update({where:{id:f.docs[0].id},data:{status:'PROCESSING'}})));
    await t.test('TC-RAG-003 superseded generation is not published',async()=>expectStale(await grounded('M1RAGGEN'),async f=>{const d=f.docs[0],content=d.content+' Generation 2.';await s.prisma.knowledgeChunk.create({data:{sourceId:`KD-${d.id}-G2-C0`,documentId:d.id,generation:2,chunkIndex:0,content,contentHash:hash(content),startOffset:0,endOffset:Array.from(content).length,metadataJson:{profile:'m1'}}});await s.prisma.knowledgeDocument.update({where:{id:d.id},data:{activeGeneration:2}});}));
    await t.test('TC-RAG-004 disabled source is not published',async()=>expectStale(await grounded('M1RAGDISABLED'),f=>s.prisma.knowledgeDocument.update({where:{id:f.docs[0].id},data:{status:'DISABLED'}})));
    await t.test('TC-RAG-005 one invalid source fails the complete grounded result',async()=>expectStale(await grounded('M1RAGMULTI','FIND_SOP',false,2),f=>s.prisma.knowledgeDocument.update({where:{id:f.docs[0].id},data:{status:'DISABLED'}})));
    await t.test('TC-RAG-006 FIND_SOP stale result is not published',async()=>expectStale(await grounded('M1RAGFINDSOP','FIND_SOP'),f=>s.prisma.knowledgeDocument.update({where:{id:f.docs[0].id},data:{status:'DISABLED'}})));
    await t.test('TC-RAG-007 SUGGEST_NEXT_STEP stale result is not published',async()=>expectStale(await grounded('M1RAGNEXT','SUGGEST_NEXT_STEP'),f=>s.prisma.knowledgeDocument.update({where:{id:f.docs[0].id},data:{status:'DISABLED'}})));
    await t.test('TC-RAG-008 stale checklist application returns 409 STALE_SOURCE',async()=>{const f=await grounded('M1RAGCHECKLIST','GENERATE_CHECKLIST',true),ended=await runOne(f.run.id);assert.equal(ended.status,'SUCCEEDED',ended.errorCode);await s.prisma.knowledgeDocument.update({where:{id:f.docs[0].id},data:{status:'DISABLED'}});const response=await s.call(s.staff.token,'/requests/'+f.request.id+'/checklist',{expectedVersion:f.request.version,sourceRunId:f.run.id,items:ended.safeResultJson.checklistDraft});assert.equal(response.status,409);assert.equal(response.body.error.code,'STALE_SOURCE');});
  });

  const resolved=async()=>{const f=await prepare(true);await s.machine.transition(f.request.id,'RESOLVE',f.actor.actor,{expectedVersion:f.request.version,rootCause:'Synthetic root cause for M1 verification',resolution:'Synthetic resolution for M1 verification',verification:'Synthetic verification for M1 verification'},randomUUID());const request=await s.prisma.request.findUniqueOrThrow({where:{id:f.request.id},include:{currentResolution:true}}),prior=await s.prisma.aiRun.findFirstOrThrow({where:{resolutionId:request.currentResolutionId,purpose:'RESOLUTION_SUMMARY'},orderBy:{createdAt:'desc'}});await s.prisma.aiRun.update({where:{id:prior.id},data:{status:'FAILED',finishedAt:new Date(),errorCode:'SYNTHETIC_FAILURE'}});return {...f,request,resolutionId:request.currentResolutionId};};
  await t.test('DEFECT-03 concurrent summary retry returns bounded 409 conflicts',async t=>{
    for(const count of [2,5,10])await t.test(`${count} concurrent retries`,async()=>{const f=await resolved(),providerCalls=calls(),attempts=Array.from({length:count},()=>operational.retrySummary(f.request.id,f.resolutionId,f.request.version,f.actor.actor).then(value=>({ok:true,value}),error=>({ok:false,error}))),results=await Promise.all(attempts),ok=results.filter(r=>r.ok),conflicts=results.filter(r=>!r.ok);assert.equal(ok.length,1);assert.equal(conflicts.length,count-1);for(const item of conflicts){assert.equal(item.error.status,409);assert.equal(item.error.code,'SUMMARY_RETRY_CONFLICT');assert.notEqual(item.error.code,'P2002');}assert.equal(await s.prisma.aiRun.count({where:{requestId:f.request.id,purpose:'RESOLUTION_SUMMARY',status:{in:['QUEUED','RUNNING']}}}),1);await runOne(ok[0].value.id);assert.equal(calls(),providerCalls+1);assert.equal((await s.prisma.aiRun.findUniqueOrThrow({where:{id:ok[0].value.id}})).status,'SUCCEEDED');});
    await t.test('retry after success and failure preserve existing semantics',async()=>{const success=await resolved(),run=await operational.retrySummary(success.request.id,success.resolutionId,success.request.version,success.actor.actor);await runOne(run.id);await assert.rejects(operational.retrySummary(success.request.id,success.resolutionId,success.request.version,success.actor.actor),error=>error.code==='INVALID_RETRY');const failed=await resolved(),queued=await operational.retrySummary(failed.request.id,failed.resolutionId,failed.request.version,failed.actor.actor);assert.equal(queued.status,'QUEUED');});
    await t.test('duplicate HTTP submit never exposes an internal error',async()=>{const f=await resolved(),path='/requests/'+f.request.id+'/ai/resolution-summary/retry',body={expectedVersion:f.request.version,resolutionId:f.resolutionId},responses=await Promise.all([s.call(s.staff.token,path,body),s.call(s.staff.token,path,body)]);assert.deepEqual(responses.map(r=>r.status).sort(),[202,409]);assert.ok(responses.every(r=>r.status!==500));assert.equal(responses.find(r=>r.status===409).body.error.code,'SUMMARY_RETRY_CONFLICT');});
  });
});
