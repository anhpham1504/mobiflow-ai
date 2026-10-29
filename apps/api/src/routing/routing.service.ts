import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createRoutingRuleSchema, createRoutingRevisionSchema, routingCommandSchema, routingConditionsSchema, routingHistoryQuerySchema, routingListQuerySchema, routingEmptySchema, normalizeRoutingConditions, type RoutingDefinition, type RoutingFacts, type RoutingTargetView } from '@mobiflow/contracts';
import { Prisma, type RoutingRuleRevision } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { ApiError } from '../http.js';
import { lockCollaborationIdentity } from '../requests/collaboration-access.js';
import { eligibleStaffPredicate } from '../requests/staff-eligibility.js';
import { databaseNow } from '../requests/sla-sql.js';
import { page, pagination } from '../requests/request-query.service.js';
import { parse } from '../requests/validation.js';
import { RoutingFactsBuilder } from './routing-facts.js';
import { RoutingRuleEvaluator } from './routing-evaluator.js';

const ruleInclude = { current: true } satisfies Prisma.RoutingRuleInclude;
type Rule = Prisma.RoutingRuleGetPayload<{ include: typeof ruleInclude }>;
function revisionView(revision: RoutingRuleRevision) {
  return { id: revision.id, ruleId: revision.ruleId, revision: revision.revision, name: revision.name, description: revision.description,
    priority: revision.priority, target: { type: 'TEAM' as const, id: revision.targetTeamId }, conditions: routingConditionsSchema.parse(revision.conditions), createdAt: revision.createdAt };
}
function ruleView(rule: Rule) {
  return { id: rule.id, status: rule.status, currentRevision: rule.currentRevision, version: rule.version, createdAt: rule.createdAt, updatedAt: rule.updatedAt, archivedAt: rule.archivedAt, current: revisionView(rule.current) };
}
const pageInput = (query: { limit?: number | undefined; cursor?: string | undefined }) => pagination({ ...(query.limit ? { limit: String(query.limit) } : {}), ...(query.cursor ? { cursor: query.cursor } : {}) });

@Injectable()
export class RoutingService {
  private readonly facts = new RoutingFactsBuilder();
  private readonly evaluator = new RoutingRuleEvaluator();
  constructor(private readonly prisma: PrismaService, private readonly policy: AuthorizationPolicyService) {}

