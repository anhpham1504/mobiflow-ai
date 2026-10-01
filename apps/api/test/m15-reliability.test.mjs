import {test} from 'node:test';
import {statuses} from '@mobiflow/contracts';
import {M15_FAILURE_MODES,runM15ReliabilityScenario,runM15StateRejectionScenario,runM15PublishedStaleScenario} from './helpers/m15-reliability-fixture.mjs';

for(const mode of M15_FAILURE_MODES)test(`M15 failure matrix ${mode}: bounded real service execution, safe publication, unchanged business, manual fallback`,async()=>{
  await runM15ReliabilityScenario(mode);
});
for(const state of statuses.filter(s=>s!=='TRIAGED'))test(`M15 currentness ${state}: Recommendation V2 scheduling rejects invalid state before queue or provider`,async()=>{
  await runM15StateRejectionScenario(state);
});
test('M15 stale behavior after publication: stale read projection and accept/reject guards preserve artifact and business state',async()=>{
  await runM15PublishedStaleScenario();
});
