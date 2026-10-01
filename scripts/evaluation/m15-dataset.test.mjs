import assert from 'node:assert/strict';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {loadM15Dataset} from './m15-dataset.mjs';

const original=(await loadM15Dataset()).dataset;
async function rejectsMutations(mutations){
  const directory=await mkdtemp(join(tmpdir(),'mobiflow-m15-dataset-')),path=join(directory,'mutated.json');
  let written=false;
  try{
    for(const mutate of mutations){
      const changed=JSON.parse(JSON.stringify(original));mutate(changed.cases[0],changed);
      await writeFile(path,JSON.stringify(changed));written=true;
      await assert.rejects(()=>loadM15Dataset(path));
    }
  }finally{
    // The only created file and the now-empty owned directory are removed
    // explicitly. Cleanup never enumerates or recursively removes other paths.
    if(written)await unlink(path);
    await rmdir(directory);
  }
}

test('dataset rejects source identity, content integrity and unavailable-live-source corruption',async()=>{
  await rejectsMutations([
    item=>item.evidence.sources[0].sourceId='KD-ffffffff-ffff-4fff-8fff-ffffffffffff-G1-C0',
    item=>item.evidence.sources[0].contentHash='0'.repeat(64),
    item=>item.evidence.sources[0].generation=2,
    item=>item.evidence.sources[0].unavailableForLiveUse=true,
    item=>item.evidence.sources[0].excerpt='x'.repeat(2401),
  ]);
});

test('dataset rejects false live embedding claims, identity corruption and backend-only authorization data',async()=>{
  await rejectsMutations([
    item=>item.evidence.embeddingIdentity.provider='ollama',
    item=>item.evidence.embeddingIdentity.key='0'.repeat(64),
    item=>item.evidence._authorization={initiatingSessionId:'ffffffff-ffff-4fff-8fff-ffffffffffff'},
    item=>item.evidence.requestContext._authorization='must not reach a model',
  ]);
});

test('dataset rejects inconsistent capture times, historical counts, candidate workload and policy bounds',async()=>{
  await rejectsMutations([
    item=>item.evidence.retrievedAt='2026-09-30T02:01:00.000Z',
    item=>item.evidence.workload.asOf='2026-09-30T02:01:00.000Z',
    item=>item.evidence.similar.returnedCount=1,
    item=>item.evidence.workload.workloads[0].activeCount++,
    item=>item.evidence.policy.targetMinutes=10081,
    item=>item.evidence.candidates.candidates[0].staffId=item.expected.forbiddenReferenceIds[2],
  ]);
});

test('dataset rejects unsupported workflow/taxonomy and protected known-entity substitutions',async()=>{
  await rejectsMutations([
    item=>item.evidence.requestContext.status='IN_PROGRESS',
    item=>item.evidence.analysis.subcategory='BILLING_DISCREPANCY',
    item=>item.evidence.analysis.entities.customer='DEMO-INVENTED-CUSTOMER',
    item=>item.evidence.analysis.entities.affectedCount=18,
    item=>item.evidence.analysis.entities.startedAt='2099-12-31T23:59:59Z',
    item=>item.expected.mainActions=['RESOLVE'],
    item=>item.expected.unverifiedCause='unverified',
  ]);
});

test('deliberately omitted population counts are absent from current prose while unrelated numbers remain',async()=>{
  const cases=original.cases.filter(item=>item.expected.missingFields.includes('affectedCount'));
  assert.equal(cases.length,7);
  const population=/\b[0-9]+\s*(?:SIM|thiết bị|cảm biến|người dùng|nhân viên|tài khoản|thuê bao|đối tượng)\b/iu;
  for(const item of cases){
    const current=[item.request.title,item.request.description,...item.evidence.history.events.flatMap(event=>'body' in event.payload?[event.payload.body]:[])].join('\n');
    assert.doesNotMatch(current,population,item.id);
    assert.equal(item.evidence.analysis.entities.affectedCount,null);
    assert.equal(item.expected.protectedFacts.some(fact=>fact.field==='affectedCount'),false);
  }
  const knownTime=cases.find(item=>item.id==='M15-019-affected-count-omitted');
  assert.match(knownTime.request.description,/2026-09-30T01:15:00Z/,'An unrelated incident timestamp stays supplied');
  assert.match(knownTime.request.description,/DEMO-Sensor-D03/,'A device identifier is not an affected population');
  await rejectsMutations([
    (_,dataset)=>{
      const item=dataset.cases.find(item=>item.id==='M15-019-affected-count-omitted');
      item.request.description+='\nTác động thêm: 3 thiết bị bị ảnh hưởng.';
      item.evidence.requestContext.description=item.request.description;
    },
    (_,dataset)=>{
      const item=dataset.cases.find(item=>item.id==='M15-029-iot-location-count-omitted');
      item.evidence.history.events.push({id:'ffffffff-ffff-4fff-8fff-fffffffffff9',type:'COMMENT',actorType:'USER',timestamp:dataset.snapshotAt,payload:{body:'17 cảm biến không hoạt động.',kind:'COMMENT'}});
    },
  ]);
});

test('documented unsupported-cause probes remain explicit and minimal-request transport limitation is retained',()=>{
  assert.deepEqual(original.cases.filter(item=>item.expected.unverifiedCause===true).map(item=>item.id),['M15-002-iot-intermittent-telemetry','M15-009-account-access-denied']);
  assert.ok(original.limitations.some(value=>value.includes('M15-099')&&value.includes('request-creation API')));
});
