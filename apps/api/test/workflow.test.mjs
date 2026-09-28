import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statuses } from '@mobiflow/contracts';
import { transitionTarget } from '../dist/requests/transition-rules.js';
import { assessSla,changeSla } from '../dist/requests/sla-clock.js';

test('M3 exhaustive state/action/role matrix rejects the complement, including protected future AI transitions',()=>{
  const rules={
    MANUAL_TRIAGE:{MANAGER:{NEW:'TRIAGED',TRIAGED:'TRIAGED'}},
    SUBMIT_FOR_APPROVAL:{MANAGER:{TRIAGED:'PENDING_APPROVAL'}},
    APPROVE_AND_ASSIGN:{MANAGER:{PENDING_APPROVAL:'ASSIGNED'}},REJECT_APPROVAL:{MANAGER:{PENDING_APPROVAL:'TRIAGED'}},
    START_WORK:{STAFF:{ASSIGNED:'IN_PROGRESS'}},REQUEST_USER_INFO:{STAFF:{IN_PROGRESS:'WAITING_USER'}},
    USER_PROVIDE_INFO:{USER:{WAITING_USER:'IN_PROGRESS'}},RESOLVE:{STAFF:{IN_PROGRESS:'RESOLVED'}},
    USER_CONFIRM:{USER:{RESOLVED:'CLOSED'}},USER_REOPEN:{USER:{RESOLVED:'IN_PROGRESS'}},
    CANCEL:{USER:Object.fromEntries(['NEW','AI_ANALYZING','TRIAGED','PENDING_APPROVAL'].map(s=>[s,'CANCELED'])),MANAGER:Object.fromEntries(['NEW','AI_ANALYZING','TRIAGED','PENDING_APPROVAL','ASSIGNED','IN_PROGRESS','WAITING_USER'].map(s=>[s,'CANCELED']))},
    REASSIGN:{MANAGER:Object.fromEntries(['ASSIGNED','IN_PROGRESS','WAITING_USER'].map(s=>[s,s]))},
    PRIORITY:{MANAGER:Object.fromEntries(['ASSIGNED','IN_PROGRESS','WAITING_USER'].map(s=>[s,s]))},
    CHECKLIST_ADD:{STAFF:{IN_PROGRESS:'IN_PROGRESS'}},CHECKLIST_EDIT:{STAFF:{IN_PROGRESS:'IN_PROGRESS'}},
    MESSAGE:Object.fromEntries(['USER','STAFF','MANAGER'].map(r=>[r,Object.fromEntries(statuses.filter(s=>!['CLOSED','CANCELED'].includes(s)).map(s=>[s,s]))])),
    START_AI_ANALYSIS:{},COMPLETE_AI_ANALYSIS:{},FAIL_AI_ANALYSIS:{},
  };
  let checked=0;
  for(const state of statuses) for(const [action,roles] of Object.entries(rules)) for(const role of ['USER','STAFF','MANAGER']) {
    const expected=roles[role]?.[state];
    if(expected) assert.equal(transitionTarget(state,action,role),expected);
    else assert.throws(()=>transitionTarget(state,action,role));
    checked++;
  }
  assert.equal(checked,570);
});
const at=s=>new Date('2026-09-28T'+s+'Z');
function clock(){return {startedAt:at('09:00:00'),dueAt:at('11:00:00'),targetSeconds:7200,pausedAt:null,totalPausedSeconds:0,resolvedHoldAt:null,totalResolvedHoldSeconds:0,stoppedAt:null,stopReason:null,status:'SAFE',breachedAt:null,assessedAt:at('09:00:00')};}
test('SLA wait, resolve, reopen, exact deadline, hold and sticky breach use an injected deterministic time',()=>{
  let c=clock();
  assert.equal(assessSla(c,at('10:36:00')).status,'AT_RISK');
  assert.equal(assessSla(c,at('11:00:00')).status,'AT_RISK');
  assert.equal(assessSla(c,at('11:10:00')).breachedAt.toISOString(),at('11:00:01').toISOString());
  c=changeSla(c,'REQUEST_USER_INFO',at('09:30:00.999'));
  assert.equal(c.status,'PAUSED');
  assert.equal(assessSla(c,at('12:00:00')).elapsedSeconds,1800);
  c=changeSla(c,'USER_PROVIDE_INFO',at('10:00:00.555'));
  assert.equal(c.totalPausedSeconds,1800);assert.equal(c.dueAt.toISOString(),at('11:30:00').toISOString());
  c=changeSla(c,'RESOLVE',at('11:00:00'));
  assert.equal(c.status,'MET');assert.equal(assessSla(c,at('12:00:00')).remainingSeconds,1800);
  const closed=changeSla(c,'USER_CONFIRM',at('14:00:00'));
  assert.equal(closed.status,'MET');assert.equal(closed.dueAt.toISOString(),at('11:30:00').toISOString());
  c=changeSla(c,'USER_REOPEN',at('12:00:00'));
  assert.equal(c.totalResolvedHoldSeconds,3600);assert.equal(c.dueAt.toISOString(),at('12:30:00').toISOString());
  assert.equal(changeSla(c,'RESOLVE',at('12:30:00')).status,'MET');
  assert.equal(changeSla(c,'RESOLVE',at('12:30:01')).status,'BREACHED');
  c=changeSla(clock(),'PRIORITY',at('10:15:00'),3600);
  assert.equal(c.breachedAt.toISOString(),at('10:15:00').toISOString());
  c=changeSla(c,'PRIORITY',at('10:20:00'),28800);
  assert.equal(c.status,'BREACHED');
  c=changeSla(c,'REQUEST_USER_INFO',at('10:25:00'));
  assert.equal(c.status,'PAUSED');
  c=changeSla(c,'CANCEL',at('11:00:00'));
  assert.equal(c.stopReason,'CANCELED');assert.equal(c.status,'BREACHED');assert.equal(c.totalPausedSeconds,2100);
});
test('SLA repeated exclusion cycles, no-op reassignment and cancellation preserve consumed budget',()=>{
  let c=changeSla(clock(),'REQUEST_USER_INFO',at('09:10:00'));
  c=changeSla(c,'USER_PROVIDE_INFO',at('09:20:00'));
  c=changeSla(c,'REQUEST_USER_INFO',at('09:30:00'));
  c=changeSla(c,'USER_PROVIDE_INFO',at('09:45:00'));
  assert.equal(c.totalPausedSeconds,1500);
  c=changeSla(c,'RESOLVE',at('10:00:00'));
  c=changeSla(c,'USER_REOPEN',at('10:30:00'));
  c=changeSla(c,'RESOLVE',at('10:45:00'));
  c=changeSla(c,'USER_REOPEN',at('11:00:00'));
  assert.equal(c.totalResolvedHoldSeconds,2700);assert.equal(assessSla(c,at('11:00:00')).elapsedSeconds,3000);
  assert.equal(changeSla(c,'REASSIGN',at('11:00:00')).dueAt.toISOString(),c.dueAt.toISOString());
  assert.throws(()=>assessSla(c,at('11:00:00'),1));
});

