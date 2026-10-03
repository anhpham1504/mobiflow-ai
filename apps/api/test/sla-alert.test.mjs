import test from 'node:test';
import assert from 'node:assert/strict';
import {parseApiEnvironment} from '@mobiflow/config';
import {assessSla,changeSla,slaConsumedRatio} from '../dist/requests/sla-clock.js';
import {currentSlaAlert,alertConfigIdentity} from '../dist/requests/sla-alert-policy.js';
import {AuthorizationPolicyService} from '../dist/authorization/authorization-policy.service.js';
import {INTERNAL_NOTIFICATION_TYPES} from '../dist/requests/internal-notification-types.js';
const start=new Date('2026-10-03T00:00:00Z'),at=n=>new Date(start.getTime()+n*1000);
const clock={startedAt:start,dueAt:at(100),targetSeconds:100,pausedAt:null,totalPausedSeconds:0,resolvedHoldAt:null,totalResolvedHoldSeconds:0,stoppedAt:null,stopReason:null,status:'SAFE',breachedAt:null,assessedAt:start};
const config={SLA_ALERT_ENABLED:true,SLA_ALERT_EARLY_RATIO:0.5,SLA_ALERT_AT_RISK_ENABLED:true,SLA_ALERT_BREACH_ENABLED:true};
for(const [seconds,event] of [[0,null],[49,null],[50,'SLA_REMINDER'],[79,'SLA_REMINDER'],[80,'SLA_AT_RISK_ESCALATION'],[100,'SLA_AT_RISK_ESCALATION'],[101,'SLA_BREACH_ESCALATION']])test('M22 highest current level at '+seconds+' canonical seconds',()=>{
  const assessment=assessSla(clock,at(seconds));assert.equal(currentSlaAlert(assessment,config)?.eventType??null,event);assert.equal(slaConsumedRatio(assessment),seconds/100);
});
test('M22 paused/resolved/closed/canceled canonical clocks suppress new observation and catch-up',()=>{
  for(const action of ['REQUEST_USER_INFO','RESOLVE','CANCEL'])assert.equal(currentSlaAlert(assessSla(changeSla(clock,action,at(101)),at(10000)),config),null);
  const closed=changeSla(changeSla(clock,'RESOLVE',at(50)),'USER_CONFIRM',at(500));assert.equal(currentSlaAlert(assessSla(closed,at(10000)),config),null);
});
test('M22 highest disabled trigger never emits an obsolete lower level; sticky breach remains authoritative',()=>{
  assert.equal(currentSlaAlert(assessSla(clock,at(101)),{...config,SLA_ALERT_BREACH_ENABLED:false}),null);
  assert.equal(currentSlaAlert(assessSla(clock,at(90)),{...config,SLA_ALERT_AT_RISK_ENABLED:false}),null);
  assert.equal(currentSlaAlert(assessSla(clock,at(101)),{...config,SLA_ALERT_ENABLED:false}),null);
  const changed=changeSla(changeSla(clock,'PRIORITY',at(101),100),'PRIORITY',at(102),10000);
  assert.equal(currentSlaAlert(assessSla(changed,at(103)),config).eventType,'SLA_BREACH_ESCALATION');
});
test('M22 config identity changes evidence, stable level/threshold identity survives re-enable and policy edits',()=>{
  const next={...config,SLA_ALERT_EARLY_RATIO:0.4};assert.notEqual(alertConfigIdentity(config),alertConfigIdentity(next));
  assert.deepEqual(currentSlaAlert(assessSla(clock,at(70)),config),currentSlaAlert(assessSla(clock,at(70)),next));
});
test('M22 same budget after canonical resume/reopen, M12 exclusions stay authoritative',()=>{
  let c=changeSla(clock,'REQUEST_USER_INFO',at(50));c=changeSla(c,'USER_PROVIDE_INFO',at(100));
  assert.equal(currentSlaAlert(assessSla(c,at(100)),config).eventType,'SLA_REMINDER');
  c=changeSla(c,'RESOLVE',at(100));c=changeSla(c,'USER_REOPEN',at(200));
  assert.equal(currentSlaAlert(assessSla(c,at(200)),config).eventType,'SLA_REMINDER');assert.equal(c.startedAt.getTime(),start.getTime());
});
test('M22 new and legacy SLA notifications all use current-recipient scope before pagination',()=>{
  const policy=new AuthorizationPolicyService();for(const type of ['SLA_REMINDER','SLA_AT_RISK','SLA_BREACHED'])assert.ok(INTERNAL_NOTIFICATION_TYPES.includes(type));
  for(const role of ['USER','STAFF','MANAGER']){
    const scope=policy.notificationScope({id:'10000000-0000-4000-8000-000000000001',role});assert.equal(scope.OR.length,role==='USER'?1:2);
    assert.ok(scope.OR[0].type.notIn.includes('SLA_REMINDER'));if(role!=='USER')assert.deepEqual(scope.OR[1].request.is,policy.requestScope({id:scope.recipientId,role}));
  }
});
test('M22 environment defaults and invalid thresholds/cadence/bounds/booleans fail safely',()=>{
  const base={DATABASE_URL:'postgresql://app:synthetic@localhost/test',JWT_SECRET:'unit-jwt-0123456789'.padEnd(48,'a'),REFRESH_TOKEN_SECRET:'unit-refresh-9876543210'.padEnd(48,'b'),OLLAMA_BASE_URL:'http://localhost:11434',OLLAMA_MODEL:'unconfigured',OLLAMA_EMBEDDING_MODEL:'unconfigured'};
  const parsed=parseApiEnvironment(base);assert.equal(parsed.SLA_ALERT_EARLY_RATIO,0.5);assert.equal(parsed.SLA_ALERT_BATCH_SIZE,100);assert.equal(parsed.SLA_ALERT_INTERVAL_SECONDS,60);
  for(const [key,values] of Object.entries({SLA_ALERT_EARLY_RATIO:[0,0.8,1,'bad'],SLA_ALERT_INTERVAL_SECONDS:[0,1,29,3601],SLA_ALERT_BATCH_SIZE:[0,201,1.5],SLA_ALERT_TIME_BUDGET_MS:[999,30001],SLA_ALERT_ENABLED:['yes','1']}))for(const value of values)assert.throws(()=>parseApiEnvironment({...base,[key]:value}),/Invalid environment keys/);
});
