import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { ApiEnvironment } from '@mobiflow/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { assessSla } from './sla-clock.js';
import { databaseNow } from './sla-sql.js';
import { API_ENV } from '../tokens.js';
import { SLA_ALERT_LOG } from './sla-alert.service.js';
import type { LogSink } from '../http.js';

// M12 remains the persisted clock-assessment owner. M22 alone owns warning delivery.
@Injectable()
export class SlaMonitorService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<{ scanned: number; events: number }> | null = null;
  constructor(private readonly prisma: PrismaService, @Inject(API_ENV) private readonly env: ApiEnvironment, @Inject(SLA_ALERT_LOG) private readonly log: LogSink) {}
  onModuleInit() { if (this.env.NODE_ENV !== 'test') { this.timer = setInterval(() => { void this.tick().catch(() => undefined); }, 30000); this.timer.unref(); void this.tick().catch(() => undefined); } }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.running?.catch(() => undefined); }
  tick(at?: Date) {
    if (this.running) return this.running;
    this.running = this.sweep(at).catch(error => { this.log({ event: 'sla-monitor.failed', code: 'SLA_MONITOR_FAILED' }); throw error; }).finally(() => { this.running = null; });
    return this.running;
  }
  private async sweep(at?: Date) {
    const rows = await this.prisma.slaInstance.findMany({ where: { stoppedAt: null, request: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED'] } }, OR: [{ status: { in: ['SAFE', 'AT_RISK'] } }, { breachedAt: null }] }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 200, select: { id: true, requestId: true } });
    for (const row of rows) await this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Request" WHERE "id"=${row.requestId}::uuid FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SlaInstance" WHERE "id"=${row.id}::uuid FOR UPDATE`);
      const current = await tx.slaInstance.findUnique({ where: { id: row.id }, include: { request: { select: { status: true } } } });
      if (!current || current.stoppedAt || !['ASSIGNED', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED'].includes(current.request.status)) return;
      const assessment = assessSla(current, at ?? await databaseNow(tx));
      await tx.slaInstance.update({ where: { id: current.id }, data: { assessedAt: assessment.assessedAt, status: assessment.status, breachedAt: assessment.breachedAt, dueAt: assessment.dueAt, version: { increment: 1 } } });
    });
    return { scanned: rows.length, events: 0 };
  }
}
