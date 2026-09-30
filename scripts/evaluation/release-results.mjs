import assert from 'node:assert/strict';
import {compareEvaluation,percentile,mean} from '../../apps/api/dist/analytics/metrics.js';
import {pinned} from './capture-release-environment.mjs';

// Only enums, numeric timings and the observer's allowlisted wire metadata leave
// this boundary. No request text, generated prose or hidden reasoning is saved.
export function projectResult(record,item){
  const category=record.analysis?.category??null,priority=record.analysis?.prioritySuggestion??null;
  const categoryMatch=category===item.expected.category,priorityMatch=priority===item.expected.priority,teamMatch=record.actualTeam===item.expected.team;
  const map={total_duration_ms:'totalDurationMs',load_duration_ms:'loadDurationMs',prompt_eval_count:'promptEvalCount',prompt_eval_duration_ms:'promptEvalDurationMs',eval_count:'evalCount',eval_duration_ms:'evalDurationMs',done_reason:'doneReason'};
  const attempts=record.http.filter(row=>row.path==='/api/chat').map(row=>({httpStatus:row.status??null,httpWallMs:row.wallMs??null,metadataUnavailable:row.metadataUnavailable??false,
    ollama:Object.fromEntries(Object.entries(map).filter(([key])=>Object.hasOwn(row.ollama??{},key)).map(([key,value])=>[value,row.ollama[key]]))}));
  return {id:item.id,tags:item.tags??[],status:record.status,passed:record.status==='SUCCEEDED'&&categoryMatch&&priorityMatch&&teamMatch,
    attempts:record.attempts,firstAttemptValid:record.firstAttemptValid,repairedSuccess:record.status==='SUCCEEDED'&&record.attempts>1,schemaValid:record.schemaValid,
    referenceValid:record.schemaValid,referenceApplicable:false,categoryMatch,priorityMatch,teamMatch,latencyMs:record.latencyMs,failureCategory:record.failureCategory,
    actual:{category,priority,team:record.actualTeam},expected:{category:item.expected.category,priority:item.expected.priority,team:item.expected.team},identity:record.identity,
    timing:{prepareMs:record.timing.casePreparationMs,contextMs:record.timing.contextConstructionMs,providerWallMs:record.timing.providerWallMs,validationMs:record.timing.finalValidationAndCompletionMs,retryValidationAndBackoffMs:record.timing.retryValidationAndBackoffMs,repairProviderMs:record.timing.repairProviderMs,runnerWallMs:record.timing.runnerWallMs,metadataCollectionTailMs:record.timing.metadataCollectionTailMs},
    providerAttempts:attempts,requests:record.requests,timingLimitation:record.timingLimitation};
}
export function snapshotFor(results,{runId,startedAt,finishedAt}){
  const rate=count=>({count,rate:results.length?count/results.length:null}),latencies=results.map(r=>r.latencyMs);
  return {runId,datasetVersion:pinned.datasetVersion,datasetHash:pinned.datasetHash,mode:'LIVE_OLLAMA',startedAt,finishedAt,provider:'ollama',model:pinned.model,promptVersion:pinned.promptVersion,schemaVersion:pinned.schemaVersion,totalCases:results.length,
    passed:rate(results.filter(r=>r.passed).length),firstAttemptValid:rate(results.filter(r=>r.firstAttemptValid).length),repairedSuccess:rate(results.filter(r=>r.repairedSuccess).length),terminalFailure:rate(results.filter(r=>r.status==='FAILED').length),schemaValid:rate(results.filter(r=>r.schemaValid).length),referenceValid:{count:0,rate:null},
    latency:{mean:mean(latencies),p50:percentile(latencies,.5),p95:percentile(latencies,.95),max:latencies.length?Math.max(...latencies):null},averageAttempts:mean(results.map(r=>r.attempts)),
    failureCounts:results.filter(r=>r.failureCategory).reduce((out,r)=>{out[r.failureCategory]=(out[r.failureCategory]??0)+1;return out;},{}),
    limitations:'100 synthetic development cases with specification-authored labels; not real customer data, prevalence, calibrated confidence, or generalized accuracy. Reference validity is not applicable to intake classification. Historical evaluator route is unchanged for comparison.'};
}
export function checkedComparison(current,baseline){
  for(const key of ['datasetVersion','datasetHash','model','promptVersion','schemaVersion'])assert.equal(current.snapshot[key],baseline.snapshot[key],'Incompatible '+key);
  assert.equal(current.results.length,100);assert.equal(baseline.results.length,100);
  assert.equal(new Set(current.results.map(r=>r.id)).size,100);
  assert.equal(new Set(baseline.results.map(r=>r.id)).size,100);
  assert.deepEqual(current.results.map(r=>r.id),baseline.results.map(r=>r.id),'Case membership/order drift');
  const comparison=compareEvaluation(current.results,baseline.results);
  const failToPass=current.results.filter((r,i)=>r.passed&&!baseline.results[i].passed).map(r=>r.id);
  return {...comparison,failToPass};
}
export function timingSummary(results){
  const metric=values=>({count:values.length,mean:mean(values),p50:percentile(values,.5),p95:percentile(values,.95),max:values.length?Math.max(...values):null});
  const attempts=results.flatMap(r=>r.providerAttempts??[]);
  return {caseTimings:Object.fromEntries(['prepareMs','contextMs','providerWallMs','validationMs','runnerWallMs','metadataCollectionTailMs'].map(key=>[key,metric(results.flatMap(r=>typeof r.timing?.[key]==='number'?[r.timing[key]]:[]))])),
    providerTimings:Object.fromEntries(['totalDurationMs','loadDurationMs','promptEvalDurationMs','evalDurationMs','promptEvalCount','evalCount'].map(key=>[key,metric(attempts.flatMap(a=>typeof a.ollama[key]==='number'?[a.ollama[key]]:[]))])),
    missingProviderMetadata:attempts.filter(a=>a.metadataUnavailable||!Object.hasOwn(a.ollama,'totalDurationMs')).length,
    limitation:'No historical provider-side baseline exists. Missing values are excluded with explicit counts, never imputed to zero; all cases remain in official end-to-end metrics.'};
}
