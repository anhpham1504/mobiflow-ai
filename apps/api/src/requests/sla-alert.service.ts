import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { ApiEnvironment } from '@mobiflow/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import type { LogSink } from '../http.js';
import { API_ENV } from '../tokens.js';
import { assessSla } from './sla-clock.js';
import { lockCollaboratorUsers } from './collaboration-access.js';
import { alertConfigIdentity, currentSlaAlert } from './sla-alert-policy.js';

export const SLA_ALERT_CLOCK = Symbol('SLA_ALERT_CLOCK');
export const SLA_ALERT_LOG = Symbol('SLA_ALERT_LOG');
export type SlaAlertClock = (tx: Pick<Prisma.TransactionClient, '$queryRaw'>) => Promise<Date>;
const progressId = 'M22_PRIMARY';
const activeStatuses = ['ASSIGNED', 'IN_PROGRESS'] as const;
type ScanResult = { scanned: number; events: number; notifications: number; failures: number; wrapped: boolean; progressSaved: boolean; disabled: boolean; durationMs: number };

@Injectable()
export class SlaAlertService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<ScanResult> | null = null;
  private status: { state: 'IDLE' | 'DISABLED' | 'RUNNING' | 'OK' | 'PARTIAL_FAILURE' | 'FAILED'; lastResult: ScanResult | null } = { state: 'IDLE', lastResult: null };
  constructor(private readonly prisma: PrismaService, private readonly policy: AuthorizationPolicyService,
    @Inject(API_ENV) private readonly env: ApiEnvironment, @Inject(SLA_ALERT_CLOCK) private readonly clock: SlaAlertClock,
    @Inject(SLA_ALERT_LOG) private readonly log: LogSink) {}
  snapshot() { return { ...this.status }; }
  onModuleInit() {
    if (this.env.NODE_ENV !== 'test' && this.env.SLA_ALERT_ENABLED) {
      this.timer = setInterval(() => { void this.tick().catch(() => undefined); }, this.env.SLA_ALERT_INTERVAL_SECONDS * 1000);
      this.timer.unref(); void this.tick().catch(() => undefined);
    }
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.running?.catch(() => undefined); }
  tick() {
    if (this.running) return this.running;
    this.status.state = 'RUNNING';
    this.running = this.scan().then(result => {
      this.status = { state: result.disabled ? 'DISABLED' : result.failures ? 'PARTIAL_FAILURE' : 'OK', lastResult: result };
      this.log({ event: 'sla-alert.scan', ...result }); return result;
    }).catch(error => { this.status.state = 'FAILED'; this.log({ event: 'sla-alert.scan-failed', code: 'SLA_ALERT_TICK_FAILED' }); throw error; }).finally(() => { this.running = null; });
    return this.running;
  }
  private async scan(): Promise<ScanResult> {
    const began = performance.now();
    const result: ScanResult = { scanned: 0, events: 0, notifications: 0, failures: 0, wrapped: false, progressSaved: false, disabled: !this.env.SLA_ALERT_ENABLED, durationMs: 0 };
    if (result.disabled) return result;
    const progress = await this.prisma.slaAlertScanProgress.findUniqueOrThrow({ where: { id: progressId } });
    const rows = await this.prisma.slaInstance.findMany({ where: { stoppedAt: null, request: { status: { in: [...activeStatuses] } }, ...(progress.cursorId ? { id: { gt: progress.cursorId } } : {}) }, orderBy: { id: 'asc' }, take: this.env.SLA_ALERT_BATCH_SIZE, select: { id: true, requestId: true } });
    const managers = await this.prisma.user.findMany({ where: { role: 'MANAGER', active: true }, orderBy: { id: 'asc' }, take: 101, select: { id: true } });
    if (managers.length > 100) throw new Error('Scoped manager recipient bound exceeded');
    let cursorId = progress.cursorId;
    for (const row of rows) {
      if (result.scanned && performance.now() - began >= this.env.SLA_ALERT_TIME_BUDGET_MS) break;
      try {
        const observed = await this.observe(row.id, row.requestId, managers.map(user => user.id));
        result.events += observed.events; result.notifications += observed.notifications;
      } catch { result.failures++; this.log({ event: 'sla-alert.item-failed', code: 'SLA_ALERT_ITEM_FAILED', slaInstanceId: row.id }); }
      result.scanned++; cursorId = row.id;
    }
    if (result.scanned === rows.length && rows.length < this.env.SLA_ALERT_BATCH_SIZE) { cursorId = null; result.wrapped = true; }
    const saved = await this.prisma.slaAlertScanProgress.updateMany({ where: { id: progressId, version: progress.version }, data: { cursorId, version: { increment: 1 }, updatedAt: await this.clock(this.prisma) } });
    result.progressSaved = saved.count === 1; result.durationMs = Math.round((performance.now() - began) * 100) / 100;
    return result;
  }
  async observe(slaInstanceId: string, requestId: string, managerIds: string[]) {
    try { return await this.observeTransaction(slaInstanceId, requestId, managerIds); }
    catch (error) {
      // Roll back a loser completely, then read/reconcile the committed winner.
      const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' ? error.meta?.target : null;
      if (Array.isArray(target) && ['requestId', 'slaInstanceId', 'dimension', 'eventType', 'thresholdKey'].every(field => target.includes(field))) return this.observeTransaction(slaInstanceId, requestId, managerIds);
      throw error;
    }
  }
  private observeTransaction(slaInstanceId: string, requestId: string, managerIds: string[]) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Request" WHERE "id"=${requestId}::uuid FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SlaInstance" WHERE "id"=${slaInstanceId}::uuid FOR UPDATE`);
      const request = await tx.request.findUnique({ where: { id: requestId }, select: { id: true, status: true, createdById: true, currentAssigneeId: true } });
      const row = await tx.slaInstance.findUnique({ where: { id: slaInstanceId } });
      if (!request || !row || row.requestId !== request.id || !(activeStatuses as readonly string[]).includes(request.status)) return { events: 0, notifications: 0 };
      const now = await this.clock(tx), sla = assessSla(row, now), level = currentSlaAlert(sla, this.env);
      if (!level) return { events: 0, notifications: 0 };
      const key = { requestId, slaInstanceId, dimension: 'RESOLUTION', eventType: level.eventType, thresholdKey: level.thresholdKey };
      let alert = await tx.slaOperationalAlert.findUnique({ where: { requestId_slaInstanceId_dimension_eventType_thresholdKey: key } });
      let events = 0;
      if (!alert) {
        const id = randomUUID(), eventId = randomUUID();
        await tx.auditLog.create({ data: { id: eventId, actorType: 'SYSTEM', action: level.eventType + '_EMITTED', resourceType: 'SlaOperationalAlert', resourceId: id, requestCorrelationId: eventId, safeAfterJson: { requestId, alertId: id, slaInstanceId, canonicalState: sla.status, thresholdKey: level.thresholdKey }, outcome: 'SUCCEEDED', createdAt: now } });
        alert = await tx.slaOperationalAlert.create({ data: { id, ...key, eventId, canonicalState: sla.status, deadlineAt: sla.dueAt, elapsedSeconds: sla.elapsedSeconds, remainingSeconds: sla.remainingSeconds, targetSeconds: sla.targetSeconds, observedAt: now, configIdentity: alertConfigIdentity(this.env) } });
        events = 1;
      }
      const ids = [...new Set([...(request.currentAssigneeId ? [request.currentAssigneeId] : []), ...(level.managers ? managerIds : [])])];
      await lockCollaboratorUsers(tx, ids);
      const eligible = ids.length ? await tx.user.findMany({ where: { AND: [{ id: { in: ids } }, this.policy.internalCollaborators(request)] }, select: { id: true } }) : [];
      const delivered = eligible.length ? await tx.notification.createMany({ data: eligible.map(user => ({ recipientId: user.id, requestId, eventId: alert.eventId, type: level.notificationType, slaInstanceId, slaAlertId: alert.id, warningLevel: level.warningLevel, safeActorMetadataJson: { actorType: 'SYSTEM', thresholdKey: level.thresholdKey, canonicalState: sla.status }, createdAt: now })), skipDuplicates: true }) : { count: 0 };
      return { events, notifications: delivered.count };
    }, { maxWait: 3000, timeout: 5000 });
  }
}
