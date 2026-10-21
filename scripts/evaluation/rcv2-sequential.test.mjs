import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadM15Dataset} from './m15-dataset.mjs';
import {assessRcv2Row,rcv2CaseHash,rcv2Protocol,validateRcv2Batch,validateRcv2Protocol} from './rcv2-contract.mjs';

const clone=value=>globalThis.structuredClone(value);
const validMetrics=()=>({schemaValid:true,contractValid:true,gateViolations:[],missingInformation:{exact:true,returned:['description']},action:{value:'REQUEST_USER_INFO',expectedActionValid:true},expectedWarnings:{returned:['MISSING_INFORMATION'],missing:[]}});
const validOutput=()=>({evidenceStatus:'SUFFICIENT',procedureSources:[{sourceId:'KD-source-G1-C0'}],suggestedChecklist:[]});
const row=(ordinal=1)=>({ordinal,caseId:rcv2Protocol.caseId,caseContentHash:'case-hash',status:'SUCCEEDED',startedAt:new Date(ordinal*2000).toISOString(),finishedAt:new Date(ordinal*2000+1000).toISOString(),finalMetrics:validMetrics(),output:validOutput()});

test('RCV2 preflight locks original dataset, case, model, prompt and inference settings',async()=>{
  const loaded=await loadM15Dataset(),caseItem=loaded.dataset.cases.find(item=>item.id===rcv2Protocol.caseId);
  const input={datasetVersion:loaded.dataset.version,datasetSha256:loaded.sha256,caseItem,promptVersion:rcv2Protocol.promptVersion,model:rcv2Protocol.model,embedding:rcv2Protocol.embedding,settings:rcv2Protocol.settings};
  assert.equal(validateRcv2Protocol(input).caseContentHash,rcv2CaseHash(caseItem));
  assert.doesNotThrow(()=>validateRcv2Protocol({...input,datasetSha256:rcv2Protocol.datasetSha256.lf}));
  for(const mutate of [value=>{value.datasetSha256='0'.repeat(64);},value=>{value.caseItem={...value.caseItem,id:'M15-027-substitute'};},value=>{value.model={...value.model,digest:'wrong'};},value=>{value.embedding={...value.embedding,name:'other'};},value=>{value.promptVersion='relaxed';},value=>{value.settings={...value.settings,attemptTimeoutMs:240000};}]){
    const changed=clone(input);mutate(changed);assert.throws(()=>validateRcv2Protocol(changed));
  }
});

test('RCV2 row accepts only the full original oracle and records negative outcomes',()=>{
  assert.equal(assessRcv2Row(row(),'case-hash').accepted,true);
  const mutations=[
    value=>{value.status='FAILED';value.errorCode='AI_TIMEOUT';},
    value=>{value.finalMetrics.schemaValid=false;value.finalMetrics.gateViolations=['STRUCTURED_SCHEMA_INVALID'];},
    value=>{value.finalMetrics.gateViolations=['HALLUCINATED_REFERENCE'];},
    value=>{value.finalMetrics.gateViolations=['PROTECTED_FACT_FABRICATED'];},
    value=>{value.output.procedureSources=[];},
    value=>{value.finalMetrics.missingInformation.returned=[];value.finalMetrics.missingInformation.exact=false;},
    value=>{value.finalMetrics.action.value='START_WORK';value.finalMetrics.action.expectedActionValid=false;},
  ];
  for(const mutate of mutations){const candidate=row();mutate(candidate);assert.equal(assessRcv2Row(candidate,'case-hash').accepted,false);}
});

test('RCV2 batch requires exactly ten non-overlapping immutable sequential ordinals',()=>{
  const rows=Array.from({length:10},(_,index)=>row(index+1));
  assert.deepEqual(validateRcv2Batch(rows,'case-hash').result,'PASS');
  assert.throws(()=>validateRcv2Batch(rows.slice(0,9),'case-hash'));
  const reordered=clone(rows);[reordered[3],reordered[4]]=[reordered[4],reordered[3]];assert.throws(()=>validateRcv2Batch(reordered,'case-hash'));
  const failed=clone(rows);failed[9].status='FAILED';failed[9].errorCode='AI_TIMEOUT';const result=validateRcv2Batch(failed,'case-hash');assert.equal(result.result,'FAIL');assert.equal(result.accepted,9);assert.equal(result.failed,1);
});
