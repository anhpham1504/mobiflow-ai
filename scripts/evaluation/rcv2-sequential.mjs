import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {appendFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {parseApiEnvironment} from '@mobiflow/config';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {AiFailure} from '../../apps/api/dist/ai/provider.js';
import {OllamaEmbeddingProvider} from '../../apps/api/dist/knowledge/embedding-provider.js';
import {recommendationFormatV2,recommendationMessagesV2,recommendationPromptV2Version} from '../../apps/api/dist/ai/prompts/recommendation.js';
import {parseRecommendationV2ForGeneration} from '../../apps/api/dist/ai/recommendation-output.js';
import {decideRecommendationEvidence} from '../../apps/api/dist/ai/recommendation-evidence-decision.js';
import {loadM15Dataset} from './m15-dataset.mjs';
import {aggregateEvaluation,measureAttempt} from './m15-metrics.mjs';
import {assessRcv2Row,rcv2Protocol,sha256,validateRcv2Batch,validateRcv2Protocol} from './rcv2-contract.mjs';

const args=process.argv.slice(2);
assert.ok(args.every(arg=>arg.startsWith('--evidence-root='))&&args.length<=1,'Only --evidence-root=path is supported');
const evidenceRoot=args[0]?.slice('--evidence-root='.length)??'docs/v1.3/evidence/rcv2';
assert.ok(evidenceRoot.trim(),'Evidence root cannot be empty');
const startedAt=new Date().toISOString(),runId=startedAt.replace(/[:.]/g,'-')+'-'+randomUUID(),root=join(evidenceRoot,runId);
const paths={manifest:join(root,'manifest.json'),details:join(root,'details.jsonl'),summary:join(root,'summary.json')};
await mkdir(root,{recursive:true});await writeFile(paths.details,'',{flag:'wx'});

const env=parseApiEnvironment(process.env),provider=new OllamaProvider(env),rows=[];
const settings={temperature:env.AI_TEMPERATURE,outputTokenBound:env.AI_MAX_OUTPUT_TOKENS,attemptTimeoutMs:env.AI_ATTEMPT_TIMEOUT_MS,runTimeoutMs:env.AI_RUN_TIMEOUT_MS,attemptBound:2,retryDelayMs:1000,seed:42,contextTokens:16384};
const sourcePaths=['apps/api/src/ai/prompts/recommendation.ts','apps/api/src/ai/recommendation-output.ts','apps/api/src/ai/recommendation-evidence-decision.ts','apps/api/src/ai/ollama-provider.ts','packages/contracts/src/recommendation.ts','packages/config/src/index.ts','scripts/evaluation/m15-dataset.mjs','scripts/evaluation/m15-metrics.mjs','scripts/evaluation/rcv2-contract.mjs','scripts/evaluation/rcv2-sequential.mjs'];
const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,sha256(await readFile(path))])));
const {dataset,sha256:datasetSha256,path:datasetPath}=await loadM15Dataset();
const caseItem=dataset.cases.find(item=>item.id===rcv2Protocol.caseId);
const started=performance.now();let manifest,setupError,postflightError;

async function inventory(){
  const response=await fetch(new URL('/api/tags',env.OLLAMA_BASE_URL),{signal:AbortSignal.timeout(10000),redirect:'error'});
  assert.ok(response.ok,'Ollama inventory unavailable');
  const body=await response.json(),model=body.models?.find(item=>item.name===env.OLLAMA_MODEL),embedding=body.models?.find(item=>item.name===env.OLLAMA_EMBEDDING_MODEL);
  assert.ok(model?.digest&&embedding?.digest,'Configured RCV2 models absent');
  return {model:{name:model.name,digest:model.digest},embedding:{name:embedding.name,digest:embedding.digest}};
}