  async list(actor: AuthenticatedActor, input: unknown) {
    this.policy.assertCanRoute(actor);
    const query = parse(routingListQuerySchema, input), { where, limit } = pageInput(query);
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const rows = await tx.routingRule.findMany({ where: { AND: [where, {
        ...(query.status ? { status: query.status } : {}), ...(query.q ? { current: { is: { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } } } : {}),
      }] }, include: ruleInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
      const result = page(rows, limit);
      return { ...result, data: result.data.map(ruleView) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async detail(id: string, actor: AuthenticatedActor) {
    this.policy.assertCanRoute(actor);
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const rule = await tx.routingRule.findUnique({ where: { id }, include: ruleInclude });
      if (!rule) throw new ApiError(404, 'NOT_FOUND', 'The routing rule was not found.');
      return ruleView(rule);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async history(id: string, actor: AuthenticatedActor, input: unknown) {
    this.policy.assertCanRoute(actor);
    const { where, limit } = pageInput(parse(routingHistoryQuerySchema, input));
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      if (!await tx.routingRule.findUnique({ where: { id }, select: { id: true } })) throw new ApiError(404, 'NOT_FOUND', 'The routing rule was not found.');
      const rows = await tx.routingRuleRevision.findMany({ where: { AND: [{ ruleId: id }, where] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
      const result = page(rows, limit);
      return { ...result, data: result.data.map(revisionView) };
    });
  }
  private async targetViews(tx: Prisma.TransactionClient, ids?: string[]): Promise<RoutingTargetView[]> {
    if (ids?.length === 0) return [];
    const filter = ids ? Prisma.sql`WHERE t.id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})` : Prisma.empty;
    const rows = await tx.$queryRaw<{ id: string; displayName: string; eligible: boolean }[]>(Prisma.sql`
      SELECT t.id,t.name AS "displayName",EXISTS(SELECT 1 FROM "TeamMember" m JOIN "User" u ON u.id=m."userId" WHERE m."teamId"=t.id AND ${eligibleStaffPredicate()}) AS eligible
      FROM "Team" t ${filter} ORDER BY t.id LIMIT 501`);
    if (rows.length > 500) throw new ApiError(503, 'ROUTING_LIMIT_EXCEEDED', 'Routing capacity exceeded. Manual assignment remains available.');
    return rows.map(row => ({ type: 'TEAM', ...row }));
  }
  async targets(actor: AuthenticatedActor, input: unknown) {
    this.policy.assertCanRoute(actor); parse(routingEmptySchema, input);
    return this.prisma.$transaction(async tx => { await lockCollaborationIdentity(tx, actor); return (await this.targetViews(tx)).filter(target => target.eligible); });
  }
  private async validTarget(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT t.id FROM "Team" t JOIN "TeamMember" m ON m."teamId"=t.id JOIN "User" u ON u.id=m."userId"
      WHERE t.id=${id}::uuid AND ${eligibleStaffPredicate()} ORDER BY u.id LIMIT 1 FOR SHARE OF t,m,u`);
    if (!rows.length) throw new ApiError(422, 'INVALID_ROUTING_TARGET', 'Select an eligible active team.');
  }
  private async snapshot(tx: Prisma.TransactionClient, id: string, revision: number, actor: AuthenticatedActor, input: RoutingDefinition, now: Date) {
    await tx.routingRuleRevision.create({ data: { ruleId: id, revision, name: input.name, description: input.description ?? null, priority: input.priority, targetTeamId: input.target.id,
      conditions: normalizeRoutingConditions(input.conditions), createdById: actor.id, createdAt: now } });
  }
  private async audit(tx: Prisma.TransactionClient, id: string, actor: AuthenticatedActor, revision: number, version: number, priority: number, action: string, correlationId: string, now: Date) {
    await tx.auditLog.create({ data: { actorType: actor.role, actorId: actor.id, action, resourceType: 'RoutingRule', resourceId: id, requestCorrelationId: correlationId,
      safeAfterJson: { ruleId: id, revision, version, priority }, outcome: 'SUCCEEDED', createdAt: now } });
  }
  async create(actor: AuthenticatedActor, input: unknown, correlationId: string) {
    this.policy.assertCanRoute(actor); const value = parse(createRoutingRuleSchema, input), id = randomUUID();
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor); await this.validTarget(tx, value.target.id); const now = await databaseNow(tx);
      await tx.routingRule.create({ data: { id, createdById: actor.id, createdAt: now, updatedAt: now } });
      await this.snapshot(tx, id, 1, actor, value, now);
      await this.audit(tx, id, actor, 1, 1, value.priority, 'ROUTING_RULE_CREATED', correlationId, now);
      return ruleView(await tx.routingRule.findUniqueOrThrow({ where: { id }, include: ruleInclude }));
    });
  }
  private async locked(tx: Prisma.TransactionClient, id: string, expected: { expectedRevision: number; expectedRuleVersion: number }) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "RoutingRule" WHERE id=${id}::uuid FOR UPDATE`);
    const rule = await tx.routingRule.findUnique({ where: { id }, include: ruleInclude });
    if (!rule) throw new ApiError(404, 'NOT_FOUND', 'The routing rule was not found.');
    if (rule.status === 'ARCHIVED' || rule.currentRevision !== expected.expectedRevision || rule.version !== expected.expectedRuleVersion) throw new ApiError(409, 'STALE_ROUTING_RULE', 'The routing rule changed. Reload and review.');
    return rule;
  }
  async revise(id: string, actor: AuthenticatedActor, input: unknown, correlationId: string) {
    this.policy.assertCanRoute(actor); const value = parse(createRoutingRevisionSchema, input);
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor); const rule = await this.locked(tx, id, value);
      await this.validTarget(tx, value.target.id); const now = await databaseNow(tx), revision = rule.currentRevision + 1, version = rule.version + 1;
      await tx.routingRule.update({ where: { id }, data: { currentRevision: revision, version, updatedAt: now } });
      await this.snapshot(tx, id, revision, actor, value, now);
      await this.audit(tx, id, actor, revision, version, value.priority, 'ROUTING_RULE_REVISED', correlationId, now);
      return ruleView(await tx.routingRule.findUniqueOrThrow({ where: { id }, include: ruleInclude }));
    });
  }
  async lifecycle(id: string, actor: AuthenticatedActor, input: unknown, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED', correlationId: string) {
    this.policy.assertCanRoute(actor); const value = parse(routingCommandSchema, input);
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor); const rule = await this.locked(tx, id, value);
      if (rule.status === status) throw new ApiError(409, 'STALE_ROUTING_RULE', 'The routing rule is already in that state.');
      if (status === 'ACTIVE') await this.validTarget(tx, rule.current.targetTeamId);
      const now = await databaseNow(tx), version = rule.version + 1;
      const updated = await tx.routingRule.update({ where: { id }, data: { status, version, updatedAt: now, ...(status === 'ARCHIVED' ? { archivedAt: now } : {}) }, include: ruleInclude });
      await this.audit(tx, id, actor, rule.currentRevision, version, rule.current.priority, { ACTIVE: 'ROUTING_RULE_ACTIVATED', INACTIVE: 'ROUTING_RULE_DEACTIVATED', ARCHIVED: 'ROUTING_RULE_ARCHIVED' }[status], correlationId, now);
      return ruleView(updated);
    });
  }
  async evaluateFacts(tx:Prisma.TransactionClient,facts:RoutingFacts,requestVersion:number) {
    const rules=await tx.routingRule.findMany({where:{status:'ACTIVE'},include:ruleInclude,orderBy:{id:'asc'},take:501});
    if(rules.length>500)throw new ApiError(503,'ROUTING_LIMIT_EXCEEDED','Routing capacity exceeded. Manual assignment remains available.');
    const targets=new Map((await this.targetViews(tx,[...new Set(rules.map(rule=>rule.current.targetTeamId))])).map(target=>[target.id,target]));
    return this.evaluator.evaluate(facts,requestVersion,rules.map(rule=>({ruleId:rule.id,revisionId:rule.current.id,revision:rule.currentRevision,ruleVersion:rule.version,status:rule.status,
      name:rule.current.name,priority:rule.current.priority,conditions:routingConditionsSchema.parse(rule.current.conditions),
      target:targets.get(rule.current.targetTeamId)??{type:'TEAM',id:rule.current.targetTeamId,displayName:'Unavailable team',eligible:false},
    })));
  }
  async evaluate(id: string, actor: AuthenticatedActor, input: unknown) {
    this.policy.assertCanRoute(actor); parse(routingEmptySchema, input === undefined ? {} : input);
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const request = await tx.request.findFirst({ where: { AND: [{ id }, this.policy.requestScope(actor)] }, select: { version: true, category: true, subcategory: true, priority: true, createdById: true, currentAssigneeId: true } });
      this.policy.assertCanReadRequest(actor, request);
      if (!request) throw new ApiError(404, 'NOT_FOUND', 'The resource was not found.');
      return this.evaluateFacts(tx,this.facts.build(request),request.version);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
