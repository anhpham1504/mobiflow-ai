import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createInternalNoteSchema, mentionedUserIdsSchema, mentionCandidateQuerySchema, mentionCandidateSchema, emptyCollaborationSchema, watchStateResponseSchema } from '@mobiflow/contracts';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';
import { InternalNoteService } from '../dist/requests/internal-note.service.js';
import { RequestCollaborationService } from '../dist/requests/request-collaboration.service.js';
import { WATCH_ACTIONS, internalRecipients, notifyCollaboration } from '../dist/requests/collaboration-notifications.js';
const id = randomUUID(), other = randomUUID(), actor = { id, role: 'STAFF', sessionId: id };

test('M19 optional structured IDs keep M18 input, deduplicate/canonicalize UUIDs, bound unique/input counts and reject overrides', () => {
  assert.deepEqual(createInternalNoteSchema.parse({ body: '  @someone plain text  ' }), { body: '@someone plain text' });
  assert.deepEqual(mentionedUserIdsSchema.parse([other, other.toUpperCase()]), [other]);
  assert.equal(mentionedUserIdsSchema.parse(Array.from({ length: 10 }, () => randomUUID())).length, 10);
  for (const value of [Array.from({ length: 11 }, () => randomUUID()), Array(101).fill(other), ['invalid'], [id, 2], 'all']) assert.equal(mentionedUserIdsSchema.safeParse(value).success, false);
  for (const key of ['authorId', 'role', 'watchers', 'notificationRecipients', 'expectedVersion']) assert.equal(createInternalNoteSchema.safeParse({ body: 'Valid', [key]: id }).success, false);
});
test('M19 candidates/watch DTOs are strict bounded safe contracts', () => {
  assert.equal(mentionCandidateQuerySchema.safeParse({ q: '🙂'.repeat(80), limit: '20' }).success, true);
  for (const value of [{ q: '🙂'.repeat(81) }, { limit: '21' }, { limit: '0' }, { limit: 2 }, { role: 'MANAGER' }]) assert.equal(mentionCandidateQuerySchema.safeParse(value).success, false);
  assert.equal(mentionCandidateSchema.safeParse({ id, displayName: 'Same Name', role: 'MANAGER', email: 'private' }).success, false);
  assert.equal(mentionCandidateSchema.safeParse({ id, displayName: 'đ'.repeat(160), role: 'MANAGER' }).success, true);
  assert.equal(mentionCandidateSchema.safeParse({ id, displayName: 'đ'.repeat(161), role: 'MANAGER' }).success, false);
  assert.equal(emptyCollaborationSchema.safeParse({ userId: other }).success, false);
  assert.equal(watchStateResponseSchema.safeParse({ data: { watching: true, watcherCount: 1 }, requestId: id }).success, false);
});
test('M19 collaborator eligibility is active A01 MANAGER/current STAFF and never a watch relation', () => {
  const policy = new AuthorizationPolicyService();
  assert.deepEqual(policy.internalCollaborators({ currentAssigneeId: other }), { active: true, OR: [{ role: 'MANAGER' }, { role: 'STAFF', id: other }] });
  const user = policy.notificationScope({ ...actor, role: 'USER' });
  assert.equal(user.OR.length, 1); assert.deepEqual(user.OR[0].type.notIn, ['INTERNAL_NOTE_MENTION', 'REQUEST_WATCH_ACTIVITY']);
  assert.deepEqual(policy.notificationScope(actor).OR[1].request.is, { currentAssigneeId: id });
});
test('M19 forbidden roles/self mention are denied before child writes', async () => {
  const db = { $transaction: () => { throw new Error('must not open'); } }, policy = new AuthorizationPolicyService();
  const notes = new InternalNoteService(db, policy), collaboration = new RequestCollaborationService(db, policy);
  await assert.rejects(notes.create(id, actor, { body: 'Note', mentionedUserIds: [id] }, id), error => error.code === 'INVALID_MENTION_TARGET');
  for (const work of [() => collaboration.candidates(id, { ...actor, role: 'USER' }, {}), () => collaboration.watch(id, { ...actor, role: 'USER' }, true, id, {})]) await assert.rejects(work(), error => error.getStatus() === 403);
});
test('M19 recipient union suppresses self and deterministically gives mention precedence', () => {
  assert.deepEqual(internalRecipients(id, [id, other, other], [id, other, other]), [[other, 'MENTION']]);
  assert.deepEqual(internalRecipients(id, [], [other]), [[other, 'WATCH']]);
});
test('M19 exact event allowlist excludes AI/background/reads/SLA/advisory and arbitrary events', async () => {
  assert.deepEqual(WATCH_ACTIONS, ['INTERNAL_NOTE_CREATED', 'SUBMIT_FOR_APPROVAL', 'APPROVE_AND_ASSIGN', 'REJECT_APPROVAL', 'REASSIGN', 'START_WORK', 'REQUEST_USER_INFO', 'USER_PROVIDE_INFO', 'RESOLVE', 'USER_REOPEN', 'USER_CONFIRM', 'CANCEL']);
  for (const action of ['READ', 'HEALTH', 'AI_RECOMMENDATION_V2_ACCEPTED', 'COMPLETE_AI_ANALYSIS', 'SLA_AT_RISK', 'EMBEDDING', 'REQUEST_WATCH_STARTED', 'MESSAGE']) await notifyCollaboration({}, {}, {}, { action });
});
test('M19 fan-out uses batched live eligibility, safe metadata, one insert and persistent conflict handling', async () => {
  const stale = randomUUID(), calls = [], at = new Date();
  const tx = {
    $queryRaw: async () => [], requestWatcher: { findMany: async () => [{ userId: id }, { userId: other }, { userId: stale }] },
    user: { findMany: async input => { calls.push(input); return [{ id }, { id: other }]; } },
    notification: { createMany: async input => { calls.push(input); } },
  };
  await notifyCollaboration(tx, new AuthorizationPolicyService(), { id, currentAssigneeId: other }, { id, action: 'INTERNAL_NOTE_CREATED', actorId: id, createdAt: at, noteId: other }, [other]);
  const insertion = calls.find(call => call.data);
  assert.equal(calls.length, 2); assert.equal(insertion.data.length, 1); assert.equal(insertion.skipDuplicates, true);
  assert.deepEqual(insertion.data[0].safeActorMetadataJson, { reason: 'MENTION', sourceAction: 'INTERNAL_NOTE_CREATED', noteId: other });
  assert.equal(insertion.data[0].type, 'INTERNAL_NOTE_MENTION');
  assert.equal('body' in insertion.data[0], false);
});
test('M19 watch repeats do not audit, insert, delete or modify Request', async () => {
  const tx = { $queryRaw: async sql => sql.sql.includes('FROM "Request"') ? [{ id, status: 'CLOSED', createdById: other, currentAssigneeId: id }] : [],
    user: { findUnique: async () => ({ id, role: 'STAFF', active: true }) }, refreshSession: { findFirst: async () => ({ id }) },
    requestWatcher: { findUnique: async () => ({ userId: id }) },
  };
  const service = new RequestCollaborationService({ $transaction: work => work(tx) }, new AuthorizationPolicyService());
  assert.deepEqual(await service.watch(id, actor, true, id, {}), { watching: true });
  tx.requestWatcher.findUnique = async () => null;
  assert.deepEqual(await service.watch(id, actor, false, id, {}), { watching: false });
});
