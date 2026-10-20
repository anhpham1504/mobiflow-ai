import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const rcv2Protocol=Object.freeze({
  version:'rcv2.original-protocol.v1',
  caseId:'M15-026-device-reproduction-omitted',
  runCount:10,
  datasetVersion:'m15.recommendation.synthetic.v2',
  datasetSha256:Object.freeze({crlf:'d011105c106711cf7848e20d757099aa62c4152336fc2672a5e09719c01ba6e9',lf:'e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290'}),
  promptVersion:'grounded-recommendation.v2.14',
  model:Object.freeze({name:'qwen3:4b-instruct-2507-q4_K_M',digest:'d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641'}),
  embedding:Object.freeze({name:'bge-m3:latest',digest:'7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab'}),
  settings:Object.freeze({temperature:0,outputTokenBound:1200,attemptTimeoutMs:120000,runTimeoutMs:300000,attemptBound:2,retryDelayMs:1000,seed:42,contextTokens:16384}),
});

export const sha256=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const rcv2CaseHash=caseItem=>sha256(caseItem);

export function validateRcv2Protocol({datasetVersion,datasetSha256,caseItem,promptVersion,model,embedding,settings}){
  assert.equal(datasetVersion,rcv2Protocol.datasetVersion,'RCV2 dataset version changed');
  assert.ok(Object.values(rcv2Protocol.datasetSha256).includes(datasetSha256.toLowerCase()),'RCV2 dataset bytes changed beyond the pinned Git LF/CRLF representations');
  assert.equal(caseItem?.id,rcv2Protocol.caseId,'RCV2 must run only the original target case');
  assert.deepEqual(caseItem.expected?.missingFields,['description'],'RCV2 missing-field oracle changed');
  assert.deepEqual(caseItem.expected?.mainActions,['REQUEST_USER_INFO'],'RCV2 action oracle changed');
  assert.equal(caseItem.expected?.evidenceStatus,'SUFFICIENT','RCV2 evidence oracle changed');
  assert.ok(caseItem.expected?.requiredWarningCodes?.includes('MISSING_INFORMATION'),'RCV2 warning oracle changed');
  assert.ok(caseItem.expected?.forbiddenFacts?.some(fact=>fact.field==='device'&&fact.value==='DEMO-FABRICATED-D999'),'RCV2 device-fabrication probe missing');
  assert.equal(promptVersion,rcv2Protocol.promptVersion,'RCV2 prompt version changed');
  assert.deepEqual(model,rcv2Protocol.model,'RCV2 model identity changed');
  assert.deepEqual(embedding,rcv2Protocol.embedding,'RCV2 embedding identity changed');
  assert.deepEqual(settings,rcv2Protocol.settings,'RCV2 inference settings changed');
  return {caseContentHash:rcv2CaseHash(caseItem)};
}

export function assessRcv2Row(row,caseContentHash){
  const metrics=row.finalMetrics,output=row.output;
  const violations=[];
  if(row.caseId!==rcv2Protocol.caseId)violations.push('WRONG_CASE');
  if(row.caseContentHash!==caseContentHash)violations.push('CASE_CONTENT_CHANGED');
  if(row.status!=='SUCCEEDED')violations.push(row.errorCode??'RUN_FAILED');
  if(metrics?.schemaValid!==true)violations.push('STRUCTURED_SCHEMA_INVALID');
  if(metrics?.contractValid!==true)violations.push('PRODUCTION_CONTRACT_INVALID');
  violations.push(...(metrics?.gateViolations??[]));
  if(metrics?.missingInformation?.exact!==true||JSON.stringify(metrics?.missingInformation?.returned)!==JSON.stringify(['description']))violations.push('MISSING_INFORMATION_MISMATCH');
  if(metrics?.action?.value!=='REQUEST_USER_INFO'||metrics?.action?.expectedActionValid!==true)violations.push('EXPECTED_MAIN_ACTION_MISMATCH');
  if(metrics?.expectedWarnings?.missing?.length||!metrics?.expectedWarnings?.returned?.includes('MISSING_INFORMATION'))violations.push('EXPECTED_WARNING_MISSING');
  if(output?.evidenceStatus!=='SUFFICIENT')violations.push('EXPECTED_EVIDENCE_STATUS_MISMATCH');
  if(!Array.isArray(output?.procedureSources)||output.procedureSources.length!==1)violations.push('PROCEDURE_PROVENANCE_MISMATCH');
  if(!Array.isArray(output?.suggestedChecklist)||output.suggestedChecklist.length!==0)violations.push('MISSING_INFORMATION_BEFORE_PROCEDURE');
  return {accepted:violations.length===0,violations:[...new Set(violations)]};
}

export function validateRcv2Batch(rows,caseContentHash){
  assert.equal(rows.length,rcv2Protocol.runCount,'RCV2 requires exactly ten completed ordinals');
  for(let index=0;index<rows.length;index++){
    const row=rows[index];
    assert.equal(row.ordinal,index+1,'RCV2 ordinal order changed');
    assert.equal(row.caseId,rcv2Protocol.caseId,'RCV2 case substitution detected');
    assert.equal(row.caseContentHash,caseContentHash,'RCV2 case bytes changed between runs');
    if(index)assert.ok(Date.parse(row.startedAt)>=Date.parse(rows[index-1].finishedAt),'RCV2 calls overlapped or were reordered');
  }
  const assessments=rows.map(row=>assessRcv2Row(row,caseContentHash));
  return {result:assessments.every(item=>item.accepted)?'PASS':'FAIL',accepted:assessments.filter(item=>item.accepted).length,failed:assessments.filter(item=>!item.accepted).length,assessments};
}
