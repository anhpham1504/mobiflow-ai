import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {recommendationEvidenceV2Schema,missingFieldNames} from '@mobiflow/contracts';

export const datasetVersion='m15.recommendation.synthetic.v2';
export const datasetPath=fileURLToPath(new URL('../../datasets/ai-evaluation/m15-recommendation-v2.json',import.meta.url));
export const requiredCaseGroups=['normal_grounded','missing_information','no_procedural_source','historical_evidence','sla_situations','request_states','prompt_injection','untrusted_markup','invalid_references','conflicting_evidence','stale_currentness','empty_minimal'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const actions=new Set(['START_WORK','REQUEST_USER_INFO','RESOLVE']);
const warnings=new Set(['MISSING_INFORMATION','INSUFFICIENT_EVIDENCE','SLA_AT_RISK','SLA_BREACHED','CONFLICTING_EVIDENCE','WEAK_EVIDENCE']);
const text=value=>typeof value==='string'&&value.trim().length>0;
const equal=(actual,expected,message)=>assert.deepEqual(actual,expected,message);

// Loading only validates the committed complete snapshots. It never creates or
// shuffles cases, obtains IDs/times, performs retrieval, or calls a model.
export async function loadM15Dataset(path=datasetPath){
  const bytes=await readFile(path),dataset=JSON.parse(bytes.toString('utf8'));
  assert.equal(dataset.version,datasetVersion,'Unexpected M15 dataset version');
  assert.equal(dataset.kind,'development/synthetic evidence');
  assert.ok(text(dataset.methodology),'Creation methodology required');
  assert.ok(Array.isArray(dataset.limitations)&&dataset.limitations.length>0);
  assert.equal(dataset.cases.length,100,'The committed M15 dataset contains exactly 100 ordered cases');
  const ids=dataset.cases.map(item=>item.id);
  assert.equal(new Set(ids).size,ids.length,'Duplicate M15 case ID');
  equal(dataset.orderedCaseIds,ids,'Dataset order manifest disagrees with cases');
  const groups=new Set(dataset.cases.map(item=>item.group));
  equal([...groups].sort(),[...requiredCaseGroups].sort(),'Required M15 group coverage');
  const consistency=dataset.consistencyCaseIds;
  assert.ok(Array.isArray(consistency)&&consistency.length===10);
  assert.equal(new Set(consistency).size,10);
  assert.ok(consistency.every(id=>ids.includes(id)),'Consistency subset must belong to the committed cases');
  for(const [ordinal,item] of dataset.cases.entries()){
    assert.match(item.id,new RegExp('^M15-'+String(ordinal+1).padStart(3,'0')+'-[a-z0-9-]+$'),'Ordered ID mismatch');
    assert.ok(text(item.scenario));
    const evidence=recommendationEvidenceV2Schema.parse(item.evidence),request=evidence.requestContext;
    equal(item.request,{title:request.title,description:request.description},item.id+' request snapshot mismatch');
    assert.equal(request.status,'TRIAGED','Live evaluation must use the scheduling state accepted by the product');
    assert.equal(request.version,evidence.requestVersion);
    assert.equal(evidence.retrievedAt,dataset.snapshotAt);
    assert.equal(evidence.embeddingIdentity.provider,'synthetic-fixture','Supplied snapshots must not claim live embeddings');
    const {key,...embedding}=evidence.embeddingIdentity;
    assert.equal(key,hash(JSON.stringify(embedding)),'Fixture embedding identity hash mismatch');
    assert.equal(evidence.similar.cases.length,evidence.similar.returnedCount);
    assert.equal(evidence.workload.asOf,dataset.snapshotAt);
    equal(evidence.workload.workloads,evidence.candidates.candidates.map(candidate=>({staffId:candidate.staffId,activeCount:candidate.activeWorkload})));
    for(const source of evidence.sources){
      assert.equal(source.sourceId,'KD-'+source.documentId+'-G'+source.generation+'-C0');
      assert.equal(source.contentHash,hash(source.excerpt));
      assert.equal(source.unavailableForLiveUse,undefined,'Unavailable sources are tested independently before publication');
    }
    const oracle=item.expected;
    assert.ok(oracle&&text(oracle.oracleNotes),item.id+' oracle required');
    equal([...oracle.missingFields].sort(),[...evidence.analysis.missingFields].sort(),item.id+' missing-field truth mismatch');
    assert.ok(oracle.missingFields.every(field=>missingFieldNames.includes(field)));
    assert.ok(oracle.mainActions.length>0&&oracle.mainActions.every(action=>actions.has(action)));
    assert.ok(!oracle.mainActions.includes('RESOLVE'),'TRIAGED cannot be resolved from a recommendation');
    assert.ok(oracle.requiredWarningCodes.every(code=>warnings.has(code)));
    if(oracle.missingFields.length)assert.ok(oracle.requiredWarningCodes.includes('MISSING_INFORMATION'));
    assert.ok(['SUFFICIENT','INSUFFICIENT_EVIDENCE'].includes(oracle.evidenceStatus));
    if(!evidence.sources.length){
      assert.equal(oracle.evidenceStatus,'INSUFFICIENT_EVIDENCE');
      assert.ok(oracle.requiredWarningCodes.includes('INSUFFICIENT_EVIDENCE'));
    }
    for(const collection of ['protectedFacts','forbiddenFacts']){
      assert.ok(Array.isArray(oracle[collection]),item.id+' '+collection+' oracle required');
      for(const fact of oracle[collection]){
        assert.ok(text(fact.field)&&(text(fact.value)||typeof fact.value==='number'),item.id+' invalid '+collection);
        if(fact.aliases)assert.ok(Array.isArray(fact.aliases)&&fact.aliases.every(text));
      }
    }
    for(const field of ['customer','location','affectedCount','startedAt']){
      const known=oracle.protectedFacts.find(fact=>fact.field===field);
      if(known)equal(known.value,field==='location'?request.location:evidence.analysis.entities[field],item.id+' protected '+field+' differs from supplied truth');
    }
    if(oracle.missingFields.includes('affectedCount')){
      const currentText=[request.title,request.description,...evidence.history.events.flatMap(event=>'body' in event.payload?[event.payload.body]:[])].join('\n').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
      assert.ok(!/\b[0-9]+\s*(?:sim|thiet bi|cam bien|nguoi dung|nhan vien|tai khoan|thue bao|doi tuong)\b/.test(currentText),item.id+' omitted affectedCount appears in current request facts');
      assert.ok(!oracle.protectedFacts.some(fact=>fact.field==='affectedCount'),item.id+' omitted population is labeled as known');
    }
    assert.ok(Array.isArray(oracle.forbiddenReferenceIds));
    const supplied=new Set([request.id,...evidence.sources.map(source=>source.sourceId),...evidence.similar.cases.map(prior=>prior.requestId),...evidence.candidates.candidates.flatMap(candidate=>[candidate.staffId,candidate.teamId])]);
    assert.ok(oracle.forbiddenReferenceIds.every(id=>text(id)&&!supplied.has(id)),item.id+' forbidden reference is actually supplied');
    if(oracle.unverifiedCause!==undefined)assert.equal(typeof oracle.unverifiedCause,'boolean',item.id+' unverified-cause oracle must be boolean');
  }
  return {dataset,sha256:hash(bytes),path,caseCount:dataset.cases.length,orderedCaseIds:ids};
}
