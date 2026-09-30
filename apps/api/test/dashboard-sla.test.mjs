import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardSchema,slaViewSchema} from '@mobiflow/contracts';
import {assessSla,changeSla,slaView} from '../dist/requests/sla-clock.js';
import {dashboardQuery,DashboardService,metricPredicates} from '../dist/dashboard/dashboard.service.js';
import {AuthorizationPolicyService} from '../dist/authorization/authorization-policy.service.js';

const now=new Date('2026-09-30T09:00:00Z'),at=seconds=>new Date(now.getTime()+seconds*1000);
const clock=(overrides={})=>({startedAt:now,dueAt:at(7200),targetSeconds:7200,pausedAt:null,totalPausedSeconds:0,resolvedHoldAt:null,totalResolvedHoldSeconds:0,stoppedAt:null,stopReason:null,status:'SAFE',breachedAt:null,assessedAt:now,...overrides});
for(const [time,state,remaining] of [[5759,'SAFE',1441],[5760,'AT_RISK',1440],[5761,'AT_RISK',1439],[7199,'AT_RISK',1],[7200,'AT_RISK',0],[7201,'BREACHED',-1]]){
  test(`M12 canonical boundary ${time}s is ${state}`,()=>{const c=assessSla(clock(),at(time));assert.equal(c.status,state);assert.equal(c.remainingSeconds,remaining);assert.equal(slaView(clock(),at(time)).breachedBySeconds,Math.max(0,-remaining));});
}
test('M12 multiple pause cycles, defensive repeat and backwards time keep exact exclusions',()=>{
  let c=changeSla(clock(),'REQUEST_USER_INFO',at(600));
  c=changeSla(c,'REQUEST_USER_INFO',at(900));assert.equal(c.pausedAt.getTime(),at(600).getTime());
  assert.equal(assessSla(c,at(80000)).elapsedSeconds,600);assert.equal(c.status,'PAUSED');
  assert.throws(()=>changeSla(c,'USER_PROVIDE_INFO',at(599)),/backwards/);
  c=changeSla(c,'USER_PROVIDE_INFO',at(1200));c=changeSla(c,'USER_PROVIDE_INFO',at(1200));assert.equal(c.totalPausedSeconds,600);
  c=changeSla(c,'REQUEST_USER_INFO',at(1800));c=changeSla(c,'USER_PROVIDE_INFO',at(2700));
  assert.equal(c.totalPausedSeconds,1500);assert.equal(c.dueAt.getTime(),at(8700).getTime());
});
test('M12 resolve, close, repeated hold/reopen and cancellation never reset the budget',()=>{
  let c=changeSla(clock(),'RESOLVE',at(3600));c=changeSla(c,'RESOLVE',at(4000));
  assert.equal(c.resolvedHoldAt.getTime(),at(3600).getTime());assert.equal(assessSla(c,at(90000)).remainingSeconds,3600);
  const closed=changeSla(c,'USER_CONFIRM',at(6000));assert.equal(closed.status,'MET');assert.equal(closed.dueAt.getTime(),at(7200).getTime());
  assert.deepEqual(changeSla(closed,'USER_REOPEN',at(90000)),closed);
  c=changeSla(c,'USER_REOPEN',at(6000));c=changeSla(c,'USER_REOPEN',at(6000));assert.equal(c.totalResolvedHoldSeconds,2400);
  c=changeSla(c,'RESOLVE',at(7000));c=changeSla(c,'USER_REOPEN',at(8000));assert.equal(c.totalResolvedHoldSeconds,3400);
  assert.equal(c.startedAt.getTime(),now.getTime());assert.equal(c.dueAt.getTime(),at(10600).getTime());
  c=changeSla(c,'REQUEST_USER_INFO',at(9000));c=changeSla(c,'CANCEL',at(12000));
  assert.equal(c.pausedAt,null);assert.equal(c.status,'SAFE');assert.equal(c.totalPausedSeconds,3000);
  assert.deepEqual(assessSla(c,at(900000)).remainingSeconds,assessSla(c,at(12000)).remainingSeconds);
});
test('M12 late pause/resolve and priority changes retain historical breach without negative overrun display',()=>{
  const paused=changeSla(clock(),'REQUEST_USER_INFO',at(7201));assert.equal(paused.status,'PAUSED');assert.ok(paused.breachedAt);
  assert.equal(changeSla(paused,'CANCEL',at(9000)).status,'BREACHED');
  assert.equal(changeSla(clock(),'RESOLVE',at(7201)).status,'BREACHED');
  let c=changeSla(clock(),'PRIORITY',at(4500),3600);c=changeSla(c,'PRIORITY',at(4600),28800);
  const view=slaView(c,at(4700));assert.equal(view.state,'BREACHED');assert.equal(view.breachedBySeconds,0);
  const json=JSON.parse(JSON.stringify(view));slaViewSchema.parse(json);assert.equal(json.state,json.status);assert.equal(json.deadlineAt,json.dueAt);
});
test('M12 invalid configuration is rejected, not silently reset',()=>{
  for(const overrides of [{targetSeconds:0},{targetSeconds:1.5},{totalPausedSeconds:-1},{totalResolvedHoldSeconds:-1},{startedAt:new Date(NaN)}])assert.throws(()=>assessSla(clock(overrides),now),/Invalid/);
  assert.throws(()=>assessSla(clock(),now,1));assert.throws(()=>changeSla(clock(),'PRIORITY',now,-1));
});

