import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {evaluationSnapshotSchema} from '@mobiflow/contracts';
import {projectResult,snapshotFor,checkedComparison,timingSummary} from './release-results.mjs';
import {isolationProblems,pinned,saveNew} from './capture-release-environment.mjs';
import {diagnosticIds} from './release-evaluate.mjs';

const baseline=JSON.parse(readFileSync('docs/evaluation/results/m9-2026-09-29T14-17-47-313Z.json','utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
test('historical M9 files remain valid without new timing or identity fields',()=>{
  assert.equal(evaluationSnapshotSchema.safeParse(baseline.snapshot).success,true);
  assert.equal(checkedComparison(baseline,baseline).passed,true);
  const rebuilt=snapshotFor(baseline.results,{runId:baseline.snapshot.runId,startedAt:baseline.snapshot.startedAt,finishedAt:baseline.snapshot.finishedAt});
  const withoutLimitations=value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='limitations'));
  const old=withoutLimitations(baseline.snapshot),current=withoutLimitations(rebuilt);
  assert.deepEqual(current,old);assert.equal(evaluationSnapshotSchema.safeParse(rebuilt).success,true);
  assert.equal(timingSummary(baseline.results).providerTimings.evalDurationMs.count,0);
});
test('existing per-case 1.5 boundary is strict and remains unchanged',()=>{
  const current=clone(baseline),prior=baseline.results[0].latencyMs;
  current.results[0].latencyMs=prior*1.5;
  assert.equal(checkedComparison(current,baseline).passed,true);
  current.results[0].latencyMs=prior*1.5+1;
  assert.deepEqual(checkedComparison(current,baseline).regressions.map(r=>r.kind),['SEVERE_LATENCY_REGRESSION']);
});
test('quality, repair and terminal regressions cannot be offset by improvements',()=>{
  const current=clone(baseline),row=current.results.find(r=>r.passed&&r.attempts===1),improved=current.results.find(r=>!r.passed);
  row.passed=false;row.schemaValid=false;row.referenceValid=false;row.attempts=2;row.failureCategory='AI_TIMEOUT';improved.passed=true;
  const compared=checkedComparison(current,baseline);
  assert.equal(compared.passed,false);assert.deepEqual(compared.regressions.map(r=>r.kind),['PASS_TO_FAIL','SCHEMA_VALID_REGRESSION','REFERENCE_VALID_REGRESSION','INCREASED_REPAIR_USAGE','NEW_FAILURE_CLASSIFICATION']);
  assert.deepEqual(compared.failToPass,[improved.id]);
});
test('comparison refuses missing, duplicated, reordered or contract-incompatible cases',()=>{
  for(const edit of [r=>r.results.pop(),r=>r.results[0].id=r.results[1].id,r=>r.results.reverse(),r=>r.snapshot.datasetHash='other',r=>r.snapshot.model='other',r=>r.snapshot.promptVersion='other']){
    const current=clone(baseline);edit(current);assert.throws(()=>checkedComparison(current,baseline));
  }
});
test('safe case projection excludes generated text and preserves missing metadata',()=>{
  const item={id:'test',tags:[],expected:{category:'ACCOUNT',priority:'MEDIUM',team:'CUSTOMER_SUPPORT'}};
  const record={status:'SUCCEEDED',analysis:{category:'ACCOUNT',prioritySuggestion:'MEDIUM',reasonSummary:'PRIVATE_SENTINEL',thinking:'PRIVATE_SENTINEL'},actualTeam:'CUSTOMER_SUPPORT',attempts:1,firstAttemptValid:true,schemaValid:true,latencyMs:21,failureCategory:null,identity:{model:'test'},timing:{casePreparationMs:1,contextConstructionMs:2,providerWallMs:18,finalValidationAndCompletionMs:0,retryValidationAndBackoffMs:[],repairProviderMs:0,runnerWallMs:21,metadataCollectionTailMs:1},http:[{path:'/api/chat',status:200,wallMs:17,ollama:{load_duration_ms:0,eval_count:3,unknown:'PRIVATE_SENTINEL'}}],requests:[]};
  const result=projectResult(record,item);
  assert.equal(result.passed,true);assert.ok(!JSON.stringify(result).includes('PRIVATE_SENTINEL'));
  assert.deepEqual(result.providerAttempts[0].ollama,{loadDurationMs:0,evalCount:3});
  const summary=timingSummary([result]);assert.equal(summary.providerTimings.loadDurationMs.count,1);assert.equal(summary.providerTimings.evalDurationMs.count,0);assert.equal(summary.providerTimings.evalDurationMs.mean,null);
  const failed=projectResult({...record,status:'FAILED',analysis:null,actualTeam:null,schemaValid:false,failureCategory:'AI_TIMEOUT',attempts:2,firstAttemptValid:false,http:[]},item);
  assert.equal(failed.passed,false);assert.equal(failed.repairedSuccess,false);
  assert.equal(snapshotFor([result,failed],{runId:'test',startedAt:'test',finishedAt:'test'}).terminalFailure.count,1);
});
function environment(){return {host:{docker:{status:'AVAILABLE',services:[{Service:'api',State:'exited'},{Service:'web',State:'exited'}]},processes:[]},dataset:{sha256:pinned.datasetHash,count:100},contract:{promptVersion:pinned.promptVersion,temperature:0,maxOutputTokens:1200,attemptTimeoutMs:120000,runTimeoutMs:300000},ollama:{model:{name:pinned.model,digest:pinned.digest},loaded:[{name:pinned.model,digest:pinned.digest,contextLength:16384}]}};}
test('isolation rejects missing services, competing work, other models and drift',()=>{
  const ready=environment();assert.deepEqual(isolationProblems(ready,{warm:true}),[]);
  const changes=[e=>e.host.docker.status='UNAVAILABLE',e=>e.host.docker.services[0].State='running',e=>e.host.docker.services=[],e=>e.host.processes.push({pid:3,evaluation:true}),e=>e.host.processes.push({pid:4,browserTest:true}),e=>e.ollama.loaded.push({name:'bge-m3'}),e=>e.ollama.model.digest='drift',e=>e.dataset.sha256='drift',e=>e.contract.temperature=.5];
  for(const edit of changes){const invalid=clone(ready);edit(invalid);assert.ok(isolationProblems(invalid,{warm:true}).length>0);}
  ready.ollama.loaded=[];assert.ok(isolationProblems(ready,{warm:true}).includes('MODEL_NOT_WARM'));
});
test('idle MCP services and the evaluator itself are not mistaken for competing runs',()=>{
  const ready=environment();ready.host.processes=[{pid:1,self:true,evaluation:true},{pid:2,mcpServer:true,browserTest:true}];
  assert.deepEqual(isolationProblems(ready),[]);
  ready.host.processes.push({pid:3,executable:'node.exe',commandUnavailable:true});assert.ok(isolationProblems(ready).includes('UNINSPECTABLE_NODE_PROCESS'));
  assert.deepEqual(diagnosticIds,['normal-06','incomplete-06','normal-01','normal-11','ambiguous-01']);
});
test('exclusive attempt and result creation cannot overwrite earlier evidence',()=>{
  mkdirSync('artifacts',{recursive:true});const directory=mkdtempSync('artifacts/release-guard-test-'),path=join(directory,'attempt.json');
  saveNew(path,{status:'RESERVED',sentinel:'original'});
  assert.throws(()=>saveNew(path,{status:'replacement'}),{code:'EEXIST'});
  assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),{status:'RESERVED',sentinel:'original'});
});
