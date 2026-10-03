import type { SlaInstance, SlaStatus } from '../generated/prisma/client.js';

export const second = (date: Date) => new Date(Math.floor(date.getTime()/1000)*1000);
export const SLA_RISK_RATIO = 0.2;
// M12 owns budget measurement; operational consumers never reconstruct clock math.
export function slaConsumedRatio(assessment: { elapsedSeconds: number; targetSeconds: number }) {
  return assessment.elapsedSeconds / assessment.targetSeconds;
}
// Both the scalar clock and the PostgreSQL aggregate use this budget equation.
export function slaElapsed<T>(effective:T,started:T,paused:T,hold:T,math:{subtract:(a:T,b:T)=>T;nonnegative:(value:T)=>T}):T {
  return math.nonnegative(math.subtract(math.subtract(math.subtract(effective,started),paused),hold));
}
// Ordered precedence is shared with the SQL CASE compiler; PAUSED keeps breach history.
export function slaRules<T>(paused:T,breached:T,completed:T,atRisk:T):{when:T;state:SlaStatus}[] {
  return [{when:paused,state:'PAUSED'},{when:breached,state:'BREACHED'},{when:completed,state:'MET'},{when:atRisk,state:'AT_RISK'}];
}
export type ClockState = Pick<SlaInstance,'startedAt'|'dueAt'|'targetSeconds'|'pausedAt'|'totalPausedSeconds'|'resolvedHoldAt'|'totalResolvedHoldSeconds'|'stoppedAt'|'stopReason'|'status'|'breachedAt'|'assessedAt'>;
export function assessSla(input: ClockState, now: Date, riskRatio = SLA_RISK_RATIO): ClockState & { elapsedSeconds: number; remainingSeconds: number } {
  if (!(riskRatio > 0 && riskRatio < 1) || !Number.isInteger(input.targetSeconds) || input.targetSeconds <= 0 ||
    ![input.totalPausedSeconds,input.totalResolvedHoldSeconds].every(n=>Number.isInteger(n)&&n>=0) ||
    [now,input.startedAt,input.pausedAt,input.resolvedHoldAt,input.stoppedAt].some(d=>d!==null&&!Number.isFinite(d.getTime()))) throw new Error('Invalid SLA configuration');
  const c = { ...input };
  const at = second(now);
  const effective = c.pausedAt ?? c.resolvedHoldAt ?? c.stoppedAt ?? at;
  const elapsedSeconds = slaElapsed(second(effective).getTime()/1000,second(c.startedAt).getTime()/1000,c.totalPausedSeconds,c.totalResolvedHoldSeconds,{subtract:(a,b)=>a-b,nonnegative:n=>Math.max(0,n)});
  const remainingSeconds = c.targetSeconds-elapsedSeconds;
  c.dueAt = new Date(second(c.startedAt).getTime()+(c.targetSeconds+c.totalPausedSeconds+c.totalResolvedHoldSeconds)*1000);
  if (remainingSeconds < 0 && !c.breachedAt) c.breachedAt = new Date(c.dueAt.getTime()+1000);
  c.assessedAt = at;
  c.status = slaRules(!!c.pausedAt,!!c.breachedAt,!!c.resolvedHoldAt,remainingSeconds<=c.targetSeconds*riskRatio).find(rule=>rule.when)?.state??'SAFE';
  return { ...c, elapsedSeconds, remainingSeconds };
}
export function changeSla(input: ClockState, action: string, now: Date, targetSeconds?: number): ClockState {
  const at = second(now);
  const c: ClockState = { ...input };
  assessSla(c,at);
  // Domain guards reject terminal writes; defensive replay must not unfreeze a clock.
  if(c.stoppedAt)return clockFields(c);
  const latest=c.pausedAt??c.resolvedHoldAt??c.startedAt;
  if(at<second(latest)||at<second(c.startedAt))throw new Error('SLA time cannot move backwards');
  // First assess the old effective clock; a late pause or resolution cannot hide breach.
  Object.assign(c, clockFields(assessSla(c,at)));
  if (action === 'REQUEST_USER_INFO' && !c.pausedAt) c.pausedAt = at;
  if (action === 'USER_PROVIDE_INFO' && c.pausedAt) {
    c.totalPausedSeconds += Math.max(0,(at.getTime()-c.pausedAt.getTime())/1000); c.pausedAt = null;
  }
  if (action === 'RESOLVE' && !c.resolvedHoldAt) c.resolvedHoldAt = at;
  if (action === 'USER_REOPEN' && c.resolvedHoldAt) {
    c.totalResolvedHoldSeconds += Math.max(0,(at.getTime()-c.resolvedHoldAt.getTime())/1000); c.resolvedHoldAt = null;
  }
  if (action === 'USER_CONFIRM') { c.stoppedAt = at; c.stopReason = 'CLOSED'; }
  if (action === 'CANCEL') {
    if (c.pausedAt) { c.totalPausedSeconds += Math.max(0,(at.getTime()-c.pausedAt.getTime())/1000); c.pausedAt = null; }
    if (c.resolvedHoldAt) { c.totalResolvedHoldSeconds += Math.max(0,(at.getTime()-c.resolvedHoldAt.getTime())/1000); c.resolvedHoldAt = null; }
    c.stoppedAt = at; c.stopReason = 'CANCELED';
  }
  if (targetSeconds !== undefined) {
    c.targetSeconds = targetSeconds;
    if (!c.breachedAt && assessSla(c,at).remainingSeconds < 0) c.breachedAt = at;
  }
  return clockFields(assessSla(c,at));
}
export function clockFields(c: ClockState): ClockState {
  return { startedAt:c.startedAt,dueAt:c.dueAt,targetSeconds:c.targetSeconds,pausedAt:c.pausedAt,totalPausedSeconds:c.totalPausedSeconds,resolvedHoldAt:c.resolvedHoldAt,totalResolvedHoldSeconds:c.totalResolvedHoldSeconds,stoppedAt:c.stoppedAt,stopReason:c.stopReason,status:c.status,breachedAt:c.breachedAt,assessedAt:c.assessedAt };
}
export function slaView(input:ClockState,now:Date){
  const sla=assessSla(input,now);
  return {status:sla.status,state:sla.status,startedAt:sla.startedAt,dueAt:sla.dueAt,deadlineAt:sla.dueAt,
    pausedAt:sla.pausedAt,resolvedHoldAt:sla.resolvedHoldAt,stoppedAt:sla.stoppedAt,stopReason:sla.stopReason,
    remainingSeconds:sla.remainingSeconds,elapsedSeconds:sla.elapsedSeconds,targetSeconds:sla.targetSeconds,breachedAt:sla.breachedAt,
    breachedBySeconds:Math.max(0,-sla.remainingSeconds),completedAt:sla.resolvedHoldAt,
    riskThresholdSeconds:sla.targetSeconds*SLA_RISK_RATIO,totalPausedSeconds:sla.totalPausedSeconds};
}