async function execute(ordinal,caseContentHash,model){
  const evidence=globalThis.structuredClone(caseItem.evidence),evidenceHash=sha256(evidence),evidenceDecision=decideRecommendationEvidence(evidence,env.RAG_MAX_DISTANCE);
  const row={ordinal,invocationId:randomUUID(),caseId:caseItem.id,caseContentHash,evidenceHash,evidenceDecision,status:'FAILED',attempts:[],output:null,startedAt:new Date().toISOString()};
  const begin=performance.now(),deadlineAt=Date.now()+env.AI_RUN_TIMEOUT_MS,signal=AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS);let feedback='';
  for(let attempt=0;attempt<rcv2Protocol.settings.attemptBound;attempt++){
    const attemptStart=performance.now(),outcome={ordinal:attempt+1,metrics:null};row.attempts.push(outcome);
    try{
      if(signal.aborted)throw new AiFailure('AI_TIMEOUT');
      const messages=recommendationMessagesV2(caseItem.request,evidence,feedback||attempt>0,evidenceDecision),format=recommendationFormatV2(evidence,evidenceDecision);
      outcome.inputHash=sha256(messages);outcome.formatHash=sha256(format);
      const providerStart=performance.now();let generation;
      try{generation=await provider.generateStructured(messages,format,signal);}finally{outcome.providerInvocationMs=Math.round(performance.now()-providerStart);}
      assert.deepEqual(generation.identity,{provider:'ollama',model:model.name,digest:model.digest},'RCV2 model identity changed during invocation');
      outcome.raw=generation.raw;outcome.outputSize=generation.outputSize;outcome.outputHash=sha256(generation.raw);outcome.metrics=measureAttempt(generation.raw,evidence,caseItem);
      row.output=parseRecommendationV2ForGeneration(generation.raw,evidence,evidenceDecision);row.finalMetrics=outcome.metrics;row.status='SUCCEEDED';break;
    }catch(error){
      outcome.errorCode=signal.aborted?'AI_TIMEOUT':error instanceof AiFailure?error.code:'EVALUATION_ERROR';
      outcome.validationRule=error instanceof AiFailure?error.repairFeedback.split(':')[0]||error.code:error.message;
      if(error instanceof AiFailure&&error.invalidOutput){outcome.raw=error.invalidOutput;outcome.outputHash=sha256(error.invalidOutput);outcome.metrics=measureAttempt(error.invalidOutput,evidence,caseItem);}
      feedback=error instanceof AiFailure?error.repairFeedback:'';outcome.repairFeedback=feedback;row.errorCode=outcome.errorCode;
      if(!(error instanceof AiFailure)||!error.retryable||attempt===rcv2Protocol.settings.attemptBound-1||signal.aborted)break;
      const backoffStart=performance.now();await delay(rcv2Protocol.settings.retryDelayMs,undefined,{signal}).catch(()=>{});outcome.retryBackoffMs=Math.round(performance.now()-backoffStart);
    }finally{outcome.durationMs=Math.round(performance.now()-attemptStart)-(outcome.retryBackoffMs??0);}
  }
  row.durationMs=Math.round(performance.now()-begin);row.modelTotalMs=row.attempts.reduce((sum,item)=>sum+(item.providerInvocationMs??0),0);row.deadlineAt=new Date(deadlineAt).toISOString();row.finishedAt=new Date().toISOString();row.finalMetrics??=row.attempts.at(-1)?.metrics??null;
  if(row.status==='SUCCEEDED')delete row.errorCode;
  assert.equal(sha256(evidence),evidenceHash,'RCV2 invocation modified frozen evidence');
  row.assessment=assessRcv2Row(row,caseContentHash);
  await appendFile(paths.details,JSON.stringify(row)+'\n');
  console.log(JSON.stringify({ordinal,status:row.status,accepted:row.assessment.accepted,attempts:row.attempts.length,durationMs:row.durationMs,errorCode:row.errorCode,violations:row.assessment.violations}));
  return row;
}

