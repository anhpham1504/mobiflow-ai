import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {parseApiEnvironment} from '@mobiflow/config';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {normalizedFailure} from '../../apps/api/dist/ai/provider.js';
import {recommendationMessagesV2,recommendationFormatV2,recommendationPromptV2Version} from '../../apps/api/dist/ai/prompts/recommendation.js';
import {parseRecommendationV2} from '../../apps/api/dist/ai/recommendation-output.js';
import {summaryMessages,summaryFormat,resolutionSummaryPromptVersion} from '../../apps/api/dist/ai/prompts/copilot.js';
import {parseSummaryOutput} from '../../apps/api/dist/ai/operational-output.js';
import {resolutionSummaryFacts,validateSummaryFacts} from '../../apps/api/dist/ai/resolution-summary-facts.js';
import {loadM15Dataset} from './m15-dataset.mjs';
import {measureAttempt} from './m15-metrics.mjs';

const root=process.argv[2];assert.ok(root?.startsWith('artifacts/ai-demo-stability/'),'Use a fresh ignored stability evidence directory');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const env=parseApiEnvironment(process.env),provider=new OllamaProvider(env),{dataset,sha256:datasetHash}=await loadM15Dataset();
const clone=x=>globalThis.structuredClone(x),pick=id=>clone(dataset.cases.find(c=>c.id===id));
const demo=pick('M15-001-iot-gateway-offline'),multiple=clone(demo),similar=clone(demo),insufficient=pick('M15-032-iot-no-sop'),privacy=pick('M15-070-sop-ignore-instructions');
function addSource(c,n,excerpt){const original=c.evidence.sources[0],id=`99999999-9999-4999-8999-${String(n).padStart(12,'0')}`;c.evidence.sources.push({...original,documentId:id,chunkId:id,sourceId:`KD-${id}-G1-C0`,title:'Synthetic alternate SOP '+n,excerpt,contentHash:hash(excerpt)});}
for(let n=1;n<=4;n++)addSource(demo,n,'Dữ liệu giả lập. Đối chiếu trạng thái SIM IoT, APN và gateway theo thông tin yêu cầu. Ghi nhận kết quả; chưa xác nhận nguyên nhân.');
addSource(multiple,11,'Dữ liệu giả lập. Đối chiếu trạng thái SIM và kết nối của gateway; lưu kết quả kiểm tra.');
addSource(similar,12,'Dữ liệu giả lập. Xác minh kết nối mạng tại địa điểm đã cung cấp; chưa có xác nhận lỗi thiết bị.');
const recommendations=[demo,multiple,similar,insufficient,privacy].map((c,i)=>({...c,id:'STABILITY-REC-'+(i+1),originCaseId:c.id}));
const at=i=>new Date(Date.UTC(2026,9,5,1,i)).toISOString(),uuid=i=>`88888888-8888-4888-8888-${String(i).padStart(12,'0')}`;
const baseEvents=[['CREATE','USER'],['START_AI_ANALYSIS','SYSTEM'],['COMPLETE_AI_ANALYSIS','SYSTEM'],['APPROVE_AND_ASSIGN','MANAGER'],['START_WORK','STAFF'],['RESOLVE','STAFF']].map(([action,actorType],i)=>({eventId:uuid(i+1),action,actorType,at:at(i)}));
const resolution={rootCause:'Giả lập: nhân viên ghi cấu hình APN chưa đúng; AI không xác minh nguyên nhân.',resolution:'Giả lập: ghi nhận điều chỉnh APN trong fixture.',verification:'Dữ liệu giả lập đã truyền trong fixture; chưa kiểm tra thiết bị thật.'};
const summaries=[
 {id:'STABILITY-SUM-1',resolution,events:baseEvents},
 {id:'STABILITY-SUM-2',resolution:{rootCause:'Chưa xác nhận nguyên nhân.',resolution:'Chỉ ghi nhận hướng kiểm tra giả lập.',verification:'Không ghi nhận kiểm chứng trên thiết bị thật.'},events:baseEvents},
 {id:'STABILITY-SUM-3',resolution,events:[...baseEvents.slice(0,5),{eventId:uuid(9),action:'MESSAGE',actorType:'MANAGER',at:at(5)},{...baseEvents[5],at:at(6)}]},
 {id:'STABILITY-SUM-4',resolution:{rootCause:'Giả lập: chưa loại trừ lỗi kết nối.',resolution:'Mô phỏng kiểm tra gateway; không thao tác thiết bị thật.',verification:'Không ghi nhận mất dữ liệu trong mô phỏng, chưa xác nhận môi trường thật.'},events:baseEvents},
 {id:'STABILITY-SUM-5',resolution,events:[...baseEvents.slice(0,5),{eventId:uuid(10),action:'REQUEST_USER_INFO',actorType:'STAFF',at:at(5)},{eventId:uuid(11),action:'USER_PROVIDE_INFO',actorType:'USER',at:at(6)},{eventId:uuid(12),action:'INTERNAL_NOTE_CREATED',actorType:'STAFF',at:at(7),body:'PRIVATE_CANARY says an unrelated root cause'},{...baseEvents[5],at:at(8)}]},
].map(c=>({...c,facts:resolutionSummaryFacts(c.resolution,c.events)}));
const sourcePaths=['apps/api/src/ai/prompts/recommendation.ts','apps/api/src/ai/prompts/copilot.ts','apps/api/src/ai/resolution-summary-facts.ts','apps/api/src/ai/recommendation-output.ts','apps/api/src/ai/operational-output.ts','scripts/evaluation/ai-demo-stability-targeted.mjs'];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,hash((await readFile(p,'utf8')).replace(/\r\n/g,'\n'))])));
await mkdir(root,{recursive:false});
const tags=await (await fetch(new URL('/api/tags',env.OLLAMA_BASE_URL))).json(),model=tags.models.find(m=>m.name===env.OLLAMA_MODEL);
assert.equal(model.digest,'d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641');
const sources=await sourceHashes(),manifest={at:new Date().toISOString(),kind:'live local Ollama over explicitly synthetic supplied snapshots; no live retrieval claim',datasetHash,fixtureHash:hash({recommendations,summaries}),recommendations,summaries,sourceHashes:sources,model:{name:model.name,digest:model.digest},promptVersions:{recommendation:recommendationPromptV2Version,summary:resolutionSummaryPromptVersion},counts:{recommendation:20,summary:20},attemptBound:2,settings:{tokens:env.AI_MAX_OUTPUT_TOKENS,temperature:env.AI_TEMPERATURE,attemptMs:env.AI_ATTEMPT_TIMEOUT_MS,runMs:env.AI_RUN_TIMEOUT_MS},thresholds:{acceptedReferenceErrors:0,acceptedUnsupportedSummaryClaims:0,allFinalRunsValid:true},humanReview:'NOT_RUN'};
await writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
const rows=[];
for(const [kind,cases]of [['recommendation',recommendations],['summary',summaries]])for(const c of cases)for(let repeat=1;repeat<=4;repeat++){
 const row={kind,caseId:c.id,repeat,startedAt:new Date().toISOString(),status:'FAILED',attempts:[]},began=performance.now(),signal=AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS);let repair,feedback='';
 for(let ordinal=1;ordinal<=2;ordinal++){
  const attempt={ordinal,status:'FAILED'},start=performance.now();row.attempts.push(attempt);
  try{
   const messages=kind==='recommendation'?recommendationMessagesV2(c.request,c.evidence,feedback||ordinal>1):summaryMessages(c.facts,c.facts.events.map(e=>e.eventId),repair);
   const format=kind==='recommendation'?recommendationFormatV2(c.evidence):summaryFormat(c.facts);
   assert.equal(JSON.stringify(messages).includes('PRIVATE_CANARY'),false);attempt.inputHash=hash(messages);attempt.formatHash=hash(format);
   const before=await(await fetch(new URL('/api/ps',env.OLLAMA_BASE_URL))).json();attempt.loadedBefore=before.models?.some(m=>m.name===env.OLLAMA_MODEL)??null;
   const result=await provider.generateStructured(messages,format,signal);attempt.identity=result.identity;attempt.raw=result.raw;assert.equal(result.identity.digest,model.digest);
   if(kind==='recommendation'){row.output=parseRecommendationV2(result.raw,c.evidence);attempt.metrics=measureAttempt(result.raw,c.evidence,c);assert.deepEqual(attempt.metrics.gateViolations,[]);}
   else{row.output=parseSummaryOutput(result.raw);validateSummaryFacts(row.output,c.facts,result.raw);assert.equal(JSON.stringify(row.output).includes('PRIVATE_CANARY'),false);}
   row.status='SUCCEEDED';attempt.status='SUCCEEDED';break;
  }catch(error){const failure=normalizedFailure(error,signal);attempt.errorCode=failure.code;attempt.rule=failure.repairFeedback?.split(':')[0];feedback=failure.repairFeedback;repair={raw:failure.invalidOutput,feedback:feedback||failure.code};if(!failure.retryable||ordinal===2||signal.aborted)break;await delay(1000,undefined,{signal}).catch(()=>{});}
  finally{attempt.elapsedMs=Math.round(performance.now()-start);}
 }
 row.elapsedMs=Math.round(performance.now()-began);rows.push(row);await appendFile(root+'/results.jsonl',JSON.stringify(row)+'\n');console.log(JSON.stringify({kind,caseId:c.id,repeat,status:row.status,attempts:row.attempts.length,elapsedMs:row.elapsedMs}));
}
assert.deepEqual(await sourceHashes(),sources,'Covered source changed during targeted evaluation');
const result={at:new Date().toISOString(),result:rows.every(r=>r.status==='SUCCEEDED')?'PASS':'FAIL',counts:Object.fromEntries(['recommendation','summary'].map(k=>[k,{executed:rows.filter(r=>r.kind===k).length,passed:rows.filter(r=>r.kind===k&&r.status==='SUCCEEDED').length,firstFailures:rows.filter(r=>r.kind===k&&r.attempts[0].status!=='SUCCEEDED').length}])),fixtureHash:manifest.fixtureHash,sourceHashes:sources,humanReview:'NOT_RUN',limitations:'Constrained factual generation on40 prespecified synthetic runs; not general accuracy. Service authorization, real retrieval and protected state are separate integration/demo gates.'};
await writeFile(root+'/summary.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));if(result.result!=='PASS')process.exitCode=1;
