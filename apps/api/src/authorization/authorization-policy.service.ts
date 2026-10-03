import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { INTERNAL_NOTIFICATION_TYPES } from '../requests/internal-notification-types.js';

interface RequestOwnership { createdById: string; currentAssigneeId: string | null }

@Injectable()
export class AuthorizationPolicyService {
  assertCanRoute(actor: AuthenticatedActor) {
    if (actor.role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'Only managers may access routing.');
  }

  templateScope(actor: AuthenticatedActor): Prisma.OperationalTemplateWhereInput {
    if (actor.role === 'STAFF') return { type: 'RESPONSE', status: 'ACTIVE' };
    if (actor.role === 'MANAGER') return {};
    throw new ApiError(403, 'FORBIDDEN', 'This role cannot access templates.');
  }

  assertCanManageTemplates(actor: AuthenticatedActor) {
    if (actor.role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'Only managers may manage templates.');
  }

  internalCollaborators(request: RequestOwnership): Prisma.UserWhereInput {
    // Same A01/current-assignment predicates as requestScope, never relation-derived access.
    return { active: true, OR: [{ role: 'MANAGER' }, { role: 'STAFF', id: request.currentAssigneeId ?? '00000000-0000-4000-8000-000000000000' }] };
  }

  notificationScope(actor: AuthenticatedActor): Prisma.NotificationWhereInput {
    const internal = [...INTERNAL_NOTIFICATION_TYPES];
    return { recipientId: actor.id, recipient: { active: true, role: actor.role }, OR: [
      { type: { notIn: internal } },
      ...(actor.role === 'USER' ? [] : [{ type: { in: internal }, request: { is: this.internalNoteScope(actor) } }]),
    ] };
  }

  internalNoteScope(actor: AuthenticatedActor): Prisma.RequestWhereInput {
    if (actor.role !== 'STAFF' && actor.role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'This role cannot access the resource.');
    return this.requestScope(actor);
  }

  requestScope(actor: AuthenticatedActor): Prisma.RequestWhereInput {
    if (actor.role === 'USER') return { createdById: actor.id };
    if (actor.role === 'STAFF') return { currentAssigneeId: actor.id };
    return {};
  }
  requestScopeSql(actor:AuthenticatedActor):Prisma.Sql {
    const scope=this.requestScope(actor);
    if(scope.createdById)return Prisma.sql`r."createdById"=${actor.id}::uuid`;
    if(scope.currentAssigneeId)return Prisma.sql`r."currentAssigneeId"=${actor.id}::uuid`;
    if(actor.role==='MANAGER'&&Object.keys(scope).length===0)return Prisma.sql`TRUE`;
    throw new ApiError(403,'FORBIDDEN','Unsupported request scope.');
  }

  canReadRequest(actor: AuthenticatedActor, request: RequestOwnership): boolean {
    return actor.role === 'MANAGER' || (actor.role === 'USER' && request.createdById === actor.id) || (actor.role === 'STAFF' && request.currentAssigneeId === actor.id);
  }

  assertCanReadRequest(actor: AuthenticatedActor, request: RequestOwnership | null): asserts request is RequestOwnership {
    if (!request || !this.canReadRequest(actor, request)) throw new ApiError(404, 'NOT_FOUND', 'The resource was not found.');
  }
}
