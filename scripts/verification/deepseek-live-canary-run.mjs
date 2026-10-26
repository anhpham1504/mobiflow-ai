import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from 'pg';
import {login,call,base} from './m5-client.mjs';
import {PrismaService} from '../../apps/api/dist/database/prisma.service.js';
import {LexicalRepository} from '../../apps/api/dist/knowledge/lexical.repository.js';
import {resolutionSummaryPromptVersion} from '../../apps/api/dist/ai/prompts/copilot.js';
/* global FormData, Blob */

const expectedBase='http://127.0.0.1:35411';
const expectedDbHost='127.0.0.1:55449';
const evidenceDirectory=process.argv[2];
const ledgerPath=resolve(process.env.DEEPSEEK_CANARY_LEDGER_PATH??'');
const terminal=new Set(['SUCCEEDED','FAILED','CANCELED']);
const syntheticTitle='Canary synthetic: 17 thiết bị IoT mất kết nối';
const syntheticDescription='Một công ty hư cấu báo 17 thiết bị IoT mất kết nối từ 08:00 tại Khu Thử Nghiệm Zeta. Đây là dữ liệu synthetic, không có thông tin khách hàng thật.';
const syntheticSop='# SOP-IOT-04 Synthetic Canary\nSynthetic demo document - not an actual enterprise SOP.\nÁp dụng cho SIM IoT bị mất kết nối dữ liệu. Kiểm tra trạng thái SIM và cấu hình APN, ghi lại kết quả trước khi đề xuất xử lý. Phân loại tham khảo: NETWORK / IOT_CONNECTIVITY.\nSau khi quản lý phê duyệt và phân công, nhân viên xác minh SIM, APN và kiểm tra truyền dữ liệu; không tự động đổi trạng thái hoặc đóng yêu cầu.';
const sha256=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const now=()=>new Date().toISOString();

assert.equal(base,expectedBase,'The live canary runner is restricted to its owned API');
assert.equal(new URL(process.env.DATABASE_URL).host,expectedDbHost,'The live canary runner is restricted to its owned PostgreSQL');
assert.ok(evidenceDirectory?.startsWith('artifacts/deepseek-live-canary-'),'Use a dedicated ignored canary evidence directory');
assert.ok(process.env.DEEPSEEK_CANARY_LEDGER_PATH,'The runtime egress ledger is required');

// The runner may only call the owned local API. The API process separately owns
// and guards the nine possible DeepSeek HTTPS dispatches.
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,init)=>{
  const url=new URL(input instanceof URL?input:typeof input==='string'?input:input.url);
  if(url.origin!==expectedBase)throw new Error('CANARY_RUNNER_EGRESS_BLOCKED');
  return nativeFetch(input,init);
};

await mkdir(evidenceDirectory,{recursive:true});
const outputPath=resolve(evidenceDirectory,'live-cases.json');
const report={
  schemaVersion:'mobiflow-deepseek-live-canary.v1',
  startedAt:now(),
  result:'RUNNING',
  constraints:{syntheticOnly:true,maxHttpAttempts:20,budgetUsd:.50,noRetry:true,model:'deepseek-flash',thinking:'disabled',ollamaRequired:false},
  target:{api:expectedBase,database:expectedDbHost},
  cases:[],
  localHttp:[],
};
const persist=()=>writeFile(outputPath,JSON.stringify(report,null,2)+'\n',{encoding:'utf8',mode:0o600});
const safeError=error=>({name:error?.name??'Error',message:String(error?.message??error).slice(0,1000)});

let tokens;
let activeCase=null;
const db=new Client({connectionString:process.env.DATABASE_URL});
const prisma=new PrismaService(process.env.DATABASE_URL);
const lexical=new LexicalRepository(prisma);

async function api(role,path,body,expected=body===undefined?200:202,method){
  const began=performance.now();
  const response=await call(role?tokens[role]:null,path,body,method);
  report.localHttp.push({at:now(),caseId:activeCase,role,method:method??(body===undefined?'GET':'POST'),path,status:response.status,expected,elapsedMs:Math.round(performance.now()-began),errorCode:response.result?.error?.code??null});
  await persist();
  assert.equal(response.status,expected,`${path} returned HTTP ${response.status} (${response.result?.error?.code??'NO_CODE'})`);
  return response.result.data;
}

