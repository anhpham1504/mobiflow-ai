import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInternalNoteSchema, internalNoteQuerySchema, internalNoteResponseSchema } from '@mobiflow/contracts';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';
import { InternalNoteService } from '../dist/requests/internal-note.service.js';
import { pagination, page } from '../dist/requests/request-query.service.js';
import { validateRecommendationEvidenceOutput } from '../dist/ai/recommendation-evidence-decision.js';
import { internalNotesRecommendationFixture } from './helpers/internal-notes-fixture.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const actor = role => ({ id, role, sessionId: id, email: 'synthetic@test.local', displayName: 'Synthetic', active: true, available: true });

const recommendationContext = () => ({
  analysis: { category: 'NETWORK', subcategory: 'IOT_CONNECTIVITY', prioritySuggestion: 'HIGH', missingFields: [] },
  sources: [{ sourceId: 'KD-source-G1-C0', excerpt: 'Synthetic procedure.' }],
  similar: { returnedCount: 0 },
  candidates: { candidates: [{ teamId: id, staffId: id }] },
  policy: { priority: 'HIGH', targetMinutes: 60 },
  requestContext: { id, description: 'Synthetic request.' },
});
const evidenceDecision = (status, sourceIds) => ({
  version: 'recommendation-evidence.v1', maxDistance: 0.5, evidenceStatus: status,
  evidenceReasonCode: status === 'SUFFICIENT' ? 'RELEVANT_PROCEDURE_AVAILABLE' : 'NO_ALLOWED_RELEVANT_PROCEDURE',
  eligibleProcedureSourceIds: sourceIds, selectedProcedureSourceIds: sourceIds,
  missingFields: [], allowedMainActions: ['START_WORK', 'REQUEST_USER_INFO'],
});
const recommendationMessages = (evidence, decision) => [{ content: 'Action=GENERATE_RECOMMENDATION' }, { content: JSON.stringify({ evidence, evidenceDecision: decision }) }];

test('M18 recommendation fixture obeys authoritative sufficient and insufficient evidence decisions', () => {
  const evidence = recommendationContext(), sufficient = evidenceDecision('SUFFICIENT', ['KD-source-G1-C0']);
  const grounded = internalNotesRecommendationFixture(recommendationMessages(evidence, sufficient));
  assert.equal(grounded.evidenceStatus, 'SUFFICIENT');
  assert.deepEqual(grounded.procedureSources, [{ sourceId: 'KD-source-G1-C0' }]);
  assert.doesNotThrow(() => validateRecommendationEvidenceOutput(grounded, sufficient));

  const insufficient = evidenceDecision('INSUFFICIENT_EVIDENCE', []);
  const abstained = internalNotesRecommendationFixture(recommendationMessages(evidence, insufficient));
  assert.equal(abstained.evidenceStatus, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(abstained.procedureSources, []);
  assert.deepEqual(abstained.suggestedChecklist, []);
  assert.doesNotThrow(() => validateRecommendationEvidenceOutput(abstained, insufficient));
  assert.throws(() => validateRecommendationEvidenceOutput(grounded, insufficient), error => error.code === 'INVALID_REFERENCE' && error.repairFeedback.startsWith('EVIDENCE_DECISION_MISMATCH:'));
});

test('M18 body trims, rejects blanks and unknown fields, and retains literal Vietnamese/emoji/newlines/HTML', () => {
  const body = 'Đã kiểm tra gateway 🙂\n<img src=x onerror=alert(1)>\n<script>alert(1)</script> @staff';
  assert.equal(createInternalNoteSchema.parse({ body: '  ' + body + '\n ' }).body, body);
  for (const input of [{}, { body: '' }, { body: ' \t\r\n\u00a0 ' }, { body: 'a'.repeat(4001) }, { body: 1 }, { body: null }]) assert.equal(createInternalNoteSchema.safeParse(input).success, false);
  for (const field of ['authorId', 'role', 'requestId', 'createdAt', 'visibility', 'expectedVersion', 'mentions', 'attachments']) assert.equal(createInternalNoteSchema.safeParse({ body: 'Hợp lệ', [field]: id }).success, false);
  assert.equal(createInternalNoteSchema.parse({ body: 'đ'.repeat(4000) }).body.length, 4000);
  assert.equal(createInternalNoteSchema.parse({ body: '🙂'.repeat(4000) }).body.length, 8000);
  assert.equal(createInternalNoteSchema.safeParse({ body: '🙂'.repeat(4001) }).success, false);
});

test('M18 query retains existing 20/100 keyset bounds and accepts only limit/cursor', () => {
  assert.equal(pagination(internalNoteQuerySchema.parse({})).limit, 20);
  assert.equal(pagination(internalNoteQuerySchema.parse({ limit: '100' })).limit, 100);
  for (const input of [{ limit: '0' }, { limit: '101' }, { limit: '-1' }, { limit: '1.5' }, { limit: 20 }, { cursor: 'a'.repeat(501) }, { role: 'MANAGER' }, { assigneeId: id }, { status: 'CLOSED' }]) assert.equal(internalNoteQuerySchema.safeParse(input).success, false);
  assert.throws(() => pagination({ cursor: 'invalid' }), error => error.code === 'INVALID_CURSOR' && error.getStatus() === 400);
  const createdAt = new Date('2026-10-02T01:00:00.000Z');
  const result = page([{ id, createdAt }, { id: '22222222-2222-4222-8222-222222222222', createdAt }], 1);
  assert.equal(result.data.length, 1); assert.equal(result.page.hasMore, true);
  assert.deepEqual(pagination({ cursor: result.page.nextCursor }).where, { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] });
  assert.equal(page([{ id, createdAt }], 1).page.nextCursor, null);
});

