import { Prisma, type RequestStatus } from '../generated/prisma/client.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import type { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import { ApiError } from '../http.js';

export type CollaborationRequest = { id: string; status: RequestStatus; createdById: string; currentAssigneeId: string | null };
export async function lockCollaborationIdentity(tx: Prisma.TransactionClient, actor: AuthenticatedActor) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${actor.id}::uuid FOR SHARE`);
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, active: true } });
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RefreshSession" WHERE "id"=${actor.sessionId}::uuid FOR SHARE`);
  const session = await tx.refreshSession.findFirst({ where: { id: actor.sessionId, userId: actor.id, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  if (!user?.active || user.role !== actor.role || !session) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
}
export async function lockCollaborationRequest(tx: Prisma.TransactionClient, policy: AuthorizationPolicyService, id: string, actor: AuthenticatedActor, write: boolean) {
  const lock = write ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`;
  const [request] = await tx.$queryRaw<CollaborationRequest[]>(Prisma.sql`
    SELECT r."id", r."status", r."createdById", r."currentAssigneeId" FROM "Request" r
    WHERE r."id"=${id}::uuid AND ${policy.requestScopeSql(actor)} ${lock}`);
  policy.assertCanReadRequest(actor, request ?? null);
  if (!request) throw new ApiError(404, 'NOT_FOUND', 'The resource was not found.');
  return request;
}
export async function lockCollaboratorUsers(tx: Prisma.TransactionClient, ids: string[]) {
  if (ids.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR SHARE`);
}
