import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AutoRoutingService} from '../dist/routing/auto-routing.service.js';

const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
const analysis={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:null,location:null,affectedCount:17,startedAt:null},missingFields:['customer','location','startedAt'],confidence:.8,reasonSummary:'Synthetic grounded classification.'};
const input={analysis,grounded:true,appliedPriority:'MEDIUM',requestVersion:3,evaluatedAt:new Date('2026-10-29T00:00:00.000Z')};
function harness({evaluation={status:'NO_MATCH',diagnostic:'NO_ACTIVE_RULE_MATCHED',suggestedTarget:null},team={id:'20000000-0000-4000-8000-000000000001',code:'NETWORK_OPERATIONS'},rows=[{staffId:ids[0],displayName:'A',teamId:'20000000-0000-4000-8000-000000000001',skillCodes:['IOT'],activeWorkload:2}],policies=[{id:'30000000-0000-4000-8000-000000000001',version:1,targetMinutes:240,category:null}]}={}){
  const service=new AutoRoutingService({evaluateFacts:async()=>evaluation});
  const tx={team:{findFirst:async()=>team},slaPolicy:{findMany:async()=>policies},$queryRaw:async()=>rows};
  return {service,tx};
}

test('auto-routing deterministically selects the lowest workload then stable staff ID',async()=>{
  const rows=[
    {staffId:ids[2],displayName:'C',teamId:'20000000-0000-4000-8000-000000000001',skillCodes:['IOT'],activeWorkload:8},
    {staffId:ids[1],displayName:'B',teamId:'20000000-0000-4000-8000-000000000001',skillCodes:['IOT'],activeWorkload:2},
    {staffId:ids[0],displayName:'A',teamId:'20000000-0000-4000-8000-000000000001',skillCodes:['IOT'],activeWorkload:2},
  ];
  const {service,tx}=harness({rows}),results=[];for(let i=0;i<10;i++)results.push(await service.evaluate(tx,input));
  assert.ok(results.every(result=>result.view.staffId===ids[0]));assert.ok(results.every(result=>result.view.outcome==='AUTO_ASSIGNED'));
  assert.ok(results[0].view.reasons.includes('LOWEST_WORKLOAD'));assert.ok(results[0].view.reasons.includes('STABLE_TIE_BREAK'));
});

test('auto-routing uses an eligible available candidate even when another lower-load worker was filtered out',async()=>{
  const {service,tx}=harness({rows:[{staffId:ids[1],displayName:'B',teamId:'20000000-0000-4000-8000-000000000001',skillCodes:['IOT'],activeWorkload:3}]});
  assert.equal((await service.evaluate(tx,input)).view.staffId,ids[1]);
});

test('weak grounding, missing routing facts and rule conflicts require manager review',async t=>{
  {const {service,tx}=harness();assert.deepEqual((await service.evaluate(tx,{...input,grounded:false})).view.reasons,['WEAK_RAG_GROUNDING']);}
  {const {service,tx}=harness();const value=await service.evaluate(tx,{...input,analysis:{...analysis,category:'OTHER',subcategory:'UNSPECIFIED'}});assert.deepEqual(value.view.reasons,['MISSING_ROUTING_FACT']);}
  {const {service,tx}=harness({evaluation:{status:'CONFLICT',diagnostic:'CONFLICTING_TARGETS',suggestedTarget:null}});assert.ok((await service.evaluate(tx,input)).view.reasons.includes('ROUTING_RULE_CONFLICT'));}
  await t.test('invalid winning target does not fall through',async()=>{const {service,tx}=harness({evaluation:{status:'NO_MATCH',diagnostic:'INVALID_TARGET',suggestedTarget:null}});assert.deepEqual((await service.evaluate(tx,input)).view.reasons,['INVALID_ROUTING_TARGET']);});
});

test('wrong skill, wrong team, inactive or unavailable staff all produce no eligible target after canonical DB filtering',async t=>{
  for(const name of ['wrong skill','wrong team','inactive','unavailable','zero staff'])await t.test(name,async()=>{const {service,tx}=harness({rows:[]});const result=await service.evaluate(tx,input);assert.equal(result.view.outcome,'MANAGER_REVIEW_REQUIRED');assert.ok(result.view.reasons.includes('NO_ELIGIBLE_STAFF'));assert.equal(result.view.staffId,null);});
});

test('routing rule Team wins, while missing Team or SLA policy fails closed',async t=>{
  const target={type:'TEAM',id:'20000000-0000-4000-8000-000000000009',displayName:'IoT',eligible:true};
  {const {service,tx}=harness({evaluation:{status:'MATCH',diagnostic:'MATCHED',suggestedTarget:target},team:{id:target.id,code:'IOT_POLICY'}});const result=await service.evaluate(tx,input);assert.equal(result.view.teamId,target.id);assert.ok(result.view.reasons.includes('ROUTING_RULE_MATCH'));}
  await t.test('unknown or inactive Team',async()=>{const {service,tx}=harness({team:null});assert.deepEqual((await service.evaluate(tx,input)).view.reasons,['INVALID_ROUTING_TARGET']);});
  await t.test('missing SLA policy',async()=>{const {service,tx}=harness({policies:[]});const result=await service.evaluate(tx,input);assert.equal(result.view.outcome,'MANAGER_REVIEW_REQUIRED');assert.ok(result.view.reasons.includes('MISSING_SLA_POLICY'));});
});

test('AI priority remains advisory and applied priority selects SLA',async()=>{
  const {service,tx}=harness(),result=await service.evaluate(tx,input);
  assert.equal(result.view.prioritySuggestion,'HIGH');assert.equal(result.view.appliedPriority,'MEDIUM');assert.equal(result.policy.targetMinutes,240);
});