async function waitFor(work,done,label,timeoutMs=180000){
  const began=performance.now();
  while(performance.now()-began<timeoutMs){
    const value=await work();
    if(done(value))return value;
    await delay(1250);
  }
  throw new Error(`${label} exceeded its bounded wait`);
}

async function runMeta(id){
  const result=await db.query('SELECT id,purpose,action,status,"errorCode","latencyMs","retryCount","promptVersion","schemaVersion",provider,model,"modelIdentityJson","inputSize","outputSize" FROM "AiRun" WHERE id=$1::uuid',[id]);
  assert.equal(result.rowCount,1,'AI run metadata is missing');
  const row=result.rows[0];
  assert.equal(row.retryCount,0,'Automatic provider retry was observed');
  assert.equal(row.provider,'deepseek');
  assert.equal(row.model,'deepseek-flash');
  return row;
}

async function ledger(expectedAttempts){
  const value=JSON.parse(await readFile(ledgerPath,'utf8'));
  assert.equal(value.schemaVersion,'mobiflow-deepseek-m3-ledger.v2');
  assert.equal(value.maxHttpAttempts,20);
  assert.equal(value.budgetUsd,.50);
  if(expectedAttempts!==undefined){
    assert.equal(value.attemptCount,expectedAttempts,`Expected exactly ${expectedAttempts} paid HTTP attempts`);
    assert.equal(value.entries.length,expectedAttempts);
  }
  assert.ok(value.actualOrReservedSpendUsd<=.50,'Reserved budget exceeded USD 0.50');
  for(const entry of value.entries){
    assert.equal(entry.origin,'https://api.deepseek.com');
    assert.equal(entry.path,'/chat/completions');
    assert.equal(entry.model,'deepseek-flash');
    assert.equal(entry.thinking,'disabled');
    if(entry.attempt===2){
      assert.equal(entry.status,'TRANSPORT_ERROR','The preserved TLS-blocked attempt changed unexpectedly');
      assert.ok(entry.uncertainCostUsd>0,'The preserved TLS reservation is missing');
      continue;
    }
    assert.equal(entry.status,'HTTP_OK',`DeepSeek HTTP attempt ${entry.attempt} did not succeed`);
    assert.equal(entry.httpStatus,200);
  }
  return value;
}

function validateIntake(job,currentRequest){
  assert.equal(job.status,'SUCCEEDED',`Analysis failed safely with ${job.errorCode}`);
  assert.equal(job.analysis.intent,'REPORT_INCIDENT');
  assert.equal(job.analysis.category,'NETWORK');
  assert.equal(job.analysis.subcategory,'IOT_CONNECTIVITY');
  assert.equal(job.analysis.prioritySuggestion,'HIGH');
  assert.equal(job.analysis.entities.affectedCount,17);
  assert.ok(job.analysis.entities.startedAt?.includes('08:00'));
  assert.ok(job.analysis.entities.location?.toLocaleLowerCase('vi').includes('zeta'));
  assert.equal(job.analysis.entities.customer,null);
  const missing=new Set(job.analysis.missingFields);
  assert.ok([...missing].every(field=>['customer','impact'].includes(field)),'Analysis marked a supplied fact as missing');
  for(const known of ['location','affectedCount','startedAt','description'])assert.equal(missing.has(known),false,`Known field ${known} was marked missing`);
  assert.equal(currentRequest.status,'TRIAGED');
  assert.equal(currentRequest.category,null);
  assert.equal(currentRequest.subcategory,null);
  assert.equal(currentRequest.priority,'MEDIUM');
  assert.equal(currentRequest.currentAssignee,null);
  assert.equal(currentRequest.sla,null);
  return [...missing];
}

