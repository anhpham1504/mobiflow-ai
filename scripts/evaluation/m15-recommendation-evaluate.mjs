import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {appendFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {parseApiEnvironment} from '@mobiflow/config';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {AiFailure} from '../../apps/api/dist/ai/provider.js';
import {OllamaEmbeddingProvider} from '../../apps/api/dist/knowledge/embedding-provider.js';
import {recommendationMessagesV2,recommendationFormatV2,recommendationPromptV2Version} from '../../apps/api/dist/ai/prompts/recommendation.js';
import {parseRecommendationV2ForGeneration} from '../../apps/api/dist/ai/recommendation-output.js';
import {decideRecommendationEvidence} from '../../apps/api/dist/ai/recommendation-evidence-decision.js';
import {saveEvidence} from '../verification/evidence.mjs';
import {loadM15Dataset} from './m15-dataset.mjs';
import {measureAttempt,aggregateEvaluation,measureConsistency} from './m15-metrics.mjs';

const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const args=process.argv.slice(2);
assert.ok(args.every(arg=>arg==='--skip-consistency'||arg.startsWith('--case-ids=')||arg.startsWith('--evidence-root=')), 'Only --case-ids=id,id, --skip-consistency and --evidence-root=path are supported');
const {dataset,sha256:datasetSha256,path:datasetPath}=await loadM15Dataset();
const filterArg=args.find(arg=>arg.startsWith('--case-ids='));
const selectedIds=filterArg?filterArg.slice('--case-ids='.length).split(','):null;
if(selectedIds){assert.ok(selectedIds.length&&new Set(selectedIds).size===selectedIds.length);for(const id of selectedIds)assert.ok(dataset.cases.some(c=>c.id===id),'Unknown case '+id);}
const selected=dataset.cases.filter(c=>!selectedIds||selectedIds.includes(c.id));
const fullRun=!selectedIds&&!args.includes('--skip-consistency');
const startedAt=new Date().toISOString(),runId=startedAt.replace(/[:.]/g,'-')+'-'+randomUUID();
const evidenceRoot=args.find(arg=>arg.startsWith('--evidence-root='))?.slice('--evidence-root='.length);
assert.ok(evidenceRoot===undefined||evidenceRoot.trim().length>0,'Evidence root cannot be empty');
const root=(evidenceRoot??'docs/v1.2/evidence/m15')+'/'+runId;
await mkdir(root,{recursive:true});
const paths={manifest:root+'/manifest.json',details:root+'/details.jsonl',summary:root+'/summary.json'};
await writeFile(paths.details,'',{flag:'wx'});
const env=parseApiEnvironment(process.env),provider=new OllamaProvider(env),rows=[],consistencyRows=[];
let manifest,setupError,unexpectedError;
const started=performance.now();
const sourcePaths=['apps/api/src/ai/prompts/recommendation.ts','packages/contracts/src/recommendation.ts','apps/api/src/ai/recommendation-output.ts','apps/api/src/ai/recommendation-evidence-decision.ts','apps/api/src/ai/recommendation.service.ts','apps/api/src/ai/recommendation-snapshot.ts','apps/api/src/requests/request-state-machine.service.ts','apps/api/src/ai/ollama-provider.ts','packages/config/src/index.ts','scripts/evaluation/m15-recommendation-evaluate.mjs','scripts/evaluation/m15-metrics.mjs','scripts/evaluation/m15-dataset.mjs'];
const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,hash(await readFile(path))])));
async function inventory(){
  const response=await fetch(new URL('/api/tags',env.OLLAMA_BASE_URL),{signal:AbortSignal.timeout(10000),redirect:'error'});
  assert.ok(response.ok,'Ollama inventory unavailable');
  const body=await response.json(),model=body.models?.find(m=>m.name===env.OLLAMA_MODEL),embedding=body.models?.find(m=>m.name===env.OLLAMA_EMBEDDING_MODEL);
  assert.ok(model?.digest&&embedding?.digest,'Configured model/embedding absent');
  return {model:{name:model.name,digest:model.digest},embedding:{name:embedding.name,digest:embedding.digest}};
}
async function persistRow(row,phase){
  // One append-only details artifact contains every synthetic structured content
  // field. Provider reasoning fields and runtime credentials never enter it.
  const {case:caseItem,evidence,...retained}=row;void caseItem;void evidence;
  await appendFile(paths.details,JSON.stringify({phase,...retained})+'\n');
}
async function execute(c,phase,repeat=1){
  const evidence=globalThis.structuredClone(c.evidence),frozenHash=hash(evidence);
  const evidenceDecision=decideRecommendationEvidence(evidence,env.RAG_MAX_DISTANCE);
  const row={caseId:c.id,caseGroup:c.group,case:c,evidence,evidenceDecision,repeat,status:'FAILED',attempts:[],output:null};
  const begin=performance.now(),deadlineAt=Date.now()+env.AI_RUN_TIMEOUT_MS,signal=AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS);
  let feedback='';
  for(let attempt=0;attempt<2;attempt++){
    const attemptStart=performance.now(),outcome={ordinal:attempt+1,metrics:null};row.attempts.push(outcome);
    try{
      if(signal.aborted)throw new AiFailure('AI_TIMEOUT');
      const messages=recommendationMessagesV2(c.request,evidence,feedback||attempt>0,evidenceDecision),format=recommendationFormatV2(evidence,evidenceDecision);
      outcome.inputHash=hash(messages);outcome.formatHash=hash(format);
      const providerStart=performance.now();
      let generation;
      try{generation=await provider.generateStructured(messages,format,signal);}
      finally{outcome.providerInvocationMs=Math.round(performance.now()-providerStart);}
      assert.deepEqual(generation.identity,{provider:'ollama',model:manifest.model.name,digest:manifest.model.digest},'Model identity changed');
      outcome.raw=generation.raw;outcome.outputSize=generation.outputSize;outcome.outputHash=hash(generation.raw);
      outcome.metrics=measureAttempt(generation.raw,evidence,c);
      row.output=parseRecommendationV2ForGeneration(generation.raw,evidence,evidenceDecision);row.status='SUCCEEDED';row.finalMetrics=outcome.metrics;
      break;
    }catch(error){
      outcome.errorCode=signal.aborted?'AI_TIMEOUT':error instanceof AiFailure?error.code:'EVALUATION_ERROR';
      outcome.validationRule=error instanceof AiFailure?error.repairFeedback.split(':')[0]||error.code:error.message;
      if(error instanceof AiFailure&&error.invalidOutput){outcome.raw=error.invalidOutput;outcome.outputHash=hash(error.invalidOutput);outcome.truncated=true;outcome.metrics=measureAttempt(error.invalidOutput,evidence,c);}
      feedback=error instanceof AiFailure?error.repairFeedback:'';outcome.repairFeedback=feedback;row.errorCode=outcome.errorCode;
      if(!(error instanceof AiFailure)||!error.retryable||attempt===1||signal.aborted)break;
      const delayStart=performance.now();
      await delay(1000,undefined,{signal}).catch(()=>{});
      outcome.retryBackoffMs=Math.round(performance.now()-delayStart);
    }finally{outcome.durationMs=Math.round(performance.now()-attemptStart)-(outcome.retryBackoffMs??0);}
  }
  row.durationMs=Math.round(performance.now()-begin);row.modelTotalMs=row.attempts.reduce((sum,attempt)=>sum+(attempt.providerInvocationMs??0),0);row.deadlineAt=new Date(deadlineAt).toISOString();
  row.contextHash=frozenHash;row.finalMetrics??=row.attempts.at(-1)?.metrics??null;
  if(row.status==='SUCCEEDED')delete row.errorCode;
  assert.equal(hash(evidence),frozenHash,'Evaluation modified supplied context');
  await persistRow(row,phase);
  console.log(JSON.stringify({phase,caseId:c.id,repeat,status:row.status,attempts:row.attempts.length,durationMs:row.durationMs,errorCode:row.errorCode,findings:row.finalMetrics?.gateViolations??[]}));
  return row;
}
try{
  const actual=await inventory();
  assert.equal(actual.model.name,'qwen3:4b-instruct-2507-q4_K_M','M15 must use the existing authorized model');
  assert.equal(actual.embedding.name,'bge-m3:latest','M15 must use the existing embedding model');
  const response=await fetch(new URL('/api/version',env.OLLAMA_BASE_URL),{signal:AbortSignal.timeout(10000),redirect:'error'});assert.ok(response.ok);
  const embeddingProbe=await new OllamaEmbeddingProvider(env).probe(AbortSignal.timeout(60000));
  assert.equal(embeddingProbe.identity.digest,actual.embedding.digest);
  manifest={runId,startedAt,kind:'development/synthetic evidence',fullRun,startingHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),dataset:{version:dataset.version,path:datasetPath,sha256:datasetSha256,caseCount:dataset.cases.length,orderedCaseIds:dataset.cases.map(c=>c.id),executedCaseIds:selected.map(c=>c.id),methodology:dataset.methodology},provider:'ollama',...actual,ollamaVersion:(await response.json()).version,promptVersion:recommendationPromptV2Version,schemaVersion:'recommendation.v2',sourceHashes,embeddingProbe:{identity:embeddingProbe.identity,latencyMs:embeddingProbe.latencyMs,finite:true,nonzero:true,dimension:embeddingProbe.vectors[0].length},settings:{temperature:env.AI_TEMPERATURE,outputTokenBound:env.AI_MAX_OUTPUT_TOKENS,attemptTimeoutMs:env.AI_ATTEMPT_TIMEOUT_MS,runTimeoutMs:env.AI_RUN_TIMEOUT_MS,attemptBound:2,retryDelayMs:1000,seed:42,contextTokens:16384},environment:{node:process.version,platform:process.platform,arch:process.arch,cpus:os.cpus().length,totalMemoryBytes:os.totalmem()},consistency:{caseIds:fullRun?dataset.consistencyCaseIds:[],runsPerCase:3},paths,limitations:['Supplied deterministic synthetic snapshots isolate recommendation from upstream analysis/retrieval. Dataset embedding identities are fixtures; actual live embedding probe is recorded separately.','No benchmark publication or human decisions are fabricated. Failure/currentness/manual-workflow checks are separate owning-implementation tests.','Static protected-fact and authority oracles are bounded detectors, not exhaustive semantic review or production accuracy. No composite score.','V1 comparator NOT RUN; V2 contract determines this gate.']};
  await writeFile(paths.manifest,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  for(const c of selected)rows.push(await execute(c,'evaluation'));
  if(fullRun)for(const id of dataset.consistencyCaseIds){const c=dataset.cases.find(c=>c.id===id);assert.ok(c);for(let run=1;run<=3;run++)consistencyRows.push(await execute(c,'consistency',run));}
  assert.deepEqual(await inventory(),actual,'Model inventory changed during evaluation');
  for(const path of sourcePaths)assert.equal(hash(await readFile(path)),sourceHashes[path],'Evaluation/product source changed during evaluation: '+path);
  assert.equal(hash(await readFile(datasetPath)),datasetSha256,'Dataset changed during evaluation');
}catch(error){
  if(!manifest)setupError={code:error instanceof AiFailure?error.code:'SETUP_UNAVAILABLE',message:error.message};
  else unexpectedError={code:'EVALUATION_ERROR',message:error.message};
}
const metrics=aggregateEvaluation(rows),consistency=measureConsistency(consistencyRows);
const individuallySafe=row=>row.status==='SUCCEEDED'&&row.finalMetrics?.contractValid===true&&row.finalMetrics.gateViolations?.length===0;
const result=setupError?'NOT_RUN':unexpectedError?'FAIL':fullRun&&rows.length===dataset.cases.length&&rows.length>=50&&consistencyRows.length===dataset.consistencyCaseIds.length*3&&[...rows,...consistencyRows].every(individuallySafe)?'PASS':fullRun?'FAIL':'PARTIAL';
const summary={runId,startedAt,finishedAt:new Date().toISOString(),result,fullRun,kind:'development/synthetic evidence',datasetVersion:dataset.version,datasetSha256,datasetCaseCount:dataset.cases.length,executedCases:rows.length,consistencyRuns:consistencyRows.length,metrics,consistency,totalDurationMs:Math.round(performance.now()-started),paths,setupError,unexpectedError,limitations:manifest?.limitations??['No fixture substitutes for unavailable live services.']};
await writeFile(paths.summary,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
if(!manifest)await writeFile(paths.manifest,JSON.stringify({runId,startedAt,datasetVersion:dataset.version,datasetSha256,sourceHashes,configuredModel:env.OLLAMA_MODEL,configuredEmbedding:env.OLLAMA_EMBEDDING_MODEL,setupError,paths},null,2)+'\n',{flag:'wx'});
await saveEvidence(evidenceRoot?evidenceRoot+'/M15_RECOMMENDATION_EVAL.json':'docs/v1.2/evidence/M15_RECOMMENDATION_EVAL.json',summary);
console.log(JSON.stringify({result,executedCases:rows.length,consistencyRuns:consistencyRows.length,summary:paths.summary}));
if(result==='FAIL'||result==='NOT_RUN')process.exitCode=1;
