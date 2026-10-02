import type { Prisma } from '../generated/prisma/client.js';
import type { AuthorizationPolicyService } from '../authorization/authorization-policy.service.js';
import { ApiError } from '../http.js';
import { lockCollaboratorUsers, type CollaborationRequest } from './collaboration-access.js';

export const WATCH_ACTIONS = ['INTERNAL_NOTE_CREATED', 'SUBMIT_FOR_APPROVAL', 'APPROVE_AND_ASSIGN', 'REJECT_APPROVAL', 'REASSIGN', 'START_WORK', 'REQUEST_USER_INFO', 'USER_PROVIDE_INFO', 'RESOLVE', 'USER_REOPEN', 'USER_CONFIRM', 'CANCEL'] as const;
export const MAX_REQUEST_WATCHERS = 100;
export function internalRecipients(actorId: string | null, mentionedIds: string[], watcherIds: string[]) {
  const recipients = new Map<string, 'MENTION' | 'WATCH'>();
  for (const id of watcherIds) if (id !== actorId) recipients.set(id, 'WATCH');
  for (const id of mentionedIds) if (id !== actorId) recipients.set(id, 'MENTION');
  return [...recipients].sort(([a], [b]) => a.localeCompare(b));
}
export async function notifyCollaboration(tx: Prisma.TransactionClient, policy: AuthorizationPolicyService, request: CollaborationRequest, source: { id: string; action: string; actorId: string | null; createdAt: Date; noteId?: string }, mentionedIds: string[] = []) {
  if (!(WATCH_ACTIONS as readonly string[]).includes(source.action)) return;
  const watchers = await tx.requestWatcher.findMany({ where: { requestId: request.id }, take: MAX_REQUEST_WATCHERS + 1, orderBy: { userId: 'asc' }, select: { userId: true } });
  if (watchers.length > MAX_REQUEST_WATCHERS) throw new ApiError(409, 'WATCH_LIMIT', 'The subscription limit was exceeded.');
  const ids = [...new Set([...watchers.map(row => row.userId), ...mentionedIds])];
  if (!ids.length) return;
  await lockCollaboratorUsers(tx, ids);
  const eligible = new Set((await tx.user.findMany({ where: { AND: [{ id: { in: ids } }, policy.internalCollaborators(request)] }, select: { id: true } })).map(user => user.id));
  const recipients = internalRecipients(source.actorId, mentionedIds.filter(id => eligible.has(id)), watchers.map(row => row.userId).filter(id => eligible.has(id)));
  if (recipients.length) await tx.notification.createMany({ data: recipients.map(([recipientId, reason]) => ({
    recipientId, requestId: request.id, eventId: source.id, type: reason === 'MENTION' ? 'INTERNAL_NOTE_MENTION' : 'REQUEST_WATCH_ACTIVITY',
    safeActorMetadataJson: { reason, sourceAction: source.action, ...(source.noteId ? { noteId: source.noteId } : {}) }, createdAt: source.createdAt,
  })), skipDuplicates: true });
}