try{
  const actual=await inventory();
  const protocol=validateRcv2Protocol({datasetVersion:dataset.version,datasetSha256,caseItem,promptVersion:recommendationPromptV2Version,model:actual.model,embedding:actual.embedding,settings});
  const versionResponse=await fetch(new URL('/api/version',env.OLLAMA_BASE_URL),{signal:AbortSignal.timeout(10000),redirect:'error'});assert.ok(versionResponse.ok,'Ollama version unavailable');
  const embeddingProbe=await new OllamaEmbeddingProvider(env).probe(AbortSignal.timeout(60000));assert.equal(embeddingProbe.identity.digest,actual.embedding.digest,'RCV2 embedding digest changed during probe');
  manifest={runId,startedAt,kind:'development/synthetic evidence',protocol:rcv2Protocol.version,startingHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),dataset:{version:dataset.version,path:datasetPath,sha256:datasetSha256,caseId:caseItem.id,caseContentHash:protocol.caseContentHash},runPlan:{caseId:caseItem.id,sequentialRuns:rcv2Protocol.runCount,selectiveReruns:false},model:actual.model,embedding:actual.embedding,ollamaVersion:(await versionResponse.json()).version,promptVersion:recommendationPromptV2Version,schemaVersion:'recommendation.v2',settings,sourceHashes,embeddingProbe:{identity:embeddingProbe.identity,latencyMs:embeddingProbe.latencyMs,dimension:embeddingProbe.vectors[0].length,finite:embeddingProbe.vectors[0].every(Number.isFinite),nonzero:embeddingProbe.vectors[0].some(value=>value!==0)},environment:{node:process.version,platform:process.platform,arch:process.arch,cpus:os.cpus().length,totalMemoryBytes:os.totalmem()},paths,limitations:['One frozen synthetic case is repeated sequentially ten times; this is a targeted reliability protocol, not a general accuracy benchmark.','Every ordinal is retained. Failed ordinals are never replaced or selectively rerun.','The bounded M15 literal/contract evaluator does not establish complete semantic correctness.']};
  await writeFile(paths.manifest,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  for(let ordinal=1;ordinal<=rcv2Protocol.runCount;ordinal++)rows.push(await execute(ordinal,protocol.caseContentHash,actual.model));
  assert.deepEqual(await inventory(),actual,'RCV2 model inventory changed during batch');
  for(const path of sourcePaths)assert.equal(sha256(await readFile(path)),sourceHashes[path],'RCV2 source changed during batch: '+path);
  assert.equal(sha256(await readFile(datasetPath)),datasetSha256,'RCV2 dataset changed during batch');
}catch(error){
  if(!manifest)setupError={code:error instanceof AiFailure?error.code:'SETUP_UNAVAILABLE',message:error.message};
  else postflightError={code:'RCV2_EXECUTION_ERROR',message:error.message};
}
let batch={result:'NOT_RUN',accepted:0,failed:0,assessments:[]};
if(manifest){try{batch=validateRcv2Batch(rows,manifest.dataset.caseContentHash);}catch(error){postflightError??={code:'RCV2_BATCH_INCOMPLETE',message:error.message};batch={result:'FAIL',accepted:rows.filter(row=>row.assessment?.accepted).length,failed:rcv2Protocol.runCount-rows.filter(row=>row.assessment?.accepted).length,assessments:rows.map(row=>row.assessment)};}}
const result=setupError?'NOT_RUN':postflightError?'FAIL':batch.result;
const summary={runId,startedAt,finishedAt:new Date().toISOString(),result,protocol:rcv2Protocol.version,caseId:rcv2Protocol.caseId,plannedRuns:rcv2Protocol.runCount,completedRuns:rows.length,acceptedRuns:batch.accepted,failedRuns:batch.failed,batch,metrics:aggregateEvaluation(rows),totalDurationMs:Math.round(performance.now()-started),setupError,postflightError,paths};
await writeFile(paths.summary,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
if(!manifest)await writeFile(paths.manifest,JSON.stringify({runId,startedAt,protocol:rcv2Protocol.version,datasetVersion:dataset.version,datasetSha256,configuredModel:env.OLLAMA_MODEL,configuredEmbedding:env.OLLAMA_EMBEDDING_MODEL,settings,sourceHashes,setupError,paths},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({result,completedRuns:rows.length,acceptedRuns:batch.accepted,failedRuns:batch.failed,summary:paths.summary}));
if(result!=='PASS')process.exitCode=1;