async function protectedState(requestId){
  const request=(await db.query(`SELECT id,status,version,category,subcategory,priority,"teamId","currentAssigneeId","manualDraftRevision","reviewKind","pendingDraftRevision","pendingRecommendationId","currentResolutionId" FROM "Request" WHERE id=$1::uuid`,[requestId])).rows[0];
  const assignments=(await db.query(`SELECT id,"staffId","teamId","assignedById","assignedAt","endedAt","recommendationId","decisionKind" FROM "Assignment" WHERE "requestId"=$1::uuid ORDER BY "assignedAt",id`,[requestId])).rows;
  const sla=(await db.query(`SELECT id,"policyId","policyVersion","targetSeconds","startedAt","dueAt","pausedAt","totalPausedSeconds","resolvedHoldAt","totalResolvedHoldSeconds","stoppedAt","stopReason" FROM "SlaInstance" WHERE "requestId"=$1::uuid`,[requestId])).rows;
  const counts=(await db.query(`SELECT
    (SELECT count(*)::int FROM "RequestStatusHistory" WHERE "requestId"=$1::uuid) AS history,
    (SELECT count(*)::int FROM "Checklist" WHERE "requestId"=$1::uuid) AS checklists,
    (SELECT count(*)::int FROM "ChecklistItem" i JOIN "Checklist" c ON c.id=i."checklistId" WHERE c."requestId"=$1::uuid) AS "checklistItems",
    (SELECT count(*)::int FROM "RequestInternalNote" WHERE "requestId"=$1::uuid) AS "internalNotes"`,[requestId])).rows[0];
  return {request,assignments,sla,counts};
}

function sourceExcerptChecks(excerpt,source,title){
  assert.equal(typeof excerpt,'string');
  assert.ok(Array.from(excerpt).length>=20,'Citation excerpt is not substantive');
  assert.notEqual(excerpt.trim(),title.trim(),'Citation excerpt contains only the SOP title');
  assert.ok(source.excerpt.includes(excerpt),'Citation excerpt is not an exact span from the retrieved source');
  assert.equal(excerpt.trimEnd().endsWith('NETWO'),false,'Citation excerpt is truncated at NETWO');
  assert.equal(/\bNETWO$/u.test(excerpt.trimEnd()),false,'Citation excerpt ends in a partial token');
}

function recordLedger(value){
  return {
    attemptedRequests:value.attemptCount,
    reservedUpperBoundUsd:value.actualOrReservedSpendUsd,
    observedEstimatedUsd:value.reportedCostUsd,
    latest:{attempt:value.entries.at(-1)?.attempt,status:value.entries.at(-1)?.status,httpStatus:value.entries.at(-1)?.httpStatus,providerRequestId:value.entries.at(-1)?.providerRequestId??null,finishReason:value.entries.at(-1)?.finishReason??null,usage:value.entries.at(-1)?.usage??null,estimatedUsd:value.entries.at(-1)?.estimatedUsd??null,bodySha256:value.entries.at(-1)?.bodySha256},
  };
}

async function executeCase(id,work){
  activeCase=id;
  const item={id,status:'RUNNING',startedAt:now()};
  report.cases.push(item);
  await persist();
  try{
    Object.assign(item,await work());
    item.status='PASS';
  }catch(error){
    item.status='FAIL';
    item.error=safeError(error);
    throw error;
  }finally{
    item.finishedAt=now();
    await persist();
  }
  return item;
}

