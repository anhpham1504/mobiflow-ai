import { Injectable } from '@nestjs/common';
import type { CreateInternalNoteInput } from '@mobiflow/contracts';
import { createInternalNoteSchema, internalNoteQuerySchema } from '@mobiflow/contracts';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { ApiError } from '../http.js';
import { page, pagination } from './request-query.service.js';
import { databaseNow } from './sla-sql.js';
import { parse } from './validation.js';
import { lockCollaborationIdentity, lockCollaborationRequest, lockCollaboratorUsers } from './collaboration-access.js';
import { notifyCollaboration } from './collaboration-notifications.js';

const noteSelect = {
  id: true, requestId: true, body: true, createdAt: true,
  author: { select: { id: true, displayName: true } },
  mentions: { orderBy: { mentionedUserId: 'asc' }, select: { mentionedUser: { select: { id: true, displayName: true } } } },
} satisfies Prisma.RequestInternalNoteSelect;
const noteView = (note: Prisma.RequestInternalNoteGetPayload<{ select: typeof noteSelect }>) => ({
  ...note, mentions: note.mentions.map(row => ({ userId: row.mentionedUser.id, displayName: row.mentionedUser.displayName })),
});

@Injectable()
export class InternalNoteService {
  constructor(private readonly prisma: PrismaService, private readonly policy: AuthorizationPolicyService) {}

  async list(id: string, actor: AuthenticatedActor, input: unknown) {
    this.policy.internalNoteScope(actor);
    const { where, limit } = pagination(parse(internalNoteQuerySchema, input));
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      await lockCollaborationRequest(tx, this.policy, id, actor, false);
      const rows = await tx.requestInternalNote.findMany({
        where: { AND: [{ requestId: id }, where] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, select: noteSelect,
      });
      return page(rows.map(noteView), limit);
    });
  }

  async create(id: string, actor: AuthenticatedActor, input: CreateInternalNoteInput, correlationId: string) {
    this.policy.internalNoteScope(actor);
    const validated = parse(createInternalNoteSchema, input);
    const mentionedIds = validated.mentionedUserIds ?? [];
    if (mentionedIds.includes(actor.id)) throw new ApiError(400, 'INVALID_MENTION_TARGET', 'Choose eligible collaborators other than yourself.');
    return this.prisma.$transaction(async tx => {
      await lockCollaborationIdentity(tx, actor);
      const request = await lockCollaborationRequest(tx, this.policy, id, actor, true);
      if (['CLOSED', 'CANCELED'].includes(request.status)) throw new ApiError(409, 'INVALID_STATE', 'The action is not allowed in the current state.');
      if (mentionedIds.length) {
        await lockCollaboratorUsers(tx, mentionedIds);
        const eligible = await tx.user.findMany({ where: { AND: [{ id: { in: mentionedIds } }, this.policy.internalCollaborators(request)] }, select: { id: true } });
        if (eligible.length !== mentionedIds.length) throw new ApiError(400, 'INVALID_MENTION_TARGET', 'Choose eligible collaborators other than yourself.');
      }
      // A millisecond Date matches the existing cursor representation exactly.
      const createdAt = await databaseNow(tx);
      const note = await tx.requestInternalNote.create({ data: { requestId: id, authorId: actor.id, body: validated.body, createdAt,
        mentions: { create: mentionedIds.map(mentionedUserId => ({ mentionedUserId, createdAt })) },
      }, select: noteSelect });
      // Resource-only audit deliberately stays outside Request history and AI contexts.
      const event = await tx.auditLog.create({ data: {
        actorType: actor.role, actorId: actor.id, action: 'INTERNAL_NOTE_CREATED', resourceType: 'RequestInternalNote', resourceId: note.id,
        requestCorrelationId: correlationId, safeAfterJson: { noteId: note.id, requestId: id, authorId: actor.id }, outcome: 'SUCCEEDED', createdAt,
      } });
      await notifyCollaboration(tx, this.policy, request, { id: event.id, action: 'INTERNAL_NOTE_CREATED', actorId: actor.id, createdAt, noteId: note.id }, mentionedIds);
      return noteView(note);
    });
  }
}
