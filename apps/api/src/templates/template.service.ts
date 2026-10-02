import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createTemplateSchema, createTemplateRevisionSchema, archiveTemplateSchema, templateListQuerySchema, templateHistoryQuerySchema, type CreateTemplateInput, type CreateTemplateRevisionInput } from '@mobiflow/contracts';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { ApiError } from '../http.js';
import { lockCollaborationIdentity } from '../requests/collaboration-access.js';
import { databaseNow } from '../requests/sla-sql.js';
import { page, pagination } from '../requests/request-query.service.js';
import { parse } from '../requests/validation.js';

const summarySelect = { id: true, type: true, status: true, name: true, description: true, currentRevision: true, createdAt: true, updatedAt: true, archivedAt: true } satisfies Prisma.OperationalTemplateSelect;
const revisionInclude = { items: { orderBy: { position: 'asc' as const } } } satisfies Prisma.OperationalTemplateRevisionInclude;
type Revision = Prisma.OperationalTemplateRevisionGetPayload<{ include: typeof revisionInclude }>;
const revisionView = (r: Revision, type: 'RESPONSE' | 'CHECKLIST') => ({ id: r.id, templateId: r.templateId, revision: r.revision, name: r.name, description: r.description, createdAt: r.createdAt, type,
  content: type === 'RESPONSE' ? { body: r.body! } : { items: r.items.map(item => ({ text: item.text, required: item.required })) } });

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService, private readonly policy: AuthorizationPolicyService) {}

  async list(actor: AuthenticatedActor, input: unknown) {
    const scope = this.policy.templateScope(actor), query = parse(templateListQuerySchema, input);
    if (actor.role === 'STAFF' && ((query.type && query.type !== 'RESPONSE') || (query.status && query.status !== 'ACTIVE'))) throw new ApiError(403, 'FORBIDDEN', 'Only active response templates are available.');
    const { where, limit } = pagination({ ...(query.limit ? { limit: String(query.limit) } : {}), ...(query.cursor ? { cursor: query.cursor } : {}) });
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const rows = await tx.operationalTemplate.findMany({ where: { AND: [scope, where, { ...(query.type ? { type: query.type } : {}), status: query.status ?? 'ACTIVE', ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {}) }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, select: summarySelect });
      return page(rows, limit);
    });
  }

  async detail(id: string, actor: AuthenticatedActor) {
    const scope = this.policy.templateScope(actor);
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const t = await tx.operationalTemplate.findFirst({ where: { AND: [{ id }, scope] }, select: { ...summarySelect, current: { include: revisionInclude } } });
      if (!t) throw new ApiError(404, 'NOT_FOUND', 'The template was not found.');
      return { ...t, current: revisionView(t.current, t.type) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async history(id: string, actor: AuthenticatedActor, input: unknown) {
    this.policy.assertCanManageTemplates(actor);
    const query = parse(templateHistoryQuerySchema, input), { where, limit } = pagination({ ...(query.limit ? { limit: String(query.limit) } : {}), ...(query.cursor ? { cursor: query.cursor } : {}) });
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const t = await tx.operationalTemplate.findUnique({ where: { id }, select: { type: true } });
      if (!t) throw new ApiError(404, 'NOT_FOUND', 'The template was not found.');
      const rows = await tx.operationalTemplateRevision.findMany({ where: { AND: [{ templateId: id }, where] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, include: revisionInclude });
      const result = page(rows, limit);
      return { ...result, data: result.data.map(r => revisionView(r, t.type)) };
    });
  }

  private async snapshot(tx: Prisma.TransactionClient, id: string, revision: number, actor: AuthenticatedActor, input: CreateTemplateInput, createdAt: Date) {
    return tx.operationalTemplateRevision.create({ data: { templateId: id, revision, name: input.name, description: input.description ?? null, createdById: actor.id, createdAt,
      body: input.type === 'RESPONSE' ? input.content.body : null, itemCount: input.type === 'CHECKLIST' ? input.content.items.length : 0,
      ...(input.type === 'CHECKLIST' ? { items: { create: input.content.items.map((item, index) => ({ ...item, position: index + 1 })) } } : {}) } });
  }
  private async audit(tx: Prisma.TransactionClient, actor: AuthenticatedActor, id: string, type: string, revision: number, action: string, correlationId: string, createdAt: Date) {
    await tx.auditLog.create({ data: { actorType: actor.role, actorId: actor.id, action, resourceType: 'OperationalTemplate', resourceId: id, requestCorrelationId: correlationId, safeAfterJson: { templateId: id, type, revision }, outcome: 'SUCCEEDED', createdAt } });
  }
  async create(actor: AuthenticatedActor, input: CreateTemplateInput, correlationId: string) {
    this.policy.assertCanManageTemplates(actor); const value = parse(createTemplateSchema, input), id = randomUUID();
    await this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor); const now = await databaseNow(tx);
      await tx.operationalTemplate.create({ data: { id, type: value.type, name: value.name, description: value.description ?? null, currentRevision: 1, createdById: actor.id, createdAt: now, updatedAt: now } });
      await this.snapshot(tx, id, 1, actor, value, now);
      await this.audit(tx, actor, id, value.type, 1, 'TEMPLATE_CREATED', correlationId, now);
    });
    return this.detail(id, actor);
  }
  private async locked(tx: Prisma.TransactionClient, id: string, expectedRevision: number) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "OperationalTemplate" WHERE id=${id}::uuid FOR UPDATE`);
    const t = await tx.operationalTemplate.findUnique({ where: { id } });
    if (!t) throw new ApiError(404, 'NOT_FOUND', 'The template was not found.');
    if (t.status !== 'ACTIVE' || t.currentRevision !== expectedRevision) throw new ApiError(409, 'STALE_TEMPLATE_REVISION', 'The template changed. Reload and review.');
    return t;
  }
  async revise(id: string, actor: AuthenticatedActor, input: CreateTemplateRevisionInput, correlationId: string) {
    this.policy.assertCanManageTemplates(actor); const value = parse(createTemplateRevisionSchema, input);
    await this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor); const t = await this.locked(tx, id, value.expectedRevision), now = await databaseNow(tx);
      if (t.type !== value.type) throw new ApiError(422, 'INVALID_TEMPLATE_TYPE', 'Template type cannot change.');
      const revision = t.currentRevision + 1;
      await tx.operationalTemplate.update({ where: { id }, data: { currentRevision: revision, name: value.name, description: value.description ?? null, updatedAt: now } });
      await this.snapshot(tx, id, revision, actor, value, now);
      await this.audit(tx, actor, id, t.type, revision, 'TEMPLATE_REVISED', correlationId, now);
    });
    return this.detail(id, actor);
  }
  async archive(id: string, actor: AuthenticatedActor, input: unknown, correlationId: string) {
    this.policy.assertCanManageTemplates(actor); const value = parse(archiveTemplateSchema, input);
    await this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor); const t = await this.locked(tx, id, value.expectedRevision), now = await databaseNow(tx);
      await tx.operationalTemplate.update({ where: { id }, data: { status: 'ARCHIVED', archivedAt: now, updatedAt: now } });
      await this.audit(tx, actor, id, t.type, t.currentRevision, 'TEMPLATE_ARCHIVED', correlationId, now);
    });
    return this.detail(id, actor);
  }
}