for(const role of ['USER','STAFF','MANAGER'])test(`M11 ${role} empty/single/mixed response contract and bound scoped query`,async()=>{
  const actor={role,id:'10000000-0000-4000-8000-000000000001',sessionId:'10000000-0000-4000-8000-000000000002'},policy=new AuthorizationPolicyService();
  const query=dashboardQuery(actor,policy,now);assert.match(query.sql,/COUNT\(scoped.id\) FILTER/);assert.match(query.sql,/LEFT JOIN "SlaInstance"/);assert.doesNotMatch(query.sql,/LIMIT|OFFSET|SELECT \*/);
  if(role==='MANAGER')assert.ok(!query.values.includes(actor.id));else {assert.ok(query.values.includes(actor.id));assert.ok(!query.sql.includes(actor.id));assert.match(query.sql,role==='USER'?/r\."createdById"=/:/r\."currentAssigneeId"=/);}
  for(const value of [0,1,120]){
    const metrics=Object.fromEntries(Object.keys(metricPredicates[role]).map(key=>[key,value]));let queries=0;
    const service=new DashboardService({$queryRaw:async()=>{queries++;return [{asOf:now,dayFrom:now,dayTo:at(86400),metrics}];}},policy);
    const result=await service.snapshot(actor,now);assert.equal(queries,1);dashboardSchema.parse(result);assert.deepEqual(result.metrics,metrics);
    assert.equal(dashboardSchema.safeParse({...result,metrics:{...metrics,globalTotal:1000}}).success,false);
  }
  const keys=Object.keys(metricPredicates[role]);assert.ok(keys.includes('slaAtRisk'));assert.ok(keys.includes('slaBreached'));
  if(role!=='MANAGER')assert.ok(!keys.includes('pendingApproval')&&!keys.includes('unassigned'));
});
test('M11 predicate definitions cover mixed statuses, assignment eligibility and resolution day',()=>{
  assert.match(metricPredicates.USER.openRequests.sql,/NOT IN \('CLOSED','CANCELED'\)/);
  assert.match(metricPredicates.STAFF.active.sql,/'ASSIGNED','IN_PROGRESS','WAITING_USER'/);
  assert.match(metricPredicates.MANAGER.unassigned.sql,/'PENDING_APPROVAL'.*IS NULL/);
  assert.match(metricPredicates.MANAGER.resolvedToday.sql,/'RESOLVED','CLOSED'/);
  assert.match(metricPredicates.MANAGER.resolvedToday.sql,/>=clock\."dayFrom".*<clock\."dayTo"/);
});
