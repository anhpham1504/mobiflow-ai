import assert from 'node:assert/strict';
import {writeFile,mkdir,appendFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Client} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';
import {login,call,base} from './m5-client.mjs';
import {resolutionSummaryFacts,summaryEventLabels,validateSummaryFacts} from '../../apps/api/dist/ai/resolution-summary-facts.js';
import {resolutionSummaryPromptVersion} from '../../apps/api/dist/ai/prompts/copilot.js';
import {assessSla} from '../../apps/api/dist/requests/sla-clock.js';

const output=process.argv[2];assert.ok(output?.startsWith('artifacts/ai-demo-stability/'),'Use a new ignored evidence directory');
assert.equal(base,'http://localhost:33801','Only the owned verification API is allowed');
assert.equal(new URL(process.env.DATABASE_URL).host,'127.0.0.1:55427');
await mkdir(output,{recursive:false});
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),canary='STABILITY_PRIVATE_NOTE_20261005',rows=[];
const cases=Array.from({length:5},(_,i)=>({id:'FLOW-'+(i+1),title:`Giả lập ổn định ${i+1}: 17 SIM IoT mất kết nối`,description:`Dữ liệu giả lập lượt ${i+1}. Khách hàng DEMO-STABILITY có 17 SIM IoT tại KCN Amata, Đồng Nai mất kết nối từ 08:00 ngày 05/10/2026; không truyền dữ liệu cảm biến. Cần kiểm tra trạng thái SIM, APN và gateway. Chưa xác minh nguyên nhân.`,facts:i===1?{rootCause:'Giả lập: chưa xác nhận nguyên nhân; không ghi nhận lỗi gateway.',resolution:'Mô phỏng khôi phục kết nối trong fixture; chưa xác nhận thao tác trên thiết bị thật.',verification:'Giả lập: kết nối đã trở lại trong fixture; không ghi nhận kiểm chứng thiết bị thật.'}:{rootCause:'Giả lập: STAFF ghi cấu hình APN chưa đúng trong fixture.',resolution:'Giả lập: ghi nhận điều chỉnh APN theo SOP-IOT-04.',verification:'Giả lập: dữ liệu cảm biến đã truyền trong fixture; không phải kiểm chứng thiết bị thật.'}}));
await writeFile(output+'/manifest.json',JSON.stringify({at:new Date().toISOString(),cases,caseHash:hash(cases),planned:5,provider:'live local Ollama',runtimeTarget:base,review:'Agent-operated synthetic role commands, no independent human review',thresholds:{allRunsSucceed:true,sourceMembership:true,summaryFidelity:true,protectedWritesBeforeExplicitCommands:0,indexConvergenceMs:180000},sourceHashes:Object.fromEntries(await Promise.all(['scripts/verification/ai-demo-stability-workflow.mjs','apps/api/src/ai/tools/request-vectors.ts','apps/api/src/ai/operational-ai.service.ts'].map(async p=>[p,hash(await readFile(p,'utf8'))])))},null,2)+'\n',{flag:'wx'});
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();let row,tokens;
const models=['RequestStatusHistory','RequestMessage','Assignment','SlaInstance','Checklist','RequestResolution'];
async function protectedState(id){const request=(await db.query('SELECT * FROM "Request" WHERE id=$1::uuid',[id])).rows[0];const related={};for(const table of models)related[table]=(await db.query(`SELECT * FROM "${table}" WHERE "requestId"=$1::uuid`,[id])).rows;return {request,related};}
function assertProtected(after,before,operation){
 const expected=globalThis.structuredClone(before),clockObservations=[];
 assert.equal(after.related.SlaInstance.length,before.related.SlaInstance.length);
 for(let i=0;i<before.related.SlaInstance.length;i++){
  const prior=before.related.SlaInstance[i],current=after.related.SlaInstance[i];
  if(current.version!==prior.version){
   // The existing 30s SLA monitor independently assesses active clocks. Validate
   // its exact permitted write set and clock math; never omit the SLA row.
   assert.equal(prior.stoppedAt,null);assert.ok(['ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED'].includes(before.request.status));
   assert.ok(current.assessedAt>=prior.assessedAt);assert.ok(current.version>prior.version);
   assert.ok(current.version-prior.version<=Math.ceil((current.assessedAt-prior.assessedAt)/30000)+1);
   const assessment=assessSla(prior,current.assessedAt);
   for(const field of ['assessedAt','status','breachedAt','dueAt'])expected.related.SlaInstance[i][field]=assessment[field];
   expected.related.SlaInstance[i].version=current.version;
   clockObservations.push({id:prior.id,beforeVersion:prior.version,afterVersion:current.version,beforeAssessedAt:prior.assessedAt,afterAssessedAt:current.assessedAt});
  }
 }
 assert.deepEqual(after,expected);
 (row.protectedChecks??=[]).push({operation,beforeHash:hash(before),afterHash:hash(after),result:'PASS',permittedClockAssessments:clockObservations});
}
async function api(role,path,body,expected=200,method){const began=performance.now(),r=await call(role?tokens[role]:null,path,body,method);const entry={at:new Date().toISOString(),role,method:method??(body===undefined?'GET':'POST'),path,status:r.status,expected,elapsedMs:Math.round(performance.now()-began),errorCode:r.result.error?.code};await appendFile(output+'/http.jsonl',JSON.stringify(entry)+'\n');assert.equal(r.status,expected,path+' '+JSON.stringify(r.result));return r.result.data;}
async function wait(work,done,timeout=310000){const began=performance.now();while(performance.now()-began<timeout){const r=await work();if(done(r))return r;await delay(1500);}throw new Error('Bounded workflow wait expired');}
async function captureRun(id){const r=(await db.query('SELECT id,purpose,status,"errorCode","latencyMs","retryCount","promptVersion","schemaVersion","modelIdentityJson" FROM "AiRun" WHERE id=$1::uuid',[id])).rows[0];r.attemptFailures=(await db.query('SELECT action,"safeAfterJson","createdAt" FROM "AuditLog" WHERE "resourceId"=$1 AND outcome=\'FAILED\' ORDER BY "createdAt",id',[id])).rows;row.runs.push(r);return r;}
try{
 for(const c of cases){
  // Fresh sessions per scenario avoid token expiry without weakening authentication.
  tokens={USER:await login('user@mobiflow.local'),MANAGER:await login(),STAFF:await login('staff.iot@mobiflow.local'),UNASSIGNED:await login('staff.support@mobiflow.local')};
  row={caseId:c.id,startedAt:new Date().toISOString(),status:'FAIL',runs:[],humanReview:'NOT_RUN'};const began=performance.now();
  try{
   let r=await api('USER','/requests',{title:c.title,description:c.description},201);row.requestId=r.id;
   r=await wait(()=>api('USER','/requests/'+r.id),v=>v.status==='TRIAGED'||v.status==='NEW'&&v.aiAnalysisStatus==='FAILED');
   const intake=(await db.query('SELECT id FROM "AiRun" WHERE "requestId"=$1::uuid AND purpose=\'ANALYSIS\' ORDER BY "createdAt" DESC LIMIT1'.replace('LIMIT1','LIMIT 1'),[r.id])).rows[0];assert.equal((await captureRun(intake.id)).status,'SUCCEEDED');
   await api('USER','/manager/requests',undefined,403);await api('UNASSIGNED','/requests/'+r.id,undefined,404);await api(null,'/requests/'+r.id,undefined,401);
   const before=await protectedState(r.id);row.beforeRecommendationHash=hash(before);
   await api('MANAGER',`/manager/requests/${r.id}/ai/recommend`,{expectedVersion:r.version},202);
   const rec=await wait(()=>api('MANAGER',`/manager/requests/${r.id}/ai/recommendation`),v=>v&&['SUCCEEDED','FAILED','CANCELED'].includes(v.status));row.recommendation=rec;await captureRun(rec.aiRunId);assertProtected(await protectedState(r.id),before,'recommendation');assert.equal(rec.status,'SUCCEEDED',rec.errorCode);
   for(const item of rec.recommendation.suggestedChecklist)assert.ok(item.sourceIds.every(id=>rec.recommendation.procedureSources.some(p=>p.sourceId===id)));
   for(const source of rec.evidence.sources){const actual=await api('MANAGER','/knowledge/sources/'+encodeURIComponent(source.sourceId));assert.equal(actual.excerpt,source.excerpt);}
   // Exercise the advisory review channel while keeping the fixture plan independent.
   await api('MANAGER',`/manager/approvals/${r.id}/reject`,{expectedVersion:r.version,reviewKind:'AI',recommendationId:rec.recommendationId,reason:'Synthetic agent-operated regression review: use the predefined manual verification plan. Independent human review NOT RUN.'});
   assertProtected(await protectedState(r.id),before,'advisory review');row.review=await api('MANAGER',`/manager/requests/${r.id}/ai/recommendation`);assert.equal(row.review.reviewStatus,'REJECTED');
   const decision={category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',teamId:'20000000-0000-4000-8000-000000000001',staffId:'10000000-0000-4000-8000-000000000003',actions:[{text:'Giả lập: xác minh SIM và APN theo kế hoạch STAFF test.',required:true,sourceIds:[],provenance:'HUMAN'}],acknowledgedMissingFields:rec.recommendation.missingInformation.map(f=>f.field),reason:'Predefined synthetic MANAGER test plan; agent-operated workflow verification, not independent human review.'};
   r=await api('MANAGER',`/manager/requests/${r.id}/triage`,{expectedVersion:r.version,finalDecision:decision});r=await api('MANAGER',`/manager/requests/${r.id}/submit-approval`,{expectedVersion:r.version,manualDraftRevision:r.manualDraftRevision});
   await api('STAFF',`/manager/approvals/${r.id}/accept`,{expectedVersion:r.version,reviewKind:'MANUAL',manualDraftRevision:r.manualDraftRevision,acknowledgedMissingFields:decision.acknowledgedMissingFields},403);
   r=await api('MANAGER',`/manager/approvals/${r.id}/accept`,{expectedVersion:r.version,reviewKind:'MANUAL',manualDraftRevision:r.manualDraftRevision,acknowledgedMissingFields:decision.acknowledgedMissingFields});assert.equal(r.status,'ASSIGNED');
   r=await api('STAFF',`/requests/${r.id}/start`,{expectedVersion:r.version});await api('STAFF',`/requests/${r.id}/internal-notes`,{body:canary+' Unrelated root cause, private fixture only.'},201);await api('USER',`/requests/${r.id}/internal-notes`,undefined,403);
   const copilotBefore=await protectedState(r.id),queued=await api('STAFF',`/requests/${r.id}/ai/copilot/action`,{expectedVersion:r.version,action:'FIND_SOP'},202);
   const copilot=await wait(()=>api('STAFF','/ai/operational-runs/'+queued.aiRunId),v=>['SUCCEEDED','FAILED','CANCELED'].includes(v.status));row.copilot=copilot;await captureRun(copilot.aiRunId);assert.equal(copilot.status,'SUCCEEDED');assertProtected(await protectedState(r.id),copilotBefore,'copilot');assert.equal(JSON.stringify(copilot).includes(canary),false);
   for(const s of copilot.result.sources){const actual=await api('STAFF','/knowledge/sources/'+encodeURIComponent(s.sourceId));assert.ok(actual.excerpt.includes(s.quote));}
   await api('STAFF',`/requests/${r.id}/messages`,{expectedVersion:r.version-1,body:'Stale fixture write'},409);
   r=await api('STAFF',`/requests/${r.id}/request-info`,{expectedVersion:r.version,body:'Giả lập: xác nhận SIM và APN.'});assert.equal(r.sla.state,'PAUSED');
   r=await api('USER',`/requests/${r.id}/provide-info`,{expectedVersion:r.version,body:'Giả lập: SIM IoT và APN DEMO-STABILITY.'});assert.equal(r.status,'IN_PROGRESS');
   r=await api('STAFF','/requests/'+r.id);const item=r.checklist.items[0];await api('STAFF',`/requests/${r.id}/resolve`,{expectedVersion:r.version,...c.facts},422);
   r=await api('STAFF',`/requests/${r.id}/checklist/${item.id}`,{expectedVersion:r.version,operation:'COMPLETE'},200,'PATCH');
   r=await api('STAFF',`/requests/${r.id}/resolve`,{expectedVersion:r.version,...c.facts});assert.equal(r.status,'RESOLVED');
   const summaryId=(await db.query('SELECT id FROM "AiRun" WHERE "resolutionId"=$1::uuid AND purpose=\'RESOLUTION_SUMMARY\' ORDER BY "createdAt" DESC LIMIT 1',[r.currentResolution.id])).rows[0].id;
   const summary=await wait(()=>api('USER','/ai/operational-runs/'+summaryId),v=>['SUCCEEDED','FAILED','CANCELED'].includes(v.status));row.summary=summary;assert.equal((await captureRun(summaryId)).promptVersion,resolutionSummaryPromptVersion);assert.equal(summary.status,'SUCCEEDED',summary.errorCode);
   const audits=(await db.query('SELECT id,action,"actorType","createdAt" FROM "AuditLog" WHERE "requestId"=$1::uuid AND outcome=\'SUCCEEDED\' AND "createdAt"<=$2 AND action=ANY($3::text[]) ORDER BY "createdAt" DESC,id DESC LIMIT 50',[r.id,r.currentResolution.resolvedAt,Object.keys(summaryEventLabels)])).rows.reverse();
   const facts=resolutionSummaryFacts(c.facts,audits.map(a=>({eventId:a.id,action:a.action,actorType:a.actorType,at:a.createdAt.toISOString()})));validateSummaryFacts(summary.result,facts,JSON.stringify(summary.result));for(const field of ['rootCause','resolution','verification'])assert.equal(summary.result[field],c.facts[field]);
   const history=await api('USER',`/requests/${r.id}/history?limit=100`);assert.equal(JSON.stringify([history,summary]).includes(canary),false);
   const publicIds=new Set(history.map(e=>e.id));assert.ok(summary.result.sourceEventIds.every(id=>publicIds.has(id)));
   r=await api('USER',`/requests/${r.id}/confirm`,{expectedVersion:r.version});assert.equal(r.status,'CLOSED');row.final={status:r.status,version:r.version,sla:r.sla};
   const finalBefore=await protectedState(r.id);const indexStart=performance.now();await wait(async()=>{const counts=(await db.query('SELECT count(*)::int AS n FROM "RequestEmbedding" WHERE "requestId"=$1::uuid AND "contextVersion"=$2',[r.id,r.version])).rows[0];return counts.n;},n=>n>0,180000);row.indexRecoveryMs=Math.round(performance.now()-indexStart);assert.deepEqual(await protectedState(r.id),finalBefore);row.status='PASS';
  }catch(error){row.error={message:error.message};}
  row.elapsedMs=Math.round(performance.now()-began);rows.push(row);await writeFile(output+'/'+c.id+'.json',JSON.stringify(row,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({caseId:c.id,status:row.status,requestId:row.requestId,error:row.error,elapsedMs:row.elapsedMs}));
 }
 const readiness=await(await fetch(base+'/health/ready')).json(),analytics=await api('MANAGER','/analytics?windowDays=30');
 const result={at:new Date().toISOString(),result:rows.every(r=>r.status==='PASS')?'PASS':'FAIL',planned:5,executed:rows.length,passed:rows.filter(r=>r.status==='PASS').length,firstAttemptFailures:rows.flatMap(r=>r.runs).filter(r=>r.retryCount>0||r.status!=='SUCCEEDED').length,runs:rows.flatMap(r=>r.runs),readiness,analytics,humanReview:'NOT_RUN',limitation:'Five agent-operated synthetic workflows; explicit role commands, not independent human acceptance.'};await writeFile(output+'/summary.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:result.result,executed:result.executed,passed:result.passed}));if(result.result!=='PASS')process.exitCode=1;
}finally{await db.end();}
