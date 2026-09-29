import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {compareEvaluation} from '../../apps/api/dist/analytics/metrics.js';
import {saveEvidence} from './evidence.mjs';

// This audits existing runs only. It never generates, relabels, or drops cases.
const baselineRef='v0.9.0-m9',directory='docs/evaluation/results/';
const paths={baseline:'m9-2026-09-29T14-17-47-313Z.json',contended:'m9-2026-09-29T16-34-01-887Z.json',isolated:'m9-2026-09-29T16-42-23-764Z.json'};
const runs=Object.fromEntries(Object.entries(paths).map(([name,path])=>[name,JSON.parse(readFileSync(directory+path,'utf8'))]));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const frozenPaths=['apps/api/src/ai','apps/api/src/knowledge','apps/api/src/analytics','scripts/evaluation','datasets/ai-evaluation','packages/contracts','.env.example'];
const changed=git('diff','--name-only',baselineRef,'--',...frozenPaths).split(/\r?\n/).filter(Boolean);
assert.deepEqual(changed,[],'M9 inference/evaluation paths changed');
assert.equal(git('diff','--name-only',baselineRef,'--',directory+paths.baseline),'','Approved baseline changed');
const datasetHash=createHash('sha256').update(readFileSync('datasets/ai-evaluation/requests.json')).digest('hex');
for(const run of Object.values(runs)){
  assert.equal(run.snapshot.datasetHash,datasetHash);
  assert.equal(run.results.length,100);
  assert.deepEqual(run.results.map(row=>row.id),runs.baseline.results.map(row=>row.id));
  for(const key of ['datasetVersion','provider','model','promptVersion','schemaVersion'])assert.equal(run.snapshot[key],runs.baseline.snapshot[key]);
  assert.deepEqual(run.environment,runs.baseline.environment);
}
const before=new Map(runs.baseline.results.map(row=>[row.id,row]));
const reviews=Object.fromEntries(['contended','isolated'].map(name=>{
  const run=runs[name],comparison=compareEvaluation(run.results,runs.baseline.results);
  return [name,{file:directory+paths[name],snapshot:run.snapshot,comparison,
    regressionCounts:comparison.regressions.reduce((out,row)=>({...out,[row.kind]:(out[row.kind]??0)+1}),{}),
    passToFail:run.results.filter(row=>before.get(row.id).passed&&!row.passed).map(row=>({id:row.id,categoryMatch:row.categoryMatch,priorityMatch:row.priorityMatch,teamMatch:row.teamMatch})),
    failToPass:run.results.filter(row=>!before.get(row.id).passed&&row.passed).map(row=>row.id)}];
}));
const report={at:new Date().toISOString(),status:'BLOCKED',baselineRef,baselineCommit:git('rev-parse',baselineRef+'^{commit}'),baselineFile:directory+paths.baseline,datasetHash,sourcePathsUnchanged:frozenPaths,configChange:'Secret placeholder/entropy validation only; AI defaults unchanged.',
  contract:{provider:'ollama',transport:'/api/chat',structuredOutput:'format JSON schema',stream:false,think:false,temperature:0,seed:42,numPredict:1200,numCtx:16384,attempts:2,retryDelayMs:1000,attemptTimeoutMs:120000,runTimeoutMs:300000,context:'title=input.slice(0,100); description=input; messages=[]; historyTruncated=false; expected labels excluded',routing:'Frozen deterministic category-to-team mapping, evaluated after generation'},
  baselineSnapshot:runs.baseline.snapshot,runs:reviews,additionalConfirmationRun:'NOT RUN: no changed inference contract or identified corrective intervention; two completed runs are sufficient to establish unresolved comparison failure.',
  conclusion:{softwareRegression:'No M10 inference/evaluation source change found. Both lost matches are priority-only; category/team remain correct.',variability:'normal-21 changes from fail in contended M10 to pass in isolated M10 with the same recorded contract; live variability is observed, but not proven to explain every baseline difference.',latency:'Isolation reduced mean latency, but 83 cases remain above the unchanged 1.5x threshold. Historical runs lack load/thermal/GPU telemetry and per-call runtime/digest records; contention alone is not a proven cause.',gate:'Comparator remains RED. TEST_STRATEGY has no absolute model-accuracy threshold, but it does not waive this unresolved longitudinal latency result. M10 release readiness is BLOCKED pending a reproducible cause/remedy or explicitly authorized gate adjudication.'}};
await saveEvidence('docs/verification/evidence/M10_EVAL_REGRESSION.json',report);
await saveEvidence('docs/verification/evidence/M10_EVAL_RESULT.json',{at:report.at,baseline:report.baselineSnapshot,contended:runs.contended.snapshot,isolated:runs.isolated.snapshot,additionalConfirmationRun:report.additionalConfirmationRun,status:report.status});
console.log(JSON.stringify({status:report.status,datasetHash,sourceChanged:changed,contended:reviews.contended.regressionCounts,isolated:reviews.isolated.regressionCounts,passToFail:reviews.isolated.passToFail,failToPass:reviews.isolated.failToPass}));