try{
  await db.connect();
  tokens={
    USER:await login('user@mobiflow.local'),
    MANAGER:await login('manager@mobiflow.local'),
    STAFF:await login('staff.iot@mobiflow.local'),
    UNASSIGNED:await login('staff.support@mobiflow.local'),
  };

  activeCase='PREFLIGHT_LEXICAL';
  const existingDocument=(await db.query('SELECT id FROM "KnowledgeDocument" WHERE sha256=$1 LIMIT 1',[sha256(syntheticSop)])).rows[0];
  let uploadedDocument;
  if(existingDocument){
    uploadedDocument=await api('MANAGER',`/knowledge/documents/${existingDocument.id}`,undefined,200);
  }else{
    const form=new FormData();
    form.set('title','SOP-IOT-04 Synthetic Canary');
    form.set('file',new Blob([syntheticSop],{type:'text/plain'}),'sop-iot-04-synthetic.txt');
    uploadedDocument=await api('MANAGER','/knowledge/documents',form,202);
  }
  uploadedDocument=await waitFor(()=>api('MANAGER',`/knowledge/documents/${uploadedDocument.id}`,undefined,200),value=>['READY','FAILED','DISABLED'].includes(value.status),'lexical indexing');
  assert.equal(uploadedDocument.status,'READY',`Synthetic document indexing failed with ${uploadedDocument.errorCode}`);
  assert.equal(uploadedDocument.activeGeneration,1);
  const hits=await lexical.search(`${syntheticTitle}\n${syntheticDescription}`,5);
  assert.ok(hits.length>0,'Lexical retrieval returned no source');
  const lexicalTop=hits[0];
  assert.equal(lexicalTop.documentId,uploadedDocument.id,'The synthetic SOP is not lexical top-1');
  assert.equal(lexicalTop.generation,uploadedDocument.activeGeneration);
  assert.ok(Array.from(lexicalTop.excerpt).length>=40);

  const readinessData=await waitFor(async()=>{
    const response=await nativeFetch(expectedBase+'/api/v1/health/ready',{signal:AbortSignal.timeout(10000)});
    assert.equal(response.status,200,'Task-only API readiness failed before the paid canary');
    const body=await response.json();return body.data??body;
  },value=>value.rag.status==='READY','RAG health convergence',45000);
  assert.equal(readinessData.coreReady,true,'Task-only core readiness is false');
  assert.equal(readinessData.rag.status,'READY','PostgreSQL lexical retrieval is not ready');
  assert.equal(readinessData.components.OLLAMA_SERVER.status,'DISABLED','Ollama unexpectedly participates in the canary');
  const startingLedger=await ledger();
  assert.equal(startingLedger.attemptCount,2,'Expected the direct canary and preserved TLS-blocked worker attempt');
  assert.equal(startingLedger.completedCount,1);
  assert.equal(startingLedger.failedCount,1);
  assert.equal(startingLedger.entries[0].status,'HTTP_OK');
  assert.equal(startingLedger.entries[1].status,'TRANSPORT_ERROR');
  const baseAttempt=startingLedger.attemptCount;
  report.preflight={readinessStatus:200,coreReady:readinessData.coreReady,ragStatus:readinessData.rag.status,ollamaStatus:readinessData.components.OLLAMA_SERVER.status,documentId:uploadedDocument.id,sourceId:lexicalTop.sourceId,resumedAfterTlsBlock:true,ledger:recordLedger(startingLedger)};
  await persist();

  let request;
  await executeCase('CASE_1_INTAKE_ANALYSIS',async()=>{
    request=await api('USER','/requests',{title:syntheticTitle,description:syntheticDescription},201);
    const queued=await api('MANAGER',`/requests/${request.id}/ai/analyze`,{expectedVersion:request.version},202),runId=queued.aiRunId;
    const job=await waitFor(()=>api('MANAGER',`/ai/runs/${runId}`,undefined,200),value=>terminal.has(value.status),'analysis run');
    const meta=await runMeta(runId);
    const paid=await ledger(baseAttempt+1);
    assert.equal(meta.status,'SUCCEEDED');
    assert.equal(meta.schemaVersion,'analysis.v1');
    request=await api('MANAGER',`/requests/${request.id}`,undefined,200);
    const missingFields=validateIntake(job,request);
    return {requestId:request.id,aiRunId:runId,resumedFromExisting:false,quality:{classification:'4/4',entities:'4/4',missingFields,humanApprovalPreserved:true},run:meta,ledger:recordLedger(paid)};
  });

  let recommendation;
  await executeCase('CASE_2_GROUNDED_RECOMMENDATION',async()=>{
    const before=await protectedState(request.id);
    const queued=await api('MANAGER',`/manager/requests/${request.id}/ai/recommend`,{expectedVersion:request.version},202);
    recommendation=await waitFor(()=>api('MANAGER',`/manager/requests/${request.id}/ai/recommendation`,undefined,200),value=>value&&terminal.has(value.status),'recommendation run');
    assert.equal(recommendation.aiRunId,queued.aiRunId,'Polled recommendation does not match the queued run');
    const meta=await runMeta(recommendation.aiRunId);
    const paid=await ledger(baseAttempt+2);
    assert.equal(recommendation.status,'SUCCEEDED',`Recommendation failed safely with ${recommendation.errorCode}`);
    assert.equal(meta.status,'SUCCEEDED');
    assert.equal(recommendation.schemaVersion,'recommendation.v2');
    assert.equal(recommendation.reviewStatus,'PENDING','Human approval state is not pending');
    assert.equal(recommendation.recommendation.schemaVersion,'recommendation.v2');
    assert.equal(recommendation.recommendation.evidenceStatus,'SUFFICIENT');
    assert.deepEqual(recommendation.recommendation.procedureSources,[{sourceId:lexicalTop.sourceId}]);
    const canonical=await api('MANAGER',`/knowledge/sources/${encodeURIComponent(lexicalTop.sourceId)}`,undefined,200);
    assert.equal(canonical.documentId,uploadedDocument.id);
    assert.equal(canonical.generation,uploadedDocument.activeGeneration);
    assert.equal(canonical.excerpt,lexicalTop.excerpt);
    const knowledgeEvidence=recommendation.recommendation.evidence.filter(item=>item.type==='KNOWLEDGE');
    assert.equal(knowledgeEvidence.length,1,'Recommendation must cite exactly the selected current SOP source');
    assert.equal(knowledgeEvidence[0].referenceId,lexicalTop.sourceId);
    sourceExcerptChecks(knowledgeEvidence[0].excerpt,canonical,canonical.title);
    for(const item of recommendation.recommendation.suggestedChecklist){
      assert.ok(item.sourceIds.length>0,'Suggested checklist item is missing a source');
      assert.ok(item.sourceIds.every(sourceId=>sourceId===lexicalTop.sourceId),'Checklist contains an unselected source');
    }
    assert.deepEqual(await protectedState(request.id),before,'Advisory recommendation mutated protected business state');
    const forbidden=await call(tokens.STAFF,`/manager/approvals/${request.id}/accept`,{expectedVersion:request.version,reviewKind:'AI',recommendationId:recommendation.recommendationId,acknowledgedMissingFields:recommendation.recommendation.missingInformation.map(item=>item.field)});
    report.localHttp.push({at:now(),caseId:activeCase,role:'STAFF',method:'POST',path:`/manager/approvals/${request.id}/accept`,status:forbidden.status,expected:403,elapsedMs:null,errorCode:forbidden.result?.error?.code??null});
    assert.equal(forbidden.status,403,'STAFF was able to accept a protected recommendation');
    assert.deepEqual(await protectedState(request.id),before,'Forbidden approval attempt changed protected state');
    return {requestId:request.id,documentId:uploadedDocument.id,sourceId:lexicalTop.sourceId,aiRunId:recommendation.aiRunId,quality:{lexicalTop1:true,evidenceStatus:'SUFFICIENT',currentGeneration:true,titleOnlyCitationFixed:true,partialNETWOCitationFixed:true,humanReviewStatus:'PENDING',staffApprovalDenied:true},citation:{excerptLength:Array.from(knowledgeEvidence[0].excerpt).length,excerptSha256:sha256(knowledgeEvidence[0].excerpt),sourceExcerptSha256:sha256(canonical.excerpt)},run:meta,ledger:recordLedger(paid)};
  });

  // Explicit synthetic manager actions create the assigned state needed for the
  // read-only STAFF copilot check. These are not model-applied decisions.
  const missing=recommendation.recommendation.missingInformation.map(item=>item.field);
  const decision={
    category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',
    teamId:'20000000-0000-4000-8000-000000000001',staffId:'10000000-0000-4000-8000-000000000003',
    actions:[{text:'Synthetic human plan: xác minh SIM và APN theo SOP-IOT-04.',required:true,sourceIds:[],provenance:'HUMAN'}],
    acknowledgedMissingFields:missing,
    reason:'Synthetic manager decision for the bounded live canary; no customer data.',
  };
  request=await api('MANAGER',`/manager/requests/${request.id}/triage`,{expectedVersion:request.version,finalDecision:decision},200);
  request=await api('MANAGER',`/manager/requests/${request.id}/submit-approval`,{expectedVersion:request.version,manualDraftRevision:request.manualDraftRevision},200);
  const staffManualApproval=await call(tokens.STAFF,`/manager/approvals/${request.id}/accept`,{expectedVersion:request.version,reviewKind:'MANUAL',manualDraftRevision:request.pendingDraftRevision,acknowledgedMissingFields:missing});
  report.localHttp.push({at:now(),caseId:'SETUP_CASE_3',role:'STAFF',method:'POST',path:`/manager/approvals/${request.id}/accept`,status:staffManualApproval.status,expected:403,elapsedMs:null,errorCode:staffManualApproval.result?.error?.code??null});
  assert.equal(staffManualApproval.status,403);
  request=await api('MANAGER',`/manager/approvals/${request.id}/accept`,{expectedVersion:request.version,reviewKind:'MANUAL',manualDraftRevision:request.pendingDraftRevision,acknowledgedMissingFields:missing},200);
  assert.equal(request.status,'ASSIGNED');
  const forbiddenInternalNote='CANARY_INTERNAL_NOTE_FORBIDDEN Synthetic private note; never send to external AI.';
  await api('STAFF',`/requests/${request.id}/internal-notes`,{body:forbiddenInternalNote},201);
  const userNotes=await call(tokens.USER,`/requests/${request.id}/internal-notes`);
  report.localHttp.push({at:now(),caseId:'SETUP_CASE_3',role:'USER',method:'GET',path:`/requests/${request.id}/internal-notes`,status:userNotes.status,expected:403,elapsedMs:null,errorCode:userNotes.result?.error?.code??null});
  assert.equal(userNotes.status,403);
  await persist();

  await executeCase('CASE_3_COPILOT_FIND_SOP',async()=>{
    request=await api('STAFF',`/requests/${request.id}`,undefined,200);
    const before=await protectedState(request.id);
    const queued=await api('STAFF',`/requests/${request.id}/ai/copilot/action`,{expectedVersion:request.version,action:'FIND_SOP'},202);
    const job=await waitFor(()=>api('STAFF',`/ai/operational-runs/${queued.aiRunId}`,undefined,200),value=>terminal.has(value.status),'copilot run');
    const meta=await runMeta(queued.aiRunId);
    const paid=await ledger(baseAttempt+3);
    assert.equal(job.status,'SUCCEEDED',`Copilot failed safely with ${job.errorCode}`);
    assert.equal(meta.status,'SUCCEEDED');
    assert.equal(job.action,'FIND_SOP');
    assert.equal(job.result.action,'FIND_SOP');
    assert.equal(job.result.evidenceStatus,'SUFFICIENT');
    assert.equal(job.result.sources.length,1);
    assert.equal(job.result.sources[0].sourceId,lexicalTop.sourceId);
    const canonical=await api('STAFF',`/knowledge/sources/${encodeURIComponent(lexicalTop.sourceId)}`,undefined,200);
    sourceExcerptChecks(job.result.sources[0].quote,canonical,canonical.title);
    assert.equal(JSON.stringify(job).includes('CANARY_INTERNAL_NOTE_FORBIDDEN'),false,'Private internal note leaked into Copilot output');
    assert.deepEqual(await protectedState(request.id),before,'Read-only Copilot action mutated protected business state');
    return {requestId:request.id,sourceId:lexicalTop.sourceId,aiRunId:queued.aiRunId,quality:{sourceAllowlist:true,exactCurrentSource:true,substantiveQuote:true,privateNoteExcluded:true,protectedStateUnchanged:true},quote:{length:Array.from(job.result.sources[0].quote).length,sha256:sha256(job.result.sources[0].quote)},run:meta,ledger:recordLedger(paid)};
  });

  let generatedChecklist;
  const remainingActions=['SUMMARIZE_REQUEST','SUGGEST_NEXT_STEP','GENERATE_CHECKLIST','FIND_SIMILAR_REQUESTS','EXPLAIN_CLASSIFICATION'];
  for(const [index,action] of remainingActions.entries()){
    await executeCase(`CASE_${index+4}_COPILOT_${action}`,async()=>{
      request=await api('STAFF',`/requests/${request.id}`,undefined,200);
      const before=await protectedState(request.id);
      const queued=await api('STAFF',`/requests/${request.id}/ai/copilot/action`,{expectedVersion:request.version,action},202);
      const job=await waitFor(()=>api('STAFF',`/ai/operational-runs/${queued.aiRunId}`,undefined,200),value=>terminal.has(value.status),`${action} copilot run`);
      const meta=await runMeta(queued.aiRunId);
      const paid=await ledger(baseAttempt+4+index);
      assert.equal(job.status,'SUCCEEDED',`${action} failed safely with ${job.errorCode}`);
      assert.equal(meta.status,'SUCCEEDED');
      assert.equal(job.action,action);
      assert.equal(job.result.action,action);
      assert.ok(Array.isArray(job.result.sources));
      assert.ok(Array.isArray(job.result.warnings));
      assert.ok(Array.isArray(job.result.suggestedNextSteps));
      assert.ok(Array.isArray(job.result.checklistDraft));
      assert.ok(Array.isArray(job.result.eventIds));
      assert.ok(Array.isArray(job.result.similarCases));
      assert.equal(JSON.stringify(job).includes('CANARY_INTERNAL_NOTE_FORBIDDEN'),false,`${action} leaked a private internal note`);
      for(const source of job.result.sources){
        assert.equal(source.sourceId,lexicalTop.sourceId,`${action} returned a source outside the lexical allowlist`);
        const canonical=await api('STAFF',`/knowledge/sources/${encodeURIComponent(source.sourceId)}`,undefined,200);
        sourceExcerptChecks(source.quote,canonical,canonical.title);
      }
      if(action==='GENERATE_CHECKLIST'){
        assert.ok(job.result.checklistDraft.length>0,'Live checklist generation returned no bounded items');
        generatedChecklist={aiRunId:queued.aiRunId,items:job.result.checklistDraft};
      }
      assert.deepEqual(await protectedState(request.id),before,`${action} mutated protected business state`);
      return {requestId:request.id,aiRunId:queued.aiRunId,action,quality:{privateNoteExcluded:true,protectedStateUnchanged:true,sourceCount:job.result.sources.length,warningCount:job.result.warnings.length,checklistCount:job.result.checklistDraft.length,eventCount:job.result.eventIds.length,similarCaseCount:job.result.similarCases.length},resultSha256:sha256(job.result),run:meta,ledger:recordLedger(paid)};
    });
  }

  await executeCase('CASE_9_RESOLUTION_SUMMARY',async()=>{
    request=await api('STAFF',`/requests/${request.id}`,undefined,200);
    request=await api('STAFF',`/requests/${request.id}/start`,{expectedVersion:request.version},200);
    request=await api('STAFF',`/requests/${request.id}`,undefined,200);
    if(!request.checklist?.items?.length){
      assert.ok(generatedChecklist,'No checklist exists and the live generated checklist is unavailable');
      request=await api('STAFF',`/requests/${request.id}/checklist`,{expectedVersion:request.version,sourceRunId:generatedChecklist.aiRunId,items:generatedChecklist.items},200);
    }
    for(const item of request.checklist.items.filter(item=>!item.completedAt)){
      request=await api('STAFF',`/requests/${request.id}/checklist/${item.id}`,{expectedVersion:request.version,operation:'COMPLETE'},200,'PATCH');
    }
    const resolutionFacts={
      rootCause:'Synthetic fixture: cấu hình APN chưa đúng; do STAFF xác nhận, không phải AI tự suy diễn.',
      resolution:'Synthetic fixture: STAFF ghi nhận đã khôi phục cấu hình APN theo SOP-IOT-04.',
      verification:'Synthetic fixture: STAFF ghi nhận 17 thiết bị đã truyền dữ liệu ổn định.',
    };
    request=await api('STAFF',`/requests/${request.id}/resolve`,{expectedVersion:request.version,...resolutionFacts},200);
    assert.equal(request.status,'RESOLVED');
    assert.ok(request.currentResolution?.id,'Resolution identity is missing');
    const beforeSummary=await protectedState(request.id);
    const summaryRow=(await db.query('SELECT id FROM "AiRun" WHERE "resolutionId"=$1::uuid AND purpose=\'RESOLUTION_SUMMARY\' ORDER BY "createdAt" DESC LIMIT 1',[request.currentResolution.id])).rows[0];
    assert.ok(summaryRow?.id,'Resolution Summary run was not queued');
    const job=await waitFor(()=>api('USER',`/ai/operational-runs/${summaryRow.id}`,undefined,200),value=>terminal.has(value.status),'resolution summary run');
    const meta=await runMeta(summaryRow.id);
    const paid=await ledger(baseAttempt+9);
    assert.equal(job.status,'SUCCEEDED',`Resolution Summary failed safely with ${job.errorCode}`);
    assert.equal(meta.status,'SUCCEEDED');
    assert.equal(meta.promptVersion,resolutionSummaryPromptVersion);
    assert.equal(job.result.rootCause,resolutionFacts.rootCause);
    assert.equal(job.result.resolution,resolutionFacts.resolution);
    assert.equal(job.result.verification,resolutionFacts.verification);
    assert.ok(Array.isArray(job.result.sourceEventIds));
    assert.equal(JSON.stringify(job).includes('CANARY_INTERNAL_NOTE_FORBIDDEN'),false,'Resolution Summary leaked a private internal note');
    assert.deepEqual(await protectedState(request.id),beforeSummary,'Resolution Summary mutated protected business state');
    return {requestId:request.id,resolutionId:request.currentResolution.id,aiRunId:summaryRow.id,quality:{factsExact:true,privateNoteExcluded:true,protectedStateUnchanged:true,sourceEventCount:job.result.sourceEventIds.length},resultSha256:sha256(job.result),run:meta,ledger:recordLedger(paid)};
  });

  const finalLedger=await ledger(baseAttempt+9);
  const readinessAfterResponse=await nativeFetch(expectedBase+'/api/v1/health/ready',{signal:AbortSignal.timeout(10000)});
  const readinessAfter=await readinessAfterResponse.json();
  const readinessAfterData=readinessAfter.data??readinessAfter;
  assert.equal(readinessAfterResponse.status,200);
  assert.equal(readinessAfterData.coreReady,true);
  assert.equal(readinessAfterData.rag.status,'READY');
  assert.equal(readinessAfterData.components.OLLAMA_SERVER.status,'DISABLED');
  report.readinessAfter={status:readinessAfterResponse.status,coreReady:readinessAfterData.coreReady,ragStatus:readinessAfterData.rag.status,ollamaStatus:readinessAfterData.components.OLLAMA_SERVER.status};
  report.cost={currency:'USD',observedEstimatedUsd:finalLedger.reportedCostUsd,reservedUpperBoundUsd:finalLedger.actualOrReservedSpendUsd,budgetUsd:.50,pricingBasis:'Runtime ledger using configured peak token rates; estimate, not provider invoice'};
  report.result='PASS';
}catch(error){
  report.result='FAIL';
  report.failure=safeError(error);
  try{report.finalLedger=recordLedger(JSON.parse(await readFile(ledgerPath,'utf8')));}catch(error){void error;}
  process.exitCode=1;
}finally{
  report.finishedAt=now();
  await persist();
  await Promise.allSettled([db.end(),prisma.$disconnect()]);
  console.log(JSON.stringify({result:report.result,cases:report.cases.map(item=>({id:item.id,status:item.status,error:item.error?.message})),cost:report.cost??report.finalLedger,output:outputPath}));
}