test('M18 centralized scope forbids USER and preserves STAFF assignment / MANAGER A01', () => {
  const policy = new AuthorizationPolicyService();
  assert.throws(() => policy.internalNoteScope(actor('USER')), error => error.getStatus() === 403);
  assert.deepEqual(policy.internalNoteScope(actor('STAFF')), { currentAssigneeId: id });
  assert.deepEqual(policy.internalNoteScope(actor('MANAGER')), {});
  assert.equal(policy.canReadRequest(actor('STAFF'), { createdById: id, currentAssigneeId: null }), false);
});

test('M18 service denies forbidden role before opening transaction or querying notes', async () => {
  const service = new InternalNoteService({ $transaction: () => { throw new Error('must not query'); } }, new AuthorizationPolicyService());
  await assert.rejects(service.list(id, actor('USER'), {}), error => error.getStatus() === 403);
  await assert.rejects(service.create(id, actor('USER'), { body: 'Ghi chú' }, id), error => error.getStatus() === 403);
});

test('M18 service checks scoped parent before notes, applies keyset and emits safe child audit atomically', async () => {
  const calls = [], note = { id, requestId: id, body: 'Ghi chú riêng', createdAt: new Date(), author: { id, displayName: 'Synthetic' }, mentions: [] };
  const tx = {
    $queryRaw: async sql => {
      calls.push(sql.sql);
      if (sql.sql.includes('FROM "Request"')) return [{ id, status: 'RESOLVED', createdById: id, currentAssigneeId: id }];
      if (sql.sql.includes('clock_timestamp')) return [{ now: note.createdAt }];
      return [];
    },
    user: { findUnique: async () => ({ id, role: 'STAFF', active: true }) },
    refreshSession: { findFirst: async () => ({ id }) },
    requestInternalNote: {
      create: async input => { calls.push(input); return note; },
      findMany: async input => { calls.push(input); return [note]; },
    }, auditLog: { create: async input => { calls.push(input); return { id }; } },
    requestWatcher: { findMany: async () => [] },
  };
  const service = new InternalNoteService({ $transaction: work => work(tx) }, new AuthorizationPolicyService());
  assert.deepEqual(await service.create(id, actor('STAFF'), { body: note.body }, id), note);
  const audit = calls.find(value => value.data?.action === 'INTERNAL_NOTE_CREATED').data;
  assert.equal(audit.requestId, undefined);
  assert.deepEqual(audit.safeAfterJson, { noteId: id, requestId: id, authorId: id });
  assert.equal(JSON.stringify(audit).includes(note.body), false);
  calls.length = 0;
  assert.equal((await service.list(id, actor('STAFF'), { limit: '1' })).data.length, 1);
  const query = calls.find(value => value.take);
  assert.equal(query.take, 2); assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  const parentIndex = calls.findIndex(value => typeof value === 'string' && value.includes('FROM "Request"'));
  assert.ok(parentIndex >= 0 && parentIndex < calls.indexOf(query));
  tx.$queryRaw = async () => [];
  tx.requestInternalNote.findMany = async () => { throw new Error('foreign notes must not load'); };
  await assert.rejects(service.list(id, actor('STAFF'), {}), error => error.getStatus() === 404);
});

test('M18 strict note responses exclude extra author credentials and metadata', () => {
  const data = { id, requestId: id, body: 'Ghi chú', createdAt: '2026-10-02T01:00:00.000Z', author: { id, displayName: 'Synthetic' } };
  assert.equal(internalNoteResponseSchema.safeParse({ data, requestId: id }).success, true);
  for (const field of ['email', 'passwordHash', 'sessionId', 'role']) assert.equal(internalNoteResponseSchema.safeParse({ data: { ...data, author: { ...data.author, [field]: 'secret' } }, requestId: id }).success, false);
  assert.equal(internalNoteResponseSchema.safeParse({ data: { ...data, visibility: 'INTERNAL' }, requestId: id }).success, false);
});
