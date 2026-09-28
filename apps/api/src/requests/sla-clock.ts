import type { SlaInstance, SlaStatus } from '../generated/prisma/client.js';

export const second = (date: Date) => new Date(Math.floor(date.getTime()/1000)*1000);
export type ClockState = Pick<SlaInstance,'startedAt'|'dueAt'|'targetSeconds'|'pausedAt'|'totalPausedSeconds'|'resolvedHoldAt'|'totalResolvedHoldSeconds'|'stoppedAt'|'stopReason'|'status'|'breachedAt'|'assessedAt'>;
export function assessSla(input: ClockState, now: Date, riskRatio = 0.2): ClockState & { elapsedSeconds: number; remainingSeconds: number } {
  if (!(riskRatio > 0 && riskRatio < 1) || input.targetSeconds <= 0) throw new Error('Invalid SLA configuration');
  const c = { ...input };
  const at = second(now);
  const effective = c.pausedAt ?? c.resolvedHoldAt ?? c.stoppedAt ?? at;
  const elapsedSeconds = Math.max(0, (second(effective).getTime()-second(c.startedAt).getTime())/1000-c.totalPausedSeconds-c.totalResolvedHoldSeconds);
  const remainingSeconds = c.targetSeconds-elapsedSeconds;
  c.dueAt = new Date(second(c.startedAt).getTime()+(c.targetSeconds+c.totalPausedSeconds+c.totalResolvedHoldSeconds)*1000);
  if (remainingSeconds < 0 && !c.breachedAt) c.breachedAt = new Date(c.dueAt.getTime()+1000);
  c.assessedAt = at;
  c.status = (c.pausedAt ? 'PAUSED' : c.breachedAt ? 'BREACHED' : c.resolvedHoldAt ? 'MET' : remainingSeconds <= c.targetSeconds*riskRatio ? 'AT_RISK' : 'SAFE') as SlaStatus;
  return { ...c, elapsedSeconds, remainingSeconds };
}
export function changeSla(input: ClockState, action: string, now: Date, targetSeconds?: number): ClockState {
  const at = second(now);
  const c: ClockState = { ...input };
  // First assess the old effective clock; a late pause or resolution cannot hide breach.
  Object.assign(c, clockFields(assessSla(c,at)));
  if (action === 'REQUEST_USER_INFO') c.pausedAt = at;
  if (action === 'USER_PROVIDE_INFO' && c.pausedAt) {
    c.totalPausedSeconds += Math.max(0,(at.getTime()-c.pausedAt.getTime())/1000); c.pausedAt = null;
  }
  if (action === 'RESOLVE') c.resolvedHoldAt = at;
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

