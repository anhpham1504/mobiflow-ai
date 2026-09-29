import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {counts,mean,percentile,compareEvaluation,sanitizeEvaluationCase} from '../dist/analytics/metrics.js';

test('M9 metric aggregation handles percentiles, grouping and zero cases',()=>{
  assert.equal(mean([]),null);assert.equal(percentile([],.95),null);assert.equal(mean([10,20,30]),20);assert.equal(percentile([40,10,30,20],.5),20);assert.equal(percentile([40,10,30,20],.95),40);assert.deepEqual(counts(['A','B','A']),{A:2,B:1});
});
test('M9 regression comparison reports explicit regressions without an opaque score',()=>{
  const baseline=[{id:'A',passed:true,schemaValid:true,referenceValid:true,attempts:1,latencyMs:100,failureCategory:null}],current=[{id:'A',passed:false,schemaValid:false,referenceValid:false,attempts:2,latencyMs:200,failureCategory:'AI_INVALID_OUTPUT'}],result=compareEvaluation(current,baseline);
  assert.equal(result.passed,false);assert.deepEqual(result.regressions.map(item=>item.kind),['PASS_TO_FAIL','SCHEMA_VALID_REGRESSION','REFERENCE_VALID_REGRESSION','INCREASED_REPAIR_USAGE','NEW_FAILURE_CLASSIFICATION','SEVERE_LATENCY_REGRESSION']);
});
test('M9 evidence sanitization excludes prompts, output and source content',()=>{
  const safe=sanitizeEvaluationCase({id:'EVAL-1',tags:['synthetic'],status:'FAILED',passed:false,attempts:2,latencyMs:30,failureCategory:'AI_INVALID_OUTPUT',prompt:'private',raw:'private'});
  assert.deepEqual(Object.keys(safe),['id','tags','status','passed','attempts','latencyMs','failureCategory']);assert.equal('prompt' in safe,false);assert.equal('raw' in safe,false);
});
test('M9 dataset is versioned, unique, synthetic and has at least 100 valid labeled cases',()=>{
  const rows=JSON.parse(readFileSync(new URL('../../../datasets/ai-evaluation/requests.json',import.meta.url),'utf8'));assert.ok(rows.length>=100);assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  for(const row of rows){assert.equal(typeof row.id,'string');assert.ok(row.input.length>=10);assert.ok(['NETWORK','IOT','BILLING','ACCOUNT','SERVICE','OTHER'].includes(row.expected.category));assert.ok(['LOW','MEDIUM','HIGH','URGENT'].includes(row.expected.priority));assert.ok(Array.isArray(row.tags));}
  assert.ok(rows.some(row=>row.tags.includes('injection-request')));assert.ok(rows.some(row=>row.tags.includes('vietnamese-no-accents')));assert.ok(rows.some(row=>row.tags.includes('duplicate')));
});
