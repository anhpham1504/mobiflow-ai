import { Injectable } from '@nestjs/common';
import type { CreateInternalNoteInput } from '@mobiflow/contracts';
import { internalNoteQuerySchema } from '@mobiflow/contracts';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type RequestStatus } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { page, pagination } from './request-query.service.js';
import { databaseNow } from './sla-sql.js';
import { parse } from './validation.js';

type Tx = Prisma.TransactionClient;
type NoteRequest = { id: string; status: RequestStatus; createdById: string; currentAssigneeId: string | null };
const noteSelect = {
  id: true, requestId: true, body: true, createdAt: true,
  author: { select: { id: true, displayName: true } },
} satisfies Prisma.RequestInternalNoteSelect;

@Injectable()
export class InternalNoteService {
  constructor(private readonly prisma: PrismaService, private readonly policy: AuthorizationPolicyService) {}

  private async identity(tx: Tx, actor: AuthenticatedActor) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id"=${actor.id}::uuid FOR SHARE`);
    const user = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, active: true } });
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RefreshSession" WHERE "id"=${actor.sessionId}::uuid FOR SHARE`);
    const session = await tx.refreshSession.findFirst({ where: { id: actor.sessionId, userId: actor.id, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
    if (!user?.active || user.role !== actor.role || !session) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }

  private async request(tx: Tx, id: string, actor: AuthenticatedActor, write: boolean) {
    // The same parent lock used by the state machine prevents a reassign/close race.
    const lock = write ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`;
    const [request] = await tx.$queryRaw<NoteRequest[]>(Prisma.sql`
      SELECT r."id", r."status", r."createdById", r."currentAssigneeId" FROM "Request" r
      WHERE r."id"=${id}::uuid AND ${this.policy.requestScopeSql(actor)} ${lock}`);
    this.policy.assertCanReadRequest(actor, request ?? null);
    if (!request) throw new ApiError(404, 'NOT_FOUND', 'The resource was not found.');
    return request;
  }

  async list(id: string, actor: AuthenticatedActor, input: unknown) {
    this.policy.internalNoteScope(actor);
    const { where, limit } = pagination(parse(internalNoteQuerySchema, input));
    return this.prisma.$transaction(async tx => {
      await this.identity(tx, actor);
      await this.request(tx, id, actor, false);
      const rows = await tx.requestInternalNote.findMany({
        where: { AND: [{ requestId: id }, where] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, select: noteSelect,
      });
      return page(rows, limit);
    });
  }

  async create(id: string, actor: AuthenticatedActor, input: CreateInternalNoteInput, correlationId: string) {
    this.policy.internalNoteScope(actor);
    return this.prisma.$transaction(async tx => {
      await this.identity(tx, actor);
      const request = await this.request(tx, id, actor, true);
      if (['CLOSED', 'CANCELED'].includes(request.status)) throw new ApiError(409, 'INVALID_STATE', 'The action is not allowed in the current state.');
      // A millisecond Date matches the existing cursor representation exactly.
      const createdAt = await databaseNow(tx);
      const note = await tx.requestInternalNote.create({ data: { requestId: id, authorId: actor.id, body: input.body, createdAt }, select: noteSelect });
      // Resource-only audit deliberately stays outside Request history and AI contexts.
      await tx.auditLog.create({ data: {
        actorType: actor.role, actorId: actor.id, action: 'INTERNAL_NOTE_CREATED', resourceType: 'RequestInternalNote', resourceId: note.id,
        requestCorrelationId: correlationId, safeAfterJson: { noteId: note.id, requestId: id, authorId: actor.id }, outcome: 'SUCCEEDED', createdAt,
      } });
      return note;
    });
  }
}
