import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { internalNoteResponseSchema, mentionCandidateListSchema, watchStateResponseSchema, notificationListSchema } from '@mobiflow/contracts';
import { createMentionsWatchersHarness, workflowSnapshot } from './helpers/mentions-watchers-fixture.mjs';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';
import { notifyCollaboration, WATCH_ACTIONS } from '../dist/requests/collaboration-notifications.js';
import { Prisma } from '../dist/generated/prisma/client.js';
import { AnalysisWorker } from '../dist/ai/analysis-worker.js';
import { RecommendationService } from '../dist/ai/recommendation.service.js';
import { OperationalAiService } from '../dist/ai/operational-ai.service.js';
import { DocumentService } from '../dist/knowledge/document.service.js';
import { IngestionWorker } from '../dist/knowledge/ingestion-worker.js';

test('M19 real PostgreSQL/API: mentions, manual watches, safe delivery, dedup, races and isolation', async t => {
  const s = await createMentionsWatchersHarness(process.env.M19_DATABASE_URL);
  const ownerUrl = new URL(process.env.M19_OWNER_DATABASE_URL);
  assert.equal(ownerUrl.pathname, '/mobiflow_m19_test'); assert.ok(['localhost', '127.0.0.1'].includes(ownerUrl.hostname));
  const owner = new Client({ connectionString: ownerUrl.toString() }); await owner.connect();
  t.after(async () => { await owner.end(); await s.close(); });
  const report = { checkedAt: new Date().toISOString(), synthetic: true, database: 'mobiflow_m19_test', checks: {}, performance: {} };
  const request = await s.assign(await s.create('collaboration'));
  const endpoint = id => '/requests/' + id;
  const createNote = async (actor, id, body, mentionedUserIds) => {
    const response = await s.call(actor.token, endpoint(id) + '/internal-notes', { body, ...(mentionedUserIds === undefined ? {} : { mentionedUserIds }) });
    assert.equal(response.status, 201, JSON.stringify(response.body)); internalNoteResponseSchema.parse(response.body);
    assert.equal(response.headers.get('cache-control'), 'no-store'); return response.body.data;
  };
  const watch = async (actor, id, desired = true) => {
    const response = await s.call(actor.token, endpoint(id) + '/watch', {}, desired ? 'PUT' : 'DELETE');
    assert.equal(response.status, 200, JSON.stringify(response.body)); watchStateResponseSchema.parse(response.body); return response.body.data;
  };
  const notices = async (actor, id) => {
    const response = await s.call(actor.token, '/notifications?limit=100'); assert.equal(response.status, 200, JSON.stringify(response.body)); notificationListSchema.parse(response.body);
    return response.body.data.filter(row => row.requestId === id && ['INTERNAL_NOTE_MENTION', 'REQUEST_WATCH_ACTIVITY'].includes(row.type));
  };
  const internalRows = id => s.prisma.notification.findMany({ where: { requestId: id, type: { in: ['INTERNAL_NOTE_MENTION', 'REQUEST_WATCH_ACTIVITY'] } } });
  const business = async id => { const value = await workflowSnapshot(s.prisma, id); delete value.notification; return value; };
  const managerTemplate = await s.prisma.user.findUniqueOrThrow({ where: { id: s.manager.actor.id } });
  const extraManagers = Array.from({ length: 10 }, (_, index) => ({ id: randomUUID(), email: 'm19.manager.' + index + '@synthetic.local', displayName: index < 2 ? 'Same Display Name' : 'Synthetic Manager ' + index, role: 'MANAGER', active: true, passwordHash: managerTemplate.passwordHash }));
  await s.prisma.user.createMany({ data: extraManagers });
  const inactive = randomUUID(); await s.prisma.user.create({ data: { id: inactive, email: 'm19.inactive@synthetic.local', displayName: 'Synthetic inactive', role: 'MANAGER', active: false, passwordHash: managerTemplate.passwordHash } });
  const privateBody = 'M19_PRIVATE_CANARY_' + randomUUID();

  await t.test('scoped active candidate search, UUID identity for duplicate names, safe DTO and USER/IDOR denial', async () => {
    const response = await s.call(s.manager.token, endpoint(request.id) + '/mention-candidates'); assert.equal(response.status, 200); mentionCandidateListSchema.parse(response.body);
    assert.ok(response.body.data.some(row => row.id === s.staff.actor.id));
    assert.ok(!response.body.data.some(row => [s.manager.actor.id, s.user.actor.id, s.otherStaff.actor.id, inactive].includes(row.id)));
    assert.ok(response.body.data.every(row => Object.keys(row).sort().join(',') === 'displayName,id,role'));
    const duplicates = await s.call(s.staff.token, endpoint(request.id) + '/mention-candidates?q=Same&limit=20'); assert.equal(duplicates.status, 200);
    assert.deepEqual(duplicates.body.data.map(row => row.id).sort(), extraManagers.slice(0, 2).map(row => row.id).sort());
    for (const query of ['?limit=21', '?role=MANAGER', '?q=' + 'x'.repeat(81), '?limit=2&limit=3']) assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/mention-candidates' + query)).status, 400);
    assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/mention-candidates?q=%25%27%20OR%201%3D1--')).body.data.length, 0);
    for (const route of ['/mention-candidates', '/watch', '/internal-notes']) {
      assert.equal((await s.call(s.user.token, endpoint(request.id) + route)).status, 403);
      const foreign = await s.call(s.otherStaff.token, endpoint(request.id) + route), unknown = await s.call(s.otherStaff.token, endpoint(randomUUID()) + route);
      assert.equal(foreign.status, 404); assert.deepEqual(foreign.body.error, unknown.body.error);
    }
    assert.equal((await s.call(null, endpoint(request.id) + '/watch')).status, 401);
    report.checks.candidatesAuthorization = 'PASS';
  });
  await t.test('M18 body-only/Unicode/append-only regression and structured mentions leave Request/history unchanged', async () => {
    const before = await business(request.id);
    const plain = await createNote(s.staff, request.id, privateBody + ' @Demo Manager <img src=x onerror=alert(1)> 🙂');
    assert.deepEqual(plain.mentions, []); assert.equal((await internalRows(request.id)).length, 0);
    const note = await createNote(s.manager, request.id, 'Synthetic selected mention', [s.staff.actor.id, s.staff.actor.id.toUpperCase()]);
    assert.deepEqual(note.mentions, [{ userId: s.staff.actor.id, displayName: 'IoT Specialist' }]);
    assert.equal(await s.prisma.requestInternalNoteMention.count({ where: { noteId: note.id } }), 1);
    const event = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: note.id, action: 'INTERNAL_NOTE_CREATED' } });
    assert.equal(event.requestId, null); assert.deepEqual(event.safeAfterJson, { noteId: note.id, requestId: request.id, authorId: s.manager.actor.id });
    assert.deepEqual(await business(request.id), before);
    assert.equal(JSON.stringify(await s.prisma.notification.findMany({ where: { eventId: event.id } })).includes('Synthetic selected mention'), false);
    for (const method of ['PATCH', 'DELETE']) assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/internal-notes/' + note.id, { body: 'edit' }, method)).status, 404);
    assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/internal-notes', { body: '🙂'.repeat(4001) })).status, 400);
    const emoji = await createNote(s.staff, request.id, '🙂'.repeat(4000)); assert.equal(Array.from(emoji.body).length, 4000);
    report.checks.m18TargetedRegression = 'PASS';
  });
  await t.test('all invalid/inactive/foreign/USER/self/overlimit targets rollback uniformly and duplicates normalize', async () => {
    const before = { notes: await s.prisma.requestInternalNote.count(), mentions: await s.prisma.requestInternalNoteMention.count(), audit: await s.prisma.auditLog.count(), notices: await s.prisma.notification.count() };
    for (const id of [s.otherStaff.actor.id, s.user.actor.id, inactive, randomUUID(), s.manager.actor.id]) {
      const response = await s.call(s.manager.token, endpoint(request.id) + '/internal-notes', { body: 'Atomic invalid note', mentionedUserIds: [s.staff.actor.id, id] });
      assert.equal(response.status, 400); assert.equal(response.body.error.code, 'INVALID_MENTION_TARGET');
    }
    for (const input of [{ body: 'Note', mentionedUserIds: ['invalid'] }, { body: 'Note', mentionedUserIds: extraManagers.map(row => row.id).concat(s.staff.actor.id) }, { body: 'Note', authorId: s.staff.actor.id }, { body: 'Note', notificationRecipients: [s.staff.actor.id] }]) assert.equal((await s.call(s.manager.token, endpoint(request.id) + '/internal-notes', input)).status, 400);
    assert.deepEqual({ notes: await s.prisma.requestInternalNote.count(), mentions: await s.prisma.requestInternalNoteMention.count(), audit: await s.prisma.auditLog.count(), notices: await s.prisma.notification.count() }, before);
    const ten = await createNote(s.staff, request.id, 'Ten structured managers', extraManagers.map(row => row.id)); assert.equal(ten.mentions.length, 10);
    report.checks.targetValidationAtomicity = 'PASS';
  });
  await t.test('manual own-watch idempotency and audit without workflow/version effects, terminal reads and strict DTO', async () => {
    const before = await business(request.id);
    assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/watch')).body.data.watching, false);
    await Promise.all([watch(s.staff, request.id), watch(s.staff, request.id)]);
    assert.equal(await s.prisma.requestWatcher.count({ where: { requestId: request.id, userId: s.staff.actor.id } }), 1);
    assert.equal(await s.prisma.auditLog.count({ where: { action: 'REQUEST_WATCH_STARTED', resourceId: request.id + ':' + s.staff.actor.id } }), 1);
    await watch(s.staff, request.id, false); await watch(s.staff, request.id, false);
    assert.equal(await s.prisma.auditLog.count({ where: { action: 'REQUEST_WATCH_STOPPED', resourceId: request.id + ':' + s.staff.actor.id } }), 1);
    assert.deepEqual(await business(request.id), before);
    for (const body of [{ userId: s.manager.actor.id }, { expectedVersion: request.version }, { watching: true }]) assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/watch', body, 'PUT')).status, 400);
    assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/watch?role=MANAGER')).status, 400);
    for (const method of ['PUT', 'DELETE']) assert.equal((await s.call(s.user.token, endpoint(request.id) + '/watch', {}, method)).status, 403);
    const terminal = await s.assign(await s.create('terminal'));
    const canceled = await s.command(s.manager, endpoint(terminal.id) + '/cancel', { expectedVersion: terminal.version, reason: 'Synthetic terminal watch test' });
    await watch(s.staff, canceled.id); await watch(s.staff, canceled.id, false);
    assert.equal((await s.call(s.staff.token, endpoint(canceled.id) + '/internal-notes', { body: 'Terminal note' })).status, 409);
    const cappedUsers = Array.from({ length: 100 }, (_, index) => ({ id: randomUUID(), email: 'm19.bound.' + index + '@synthetic.local', displayName: 'Synthetic historical watcher ' + index, role: 'STAFF', active: false, passwordHash: managerTemplate.passwordHash }));
    await s.prisma.user.createMany({ data: cappedUsers });
    await s.prisma.requestWatcher.createMany({ data: cappedUsers.map(user => ({ requestId: canceled.id, userId: user.id })) });
    const capBefore = await business(canceled.id), auditBefore = await s.prisma.auditLog.count();
    const capped = await s.call(s.staff.token, endpoint(canceled.id) + '/watch', {}, 'PUT'); assert.equal(capped.status, 409); assert.equal(capped.body.error.code, 'WATCH_LIMIT');
    assert.equal(await s.prisma.auditLog.count(), auditBefore); assert.equal(await s.prisma.requestWatcher.count({ where: { requestId: canceled.id } }), 100); assert.deepEqual(await business(canceled.id), capBefore);
    report.checks.watchSemantics = 'PASS';
  });
  await t.test('mention over watch, self suppression, persistent replay and cross-type duplicate protection', async () => {
    await watch(s.manager, request.id); await watch(s.staff, request.id);
    const note = await createNote(s.staff, request.id, privateBody + ' dedup', [s.manager.actor.id]);
    const event = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: note.id } });
    const rows = await s.prisma.notification.findMany({ where: { eventId: event.id } }); assert.equal(rows.length, 1);
    assert.equal(rows[0].recipientId, s.manager.actor.id); assert.equal(rows[0].type, 'INTERNAL_NOTE_MENTION'); assert.equal(rows[0].safeActorMetadataJson.reason, 'MENTION');
    await s.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Request" WHERE id=${request.id}::uuid FOR UPDATE`);
      await notifyCollaboration(tx, new AuthorizationPolicyService(), request, { id: event.id, action: event.action, actorId: s.staff.actor.id, createdAt: event.createdAt, noteId: note.id }, [s.manager.actor.id]);
      await notifyCollaboration(tx, new AuthorizationPolicyService(), request, { id: event.id, action: event.action, actorId: s.staff.actor.id, createdAt: event.createdAt, noteId: note.id }, [s.manager.actor.id]);
    });
    assert.equal(await s.prisma.notification.count({ where: { eventId: event.id } }), 1);
    await assert.rejects(s.prisma.notification.create({ data: { recipientId: s.manager.actor.id, requestId: request.id, eventId: event.id, type: 'REQUEST_WATCH_ACTIVITY', safeActorMetadataJson: { reason: 'WATCH' } } }), error => error.code === 'P2002');
    const literal = await createNote(s.manager, request.id, '@IoT Specialist plain text');
    const literalEvent = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: literal.id } });
    const literalNotice = await s.prisma.notification.findMany({ where: { eventId: literalEvent.id } }); assert.equal(literalNotice.length, 1); assert.equal(literalNotice[0].type, 'REQUEST_WATCH_ACTIVITY');
    report.checks.dedupRetry = 'PASS';
  });
  await t.test('scope loss hides old mention/watch rows before pagination/unread/read-state and stops new fan-out', async () => {
    const historical = (await notices(s.staff, request.id))[0]; assert.ok(historical);
    const current = await s.prisma.request.findUniqueOrThrow({ where: { id: request.id } });
    await s.command(s.manager, '/manager/requests/' + request.id + '/reassign', { expectedVersion: current.version, staffId: s.otherStaff.actor.id, teamId: s.decision.teamId, reason: 'Synthetic M19 access loss' });
    assert.equal(await s.prisma.requestWatcher.count({ where: { requestId: request.id, userId: s.staff.actor.id } }), 1);
    assert.equal((await notices(s.staff, request.id)).length, 0);
    const unread = await s.call(s.staff.token, '/notifications?unreadOnly=true&limit=1'); assert.equal(unread.status, 200); assert.ok(unread.body.data.every(row => row.id !== historical.id));
    const read = await s.call(s.staff.token, '/notifications/' + historical.id + '/read', { read: true }, 'PATCH'); assert.equal(read.status, 404);
    assert.equal((await s.prisma.notification.findUniqueOrThrow({ where: { id: historical.id } })).readAt, null);
    const newNote = await createNote(s.manager, request.id, 'After reassignment private note');
    const event = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: newNote.id } }); assert.equal(await s.prisma.notification.count({ where: { eventId: event.id, recipientId: s.staff.actor.id } }), 0);
    for (const route of ['/internal-notes', '/watch', '/mention-candidates']) assert.equal((await s.call(s.staff.token, endpoint(request.id) + route)).status, 404);
    assert.equal((await s.call(s.manager.token, endpoint(request.id) + '/internal-notes', { body: 'Stale target', mentionedUserIds: [s.staff.actor.id] })).status, 400);
    report.checks.accessLoss = 'PASS';
  });
  await t.test('account loss revalidates stale candidates and delivered notifications', async () => {
    const target = extraManagers[0];
    const targetActor = await s.login(target.email);
    const note = await createNote(s.otherStaff, request.id, 'Account-change fixture', [target.id]);
    await s.prisma.user.update({ where: { id: target.id }, data: { active: false } });
    assert.equal((await s.call(s.otherStaff.token, endpoint(request.id) + '/internal-notes', { body: 'Invalid cached candidate', mentionedUserIds: [target.id] })).status, 400);
    assert.equal((await s.call(s.otherStaff.token, endpoint(request.id) + '/mention-candidates?q=Same')).body.data.some(row => row.id === target.id), false);
    const scoped = new AuthorizationPolicyService().notificationScope({ id: target.id, role: 'MANAGER' });
    assert.equal(await s.prisma.notification.count({ where: scoped }), 0); assert.equal(await s.prisma.requestInternalNoteMention.count({ where: { noteId: note.id } }), 1);
    for (const route of ['/notifications?unreadOnly=true', endpoint(request.id) + '/watch', endpoint(request.id) + '/mention-candidates']) assert.equal((await s.call(targetActor.token, route)).status, 401);
    await s.prisma.user.update({ where: { id: target.id }, data: { active: true } });
    await s.prisma.user.update({ where: { id: target.id }, data: { role: 'USER' } });
    const downgraded = await s.call(targetActor.token, '/notifications?unreadOnly=true'); assert.equal(downgraded.status, 200); assert.ok(downgraded.body.data.every(row => !['INTERNAL_NOTE_MENTION', 'REQUEST_WATCH_ACTIVITY'].includes(row.type)));
    assert.equal((await s.call(s.otherStaff.token, endpoint(request.id) + '/internal-notes', { body: 'Stale role target', mentionedUserIds: [target.id] })).status, 400);
    await s.prisma.user.update({ where: { id: target.id }, data: { role: 'MANAGER' } });
    await s.prisma.refreshSession.update({ where: { id: targetActor.actor.sessionId }, data: { revokedAt: new Date() } });
    assert.equal((await s.call(targetActor.token, endpoint(request.id) + '/watch', {}, 'PUT')).status, 401);
    report.checks.accountLoss = 'PASS';
  });
  await t.test('actor reassignment race denies queued note/watch; target scope is checked at submit', async () => {
    const fixture = await s.assign(await s.create('race'));
    await owner.query('BEGIN'); await owner.query('SELECT id FROM "Request" WHERE id=$1 FOR UPDATE', [fixture.id]);
    const pendingNote = s.call(s.staff.token, endpoint(fixture.id) + '/internal-notes', { body: 'Rejected raced private note', mentionedUserIds: [s.manager.actor.id] });
    const pendingWatch = s.call(s.staff.token, endpoint(fixture.id) + '/watch', {}, 'PUT');
    await delay(180); await owner.query('UPDATE "Request" SET "currentAssigneeId"=$2 WHERE id=$1', [fixture.id, s.otherStaff.actor.id]); await owner.query('COMMIT');
    assert.equal((await pendingNote).status, 404); assert.equal((await pendingWatch).status, 404);
    assert.equal(await s.prisma.requestInternalNote.count({ where: { requestId: fixture.id } }), 0);
    assert.equal(await s.prisma.requestWatcher.count({ where: { requestId: fixture.id } }), 0);
    assert.equal((await s.call(s.manager.token, endpoint(fixture.id) + '/internal-notes', { body: 'Stale selected staff', mentionedUserIds: [s.staff.actor.id] })).status, 400);
    report.checks.assignmentRace = 'PASS';
  });
  await t.test('internal notification failure rolls back note/mentions/audit and watch audit failure rolls back subscription', async () => {
    const fixture = await s.assign(await s.create('rollback'));
    const counts = async () => ({ note: await s.prisma.requestInternalNote.count(), mention: await s.prisma.requestInternalNoteMention.count(), audit: await s.prisma.auditLog.count(), notification: await s.prisma.notification.count(), watch: await s.prisma.requestWatcher.count() });
    const before = await counts();
    await owner.query("CREATE FUNCTION m19_reject_internal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type IN ('INTERNAL_NOTE_MENTION','REQUEST_WATCH_ACTIVITY') THEN RAISE EXCEPTION 'synthetic M19 failure'; END IF; RETURN NEW; END $$");
    await owner.query('CREATE TRIGGER m19_reject_internal BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION m19_reject_internal()');
    try { const result = await s.call(s.manager.token, endpoint(fixture.id) + '/internal-notes', { body: privateBody + ' rollback', mentionedUserIds: [s.staff.actor.id] }); assert.equal(result.status, 500); assert.equal(JSON.stringify(result.body).includes('synthetic M19 failure'), false); assert.deepEqual(await counts(), before); }
    finally { await owner.query('DROP TRIGGER m19_reject_internal ON "Notification"'); await owner.query('DROP FUNCTION m19_reject_internal()'); }
    await owner.query("CREATE FUNCTION m19_reject_watch_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='REQUEST_WATCH_STARTED' THEN RAISE EXCEPTION 'synthetic watch audit failure'; END IF; RETURN NEW; END $$");
    await owner.query('CREATE TRIGGER m19_reject_watch_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION m19_reject_watch_audit()');
    try { assert.equal((await s.call(s.staff.token, endpoint(fixture.id) + '/watch', {}, 'PUT')).status, 500); assert.deepEqual(await counts(), before); }
    finally { await owner.query('DROP TRIGGER m19_reject_watch_audit ON "AuditLog"'); await owner.query('DROP FUNCTION m19_reject_watch_audit()'); }
    report.checks.rollback = 'PASS';
  });
  await t.test('all persisted allowed workflow events fan out once, omit self/nonwatcher/USER/stale and exclude nonallowlisted events', async () => {
    const fixture = await s.assign(await s.create('events'));
    const observer = extraManagers[2], nonwatcher = extraManagers[3];
    await s.prisma.requestWatcher.createMany({ data: [observer.id, s.staff.actor.id, s.otherStaff.actor.id, s.user.actor.id].map(userId => ({ requestId: fixture.id, userId })) });
    const actions = [];
    const step = async (actor, action, extra = {}) => {
      const current = await s.prisma.request.findUniqueOrThrow({ where: { id: fixture.id } });
      await s.machine.transition(fixture.id, action, actor.actor, { expectedVersion: current.version, ...extra }, randomUUID());
      const event = await s.prisma.auditLog.findFirstOrThrow({ where: { requestId: fixture.id, action }, orderBy: { createdAt: 'desc' } });
      const rows = await s.prisma.notification.findMany({ where: { eventId: event.id, type: 'REQUEST_WATCH_ACTIVITY' } });
      assert.equal(rows.filter(row => row.recipientId === observer.id).length, WATCH_ACTIONS.includes(action) ? 1 : 0, action);
      assert.equal(rows.filter(row => [actor.actor.id, s.user.actor.id, nonwatcher.id].includes(row.recipientId)).length, 0);
      const updated = await s.prisma.request.findUniqueOrThrow({ where: { id: fixture.id } });
      assert.equal(rows.filter(row => row.recipientId === (updated.currentAssigneeId === s.staff.actor.id ? s.otherStaff.actor.id : s.staff.actor.id)).length, 0);
      actions.push(action);
    };
    await step(s.staff, 'START_WORK'); await step(s.staff, 'REQUEST_USER_INFO', { body: 'Synthetic information request' }); await step(s.user, 'USER_PROVIDE_INFO', { body: 'Synthetic information reply' });
    await step(s.staff, 'RESOLVE', { rootCause: 'Synthetic diagnosed root cause.', resolution: 'Synthetic correction completed.', verification: 'Synthetic verification completed.' });
    await step(s.user, 'USER_REOPEN', { reason: 'Synthetic reopen reason.' });
    await step(s.manager, 'REASSIGN', { teamId: s.decision.teamId, staffId: s.otherStaff.actor.id, reason: 'Synthetic reassignment.' });
    await step(s.otherStaff, 'RESOLVE', { rootCause: 'Synthetic diagnosed root cause.', resolution: 'Synthetic correction completed.', verification: 'Synthetic verification completed.' });
    await step(s.user, 'USER_CONFIRM'); await watch(s.otherStaff, fixture.id); await watch(s.otherStaff, fixture.id, false);
    const canceled = await s.assign(await s.create('cancel-event'));
    await s.prisma.requestWatcher.create({ data: { requestId: canceled.id, userId: observer.id } });
    await s.machine.transition(canceled.id, 'CANCEL', s.manager.actor, { expectedVersion: canceled.version, reason: 'Synthetic cancellation.' }, randomUUID());
    assert.equal((await internalRows(canceled.id)).filter(row => row.recipientId === observer.id).length, 1); actions.push('CANCEL');
    const pending = await s.create('approval-events'); await s.prisma.requestWatcher.create({ data: { requestId: pending.id, userId: observer.id } });
    let current = await s.command(s.manager, '/manager/requests/' + pending.id + '/triage', { expectedVersion: pending.version, finalDecision: s.decision });
    assert.equal((await internalRows(pending.id)).length, 0);
    current = await s.command(s.manager, '/manager/requests/' + pending.id + '/submit-approval', { expectedVersion: current.version, manualDraftRevision: current.manualDraftRevision });
    current = await s.command(s.manager, '/manager/approvals/' + pending.id + '/reject', { expectedVersion: current.version, reviewKind: 'MANUAL', manualDraftRevision: current.pendingDraftRevision, reason: 'Synthetic rejected draft.' });
    current = await s.command(s.manager, '/manager/requests/' + pending.id + '/triage', { expectedVersion: current.version, finalDecision: s.decision });
    current = await s.command(s.manager, '/manager/requests/' + pending.id + '/submit-approval', { expectedVersion: current.version, manualDraftRevision: current.manualDraftRevision });
    await s.command(s.manager, '/manager/approvals/' + pending.id + '/accept', { expectedVersion: current.version, reviewKind: 'MANUAL', manualDraftRevision: current.pendingDraftRevision, acknowledgedMissingFields: [] });
    assert.equal((await internalRows(pending.id)).filter(row => row.recipientId === observer.id).length, 4); actions.push('SUBMIT_FOR_APPROVAL', 'REJECT_APPROVAL', 'APPROVE_AND_ASSIGN');
    assert.deepEqual([...new Set(actions)].sort(), WATCH_ACTIONS.filter(action => action !== 'INTERNAL_NOTE_CREATED').slice().sort());
    report.checks.workflowAllowlist = 'PASS';
  });
  await t.test('USER detail/history/dashboard/notification/explanation and analytics never reveal collaboration, logs no body', async () => {
    for (const path of [endpoint(request.id), endpoint(request.id) + '/history?limit=100', '/dashboard/user', '/notifications?limit=100', endpoint(request.id) + '/ai/explanation']) {
      const response = await s.call(s.user.token, path); assert.equal(response.status, 200);
      const data = JSON.stringify(response.body); assert.equal(data.includes(privateBody), false);
      assert.equal(/INTERNAL_NOTE|REQUEST_WATCH|mentionedUser|mentionId|watcherId|watcherCount/.test(data), false, path);
    }
    const normalized = body => { const value = JSON.parse(JSON.stringify(body.data)); for (const key of ['period', 'overview', 'ai']) delete value[key].asOf; return value; };
    const before = normalized((await s.call(s.manager.token, '/analytics?from=2026-10-01&to=2026-10-04')).body);
    await createNote(s.otherStaff, request.id, 'Synthetic analytics-isolated collaboration', [s.manager.actor.id]);
    assert.deepEqual(normalized((await s.call(s.manager.token, '/analytics?from=2026-10-01&to=2026-10-04')).body), before);
    assert.equal(JSON.stringify(s.logs).includes(privateBody), false);
    report.checks.userAnalyticsLogsIsolation = 'PASS';
  });
  await t.test('existing recipient ownership/read-unread notification regression remains intact', async () => {
    const row = await s.prisma.notification.findFirstOrThrow({ where: { requestId: request.id, type: 'REQUEST_ASSIGNED', recipientId: s.staff.actor.id } });
    assert.equal((await s.call(s.otherStaff.token, '/notifications/' + row.id + '/read', { read: true }, 'PATCH')).status, 404);
    for (const read of [true, true, false, false]) { const result = await s.call(s.staff.token, '/notifications/' + row.id + '/read', { read }, 'PATCH'); assert.equal(result.status, 200); assert.equal(Boolean(result.body.data.readAt), read); assert.equal('safeActorMetadataJson' in result.body.data, false); }
    assert.equal((await s.call(s.user.token, '/notifications/' + row.id + '/read', { read: true }, 'PATCH')).status, 404);
    report.checks.notificationRegression = 'PASS';
  });
  await t.test('real deterministic intake/RAG/embedding/Recommendation V2/Copilot builders exclude all collaboration metadata', async () => {
    let fixture = await s.create('ai-context');
    await watch(s.manager, fixture.id);
    const canary = await createNote(s.manager, fixture.id, privateBody + ' AI context isolation', [extraManagers[9].id]);
    const audit = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: canary.id } });
    const watchAudit = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: fixture.id + ':' + s.manager.actor.id } });
    const run = await s.machine.scheduleAnalysis(fixture.id, s.manager.actor, fixture.version, false, randomUUID());
    await s.app.get(AnalysisWorker).tick(); assert.equal((await s.prisma.aiRun.findUniqueOrThrow({ where: { id: run.id } })).status, 'SUCCEEDED');
    fixture = await s.prisma.request.findUniqueOrThrow({ where: { id: fixture.id } });
    const docs = s.app.get(DocumentService);
    for (const doc of await s.prisma.knowledgeDocument.findMany({ where: { status: { not: 'DISABLED' } } })) await docs.command(doc.id, s.manager.actor, doc.version, 'disable', randomUUID(), 'Isolate deterministic M19 context fixture');
    const buffer = Buffer.from('# Synthetic M19 SOP\nKiểm tra SIM và cấu hình APN cho thiết bị IoT mất kết nối tại Amata. Dữ liệu synthetic dùng kiểm tra context.');
    const doc = await docs.upload(s.manager.actor, { title: 'Synthetic M19 SOP' }, { originalname: 'm19.txt', mimetype: 'text/plain', buffer, size: buffer.length }, randomUUID());
    await s.app.get(IngestionWorker).tick(); assert.equal((await docs.detail(doc.id, s.manager.actor)).status, 'READY');
    const recommendations = s.app.get(RecommendationService), recommendation = await recommendations.schedule(fixture.id, s.manager.actor, fixture.version, randomUUID());
    await recommendations.cycle(AbortSignal.timeout(30000)); assert.equal((await s.prisma.aiRun.findUniqueOrThrow({ where: { id: recommendation.id } })).status, 'SUCCEEDED');
    const assigned = await s.assign(fixture), operations = s.app.get(OperationalAiService);
    const copilot = await operations.scheduleCopilot(assigned.id, s.staff.actor, { expectedVersion: assigned.version, action: 'SUMMARIZE_REQUEST' }, randomUUID());
    for (let i = 0; i < 6 && ['QUEUED', 'RUNNING'].includes((await s.prisma.aiRun.findUniqueOrThrow({ where: { id: copilot.id } })).status); i++) await operations.cycle(AbortSignal.timeout(30000));
    assert.equal((await s.prisma.aiRun.findUniqueOrThrow({ where: { id: copilot.id } })).status, 'SUCCEEDED');
    assert.ok(s.captured.intake.length && s.captured.embedding.length && s.captured.structured.some(rows => rows[0].content.includes('Action=SUMMARIZE_REQUEST')) && s.captured.structured.some(rows => rows[1].content.includes('evidence')));
    for (const value of [privateBody, canary.id, audit.id, watchAudit.id, extraManagers[9].id, 'RequestInternalNote', 'RequestWatcher', 'INTERNAL_NOTE_CREATED', 'REQUEST_WATCH_STARTED']) assert.equal(JSON.stringify(s.captured).includes(value), false, 'Private collaboration entered AI context');
    report.checks.aiContextIsolation = 'PASS';
  });
  await t.test('50 notes, multiple mentions and10 watchers use bounded SQL/fan-out with local latency samples', async () => {
    const fixture = await s.assign(await s.create('performance'));
    await s.prisma.requestWatcher.create({ data: { requestId: fixture.id, userId: s.manager.actor.id } });
    s.queries.length = 0; await createNote(s.staff, fixture.id, 'Single watcher sample', [s.manager.actor.id]); const oneFanout = [...s.queries];
    s.queries.length = 0; const singleList = await s.call(s.staff.token, endpoint(fixture.id) + '/internal-notes?limit=100'); const oneList = [...s.queries]; assert.equal(singleList.body.data.length, 1);
    await s.prisma.requestWatcher.createMany({ data: extraManagers.slice(0, 9).map(row => ({ requestId: fixture.id, userId: row.id })) });
    const noteRows = Array.from({ length: 48 }, (_, i) => ({ id: randomUUID(), requestId: fixture.id, authorId: s.staff.actor.id, body: 'Synthetic performance ' + i, createdAt: new Date('2026-10-02T01:00:00.000Z') }));
    await s.prisma.requestInternalNote.createMany({ data: noteRows });
    await s.prisma.requestInternalNoteMention.createMany({ data: noteRows.flatMap(row => extraManagers.slice(0, 2).map(user => ({ noteId: row.id, mentionedUserId: user.id }))) });
    s.queries.length = 0; const note = await createNote(s.staff, fixture.id, 'Ten watcher measured sample', [s.manager.actor.id]); const tenFanout = [...s.queries];
    assert.equal(tenFanout.length, oneFanout.length, 'Recipient query count must not grow with watcher count');
    const event = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: note.id } }); assert.equal(await s.prisma.notification.count({ where: { eventId: event.id } }), 10);
    s.queries.length = 0; const fifty = await s.call(s.staff.token, endpoint(fixture.id) + '/internal-notes?limit=100'); const fiftyList = [...s.queries]; assert.equal(fifty.body.data.length, 50); assert.equal(fiftyList.length, oneList.length);
    const samples = []; for (let i = 0; i < 3; i++) samples.push((await s.call(s.staff.token, endpoint(fixture.id) + '/internal-notes?limit=50')).latencyMs);
    report.performance = { fixture: { notes: 50, mentionsPerBulkNote: 2, watchers: 10 }, noteListSql: { one: oneList.length, fifty: fiftyList.length }, fanoutSql: { one: oneFanout.length, ten: tenFanout.length }, visibleNotificationsForMeasuredEvent: 10, apiSamplesMs: samples, nPlusOne: false, limitations: 'Local synthetic single-server samples; no enterprise SLO claim' };
    report.checks.performance = 'PASS';
  });
  const openapi = s.document;
  for (const route of ['/api/v1/requests/{id}/mention-candidates', '/api/v1/requests/{id}/watch', '/api/v1/requests/{id}/internal-notes']) assert.ok(openapi.paths[route], route);
  const operations = Object.values(openapi.paths).flatMap(path => Object.values(path).filter(value => value.operationId)); assert.equal(new Set(operations.map(op => op.operationId)).size, operations.length);
  const refs = []; function visit(value) { if (!value || typeof value !== 'object') return; if (value.$ref) refs.push(value.$ref); for (const child of Object.values(value)) visit(child); } visit(openapi);
  for (const ref of refs) assert.ok(ref.split('/').slice(1).reduce((value, key) => value?.[key], openapi), 'Broken reference: ' + ref);
  report.checks.openapi = 'PASS';
  mkdirSync('artifacts/m19', { recursive: true }); writeFileSync('artifacts/m19/api-report.json', JSON.stringify(report, null, 2) + '\n');
});
