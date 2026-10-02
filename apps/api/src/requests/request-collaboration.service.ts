import { Injectable } from '@nestjs/common';
import { emptyCollaborationSchema, mentionCandidateQuerySchema } from '@mobiflow/contracts';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { ApiError } from '../http.js';
import { parse } from './validation.js';
import { databaseNow } from './sla-sql.js';
import { lockCollaborationIdentity, lockCollaborationRequest } from './collaboration-access.js';
import { MAX_REQUEST_WATCHERS } from './collaboration-notifications.js';

@Injectable()
export class RequestCollaborationService {
  constructor(private readonly prisma: PrismaService, private readonly policy: AuthorizationPolicyService) {}
  async candidates(id: string, actor: AuthenticatedActor, input: unknown) {
    this.policy.internalNoteScope(actor);
    const query = parse(mentionCandidateQuerySchema, input);
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const request = await lockCollaborationRequest(tx, this.policy, id, actor, false);
      return tx.user.findMany({ where: { AND: [this.policy.internalCollaborators(request), { id: { not: actor.id } }, ...(query.q ? [{ displayName: { contains: query.q, mode: 'insensitive' as const } }] : [])] },
        select: { id: true, displayName: true, role: true }, take: Number(query.limit ?? 20), orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      });
    });
  }
  async watch(id: string, actor: AuthenticatedActor, desired: boolean | undefined, correlationId: string, query: unknown, body: unknown = {}) {
    this.policy.internalNoteScope(actor);
    parse(emptyCollaborationSchema, query); parse(emptyCollaborationSchema, body ?? {});
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      await lockCollaborationRequest(tx, this.policy, id, actor, desired !== undefined);
      const key = { requestId: id, userId: actor.id };
      const existing = await tx.requestWatcher.findUnique({ where: { requestId_userId: key }, select: { userId: true } });
      if (desired === undefined || Boolean(existing) === desired) return { watching: Boolean(existing) };
      const createdAt = await databaseNow(tx);
      if (desired) {
        if (await tx.requestWatcher.count({ where: { requestId: id } }) >= MAX_REQUEST_WATCHERS) throw new ApiError(409, 'WATCH_LIMIT', 'The subscription limit was reached.');
        await tx.requestWatcher.create({ data: { ...key, createdAt } });
      } else await tx.requestWatcher.delete({ where: { requestId_userId: key } });
      await tx.auditLog.create({ data: { actorType: actor.role, actorId: actor.id, action: desired ? 'REQUEST_WATCH_STARTED' : 'REQUEST_WATCH_STOPPED',
        resourceType: 'RequestWatcher', resourceId: id + ':' + actor.id, requestCorrelationId: correlationId, safeAfterJson: key, outcome: 'SUCCEEDED', createdAt,
      } });
      return { watching: desired };
    });
  }
}
