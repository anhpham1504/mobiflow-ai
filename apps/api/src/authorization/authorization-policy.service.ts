import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';

interface RequestOwnership { createdById: string; currentAssigneeId: string | null }

@Injectable()
export class AuthorizationPolicyService {
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
