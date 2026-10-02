import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { internalNoteResponseSchema, internalNoteListSchema } from '@mobiflow/contracts';
import { createInternalNotesHarness, workflowSnapshot } from './helpers/internal-notes-fixture.mjs';
import { AnalysisWorker } from '../dist/ai/analysis-worker.js';
import { RecommendationService } from '../dist/ai/recommendation.service.js';
import { OperationalAiService } from '../dist/ai/operational-ai.service.js';
import { DocumentService } from '../dist/knowledge/document.service.js';
import { IngestionWorker } from '../dist/knowledge/ingestion-worker.js';

test('M18 real PostgreSQL / HTTP: immutable private notes, scope, lifecycle races, leakage, context isolation and bounded queries', async t => {
  const s = await createInternalNotesHarness(process.env.M18_DATABASE_URL);
  const owner = new Client({ connectionString: process.env.M18_OWNER_DATABASE_URL }); await owner.connect();
  t.after(async () => { await owner.end(); await s.close(); });
  const report = { checkedAt: new Date().toISOString(), synthetic: true, database: 'mobiflow_m18_test', checks: {}, performance: {} };
  const endpoint = id => '/requests/' + id + '/internal-notes';
  const note = async (actor, id, body) => {
    const result = await s.call(actor.token, endpoint(id), { body }); assert.equal(result.status, 201, JSON.stringify(result.body)); internalNoteResponseSchema.parse(result.body); assert.equal(result.headers.get('cache-control'), 'no-store'); return result.body.data;
  };
  const privateBody = 'Gateway nghi lỗi firmware nội bộ. M18_CANARY_' + randomUUID();
  const request = await s.assign(await s.create('privacy'));
  const oldWorkflow = await workflowSnapshot(s.prisma, request.id);

  await t.test('STAFF and MANAGER create, safe author, no workflow side effects, private resource-only audit', async () => {
    const staffNote = await note(s.staff, request.id, ' \n' + privateBody + '\n🙂 Đã kiểm tra log.\n ');
    const managerNote = await note(s.manager, request.id, 'Ưu tiên kiểm tra APN. @staff vẫn là văn bản thuần.');
    assert.equal(staffNote.author.id, s.staff.actor.id); assert.equal(managerNote.author.id, s.manager.actor.id);
    assert.deepEqual(Object.keys(staffNote.author).sort(), ['displayName', 'id']);
    assert.equal(staffNote.body, privateBody + '\n🙂 Đã kiểm tra log.');
    assert.deepEqual(await workflowSnapshot(s.prisma, request.id), oldWorkflow);
    const audits = await s.prisma.auditLog.findMany({ where: { action: 'INTERNAL_NOTE_CREATED', resourceId: { in: [staffNote.id, managerNote.id] } } });
    assert.equal(audits.length, 2);
    for (const audit of audits) { assert.equal(audit.requestId, null); assert.equal(audit.reason, null); assert.deepEqual(Object.keys(audit.safeAfterJson).sort(), ['authorId', 'noteId', 'requestId']); }
    assert.equal(JSON.stringify(audits).includes(privateBody), false);
    report.noteIds = [staffNote.id, managerNote.id]; report.checks.creationAuditWorkflow = 'PASS';
  });

  await t.test('direct HTTP role denial, guessed IDs, STAFF IDOR, A01 MANAGER scope, malformed input and safe transport', async () => {
    const unknown = randomUUID();
    for (const id of [request.id, unknown]) for (const body of [undefined, { body: 'Ghi chú bị cấm' }]) assert.equal((await s.call(s.user.token, endpoint(id), body)).status, 403);
    assert.equal((await s.call(null, endpoint(request.id))).status, 401);
    assert.equal((await s.call(null, endpoint(request.id), { body: 'No identity' })).status, 401);
    const foreign = await s.call(s.otherStaff.token, endpoint(request.id)), absent = await s.call(s.otherStaff.token, endpoint(unknown));
    assert.equal(foreign.status, 404); assert.deepEqual(foreign.body.error, absent.body.error);
    assert.equal((await s.call(s.otherStaff.token, endpoint(request.id), { body: 'Forbidden' })).status, 404);
    assert.equal((await s.call(s.manager.token, endpoint(unknown))).status, 404);
    const newRequest = await s.create('unassigned');
    assert.equal((await s.call(s.staff.token, endpoint(newRequest.id))).status, 404);
    await note(s.manager, newRequest.id, 'Ghi chú quản lý trên yêu cầu chưa phân công.');
    for (const body of ['', ' \t\n\u00a0', 'đ'.repeat(4001), '🙂'.repeat(4001)]) assert.equal((await s.call(s.staff.token, endpoint(request.id), { body })).status, 400);
    for (const field of ['authorId', 'role', 'requestId', 'createdAt', 'visibility', 'expectedVersion', 'mentions']) assert.equal((await s.call(s.staff.token, endpoint(request.id), { body: 'Text', [field]: unknown })).status, 400);
    for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'cursor=invalid', 'assigneeId=' + s.staff.actor.id, 'role=MANAGER', 'body=probe', 'limit=1&limit=2']) assert.equal((await s.call(s.staff.token, endpoint(request.id) + '?' + query)).status, 400);
    assert.equal((await s.call(s.staff.token, '/requests/not-a-uuid/internal-notes')).status, 400);
    assert.equal((await s.call(s.staff.token, endpoint(request.id), 'x'.repeat(65537))).status, 413);
    assert.equal((await s.call(s.staff.token, endpoint(request.id), { body: 'Text' }, 'POST', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await s.call(s.staff.token, endpoint(request.id), { body: 'Text' }, 'POST', { Origin: 'https://untrusted.invalid' })).status, 403);
    for (const method of ['PATCH', 'DELETE']) assert.equal((await s.call(s.staff.token, endpoint(request.id) + '/' + report.noteIds[0], { body: 'change' }, method)).status, 404);
    const html = '<img src=x onerror=alert(1)>\n<script>alert(1)</script>\nTiếng Việt 🙂';
    assert.equal((await note(s.manager, request.id, html)).body, html);
    assert.equal(Array.from((await note(s.manager, request.id, '🙂'.repeat(4000))).body).length, 4000);
    report.checks.directHttpSecurity = 'PASS';
  });

  await t.test('USER detail/list/history/dashboard/notifications/explanation and analytics contain no note content/activity/count', async () => {
    for (const path of ['/requests/' + request.id, '/requests/mine', '/requests/' + request.id + '/history?limit=100', '/dashboard/user', '/notifications', '/requests/' + request.id + '/ai/explanation']) {
      const response = await s.call(s.user.token, path); assert.equal(response.status, 200, path + ': ' + JSON.stringify(response.body));
      const payload = JSON.stringify(response.body); assert.equal(payload.includes(privateBody), false); assert.equal(payload.includes('INTERNAL_NOTE_CREATED'), false);
      assert.equal(/internalNotes|internalNoteCount|RequestInternalNote/.test(payload), false);
      for (const id of report.noteIds) assert.equal(payload.includes(id), false);
    }
    const analytics = await s.call(s.manager.token, '/analytics?from=2026-10-01&to=2026-10-04'); assert.equal(analytics.status, 200);
    const metrics = data => { const result = JSON.parse(JSON.stringify(data)); for (const key of ['period', 'overview', 'ai']) delete result[key].asOf; return result; };
    const metricBefore = metrics(analytics.body.data);
    await note(s.manager, request.id, 'CANARY_ANALYTICS_' + randomUUID());
    assert.deepEqual(metrics((await s.call(s.manager.token, '/analytics?from=2026-10-01&to=2026-10-04')).body.data), metricBefore);
    assert.equal(JSON.stringify(s.logs).includes(privateBody), false);
    assert.deepEqual(await workflowSnapshot(s.prisma, request.id), oldWorkflow);
    report.checks.userHistoryNotificationsAnalyticsLogs = 'PASS';
  });

  await t.test('deterministic newest-first ties/cursor, 1 vs 50 note author batching and local API samples', async () => {
    const fixture = await s.assign(await s.create('pagination'));
    await note(s.staff, fixture.id, 'M18 one-note performance fixture');
    s.queries.length = 0;
    const one = await s.call(s.staff.token, endpoint(fixture.id)); assert.equal(one.status, 200);
    const oneQueries = [...s.queries];
    const at = new Date('2026-10-02T01:00:00.000Z');
    const rows = Array.from({ length: 49 }, (_, i) => ({ id: randomUUID(), requestId: fixture.id, authorId: i % 2 ? s.manager.actor.id : s.staff.actor.id, body: 'Synthetic M18 pagination ' + i, createdAt: at }));
    await s.prisma.requestInternalNote.createMany({ data: rows });
    s.queries.length = 0;
    const fifty = await s.call(s.staff.token, endpoint(fixture.id) + '?limit=50'); assert.equal(fifty.status, 200);
    const fiftyQueries = [...s.queries]; internalNoteListSchema.parse(fifty.body); assert.equal(fifty.body.data.length, 50);
    assert.equal(fiftyQueries.length, oneQueries.length, 'Author SQL count must be bounded independently of row count');
    assert.ok(fiftyQueries.filter(query => query.sql.includes('"User"')).length <= oneQueries.filter(query => query.sql.includes('"User"')).length);
    const expected = fifty.body.data.map(row => row.id); const seen = [];
    let cursor, pages = 0;
    do {
      const response = await s.call(s.staff.token, endpoint(fixture.id) + '?limit=7' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
      assert.equal(response.status, 200); internalNoteListSchema.parse(response.body); assert.ok(response.body.data.length <= 7);
      seen.push(...response.body.data.map(row => row.id)); cursor = response.body.page.nextCursor; pages++;
    } while (cursor && pages < 20);
    assert.equal(cursor, null); assert.deepEqual(seen, expected); assert.equal(new Set(seen).size, 50);
    const tieIds = rows.map(row => row.id).sort().reverse(); assert.deepEqual(fifty.body.data.filter(row => row.createdAt === at.toISOString()).map(row => row.id), tieIds);
    const latencies = [];
    for (let i = 0; i < 10; i++) { const sample = await s.call(s.staff.token, endpoint(fixture.id)); assert.equal(sample.status, 200); latencies.push(Number(sample.latencyMs.toFixed(2))); }
    report.performance = { fixtureNotes: 50, authors: 2, pageDefault: 20, pageMaximum: 100, pagesOfSeven: pages, sqlStatementsOneNote: oneQueries.length, sqlStatementsFiftyNotes: fiftyQueries.length, userSelectStatements: fiftyQueries.filter(query => query.sql.includes('"User"')).length, latencySamplesMs: latencies, responseBytesFiftyNotes: Buffer.byteLength(JSON.stringify(fifty.body)), noteQuery: fiftyQueries.filter(query => query.sql.includes('"RequestInternalNote"')).map(query => query.sql), scaleClaim: false };
    report.checks.orderPaginationPerformance = 'PASS';
  });

  await t.test('append-only runtime privileges / FKs / blank constraints / atomic audit rollback', async () => {
    const client = new Client({ connectionString: process.env.M18_DATABASE_URL }); await client.connect();
    try {
      for (const sql of ['UPDATE "RequestInternalNote" SET body=$1 WHERE id=$2', 'DELETE FROM "RequestInternalNote" WHERE body=$1 AND id=$2']) await assert.rejects(client.query(sql, ['Changed', report.noteIds[0]]), error => error.code === '42501');
      await assert.rejects(client.query('TRUNCATE "RequestInternalNote"'), error => error.code === '42501');
      for (const body of ['', ' \t\n']) await assert.rejects(client.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)', [randomUUID(), request.id, s.staff.actor.id, body]), error => error.code === '23514');
      for (const ids of [[randomUUID(), s.staff.actor.id], [request.id, randomUUID()]]) await assert.rejects(client.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)', [randomUUID(), ...ids, 'FK probe']), error => error.code === '23503');
    } finally { await client.end(); }
    const count = await s.prisma.requestInternalNote.count({ where: { requestId: request.id } });
    await owner.query(`CREATE FUNCTION m18_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='INTERNAL_NOTE_CREATED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
    await owner.query('CREATE TRIGGER m18_reject_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION m18_reject_audit()');
    try {
      const failed = await s.call(s.staff.token, endpoint(request.id), { body: 'Rollback only canary' }); assert.equal(failed.status, 500); assert.equal(failed.body.error.code, 'INTERNAL_ERROR'); assert.equal(/Prisma|SQL|stack|synthetic audit failure/.test(JSON.stringify(failed.body)), false);
      assert.equal(await s.prisma.requestInternalNote.count({ where: { requestId: request.id } }), count);
      assert.deepEqual(await workflowSnapshot(s.prisma, request.id), oldWorkflow);
    } finally { await owner.query('DROP TRIGGER m18_reject_audit ON "AuditLog"'); await owner.query('DROP FUNCTION m18_reject_audit()'); }
    report.checks.constraintsImmutabilityAuditRollback = 'PASS';
  });

  await t.test('RESOLVED permits notes; CLOSED/CANCELED read-only; reassignment removes old STAFF access without version bypass', async () => {
    let row = await s.assign(await s.create('terminal'));
    row = await s.command(s.staff, '/requests/' + row.id + '/start', { expectedVersion: row.version });
    row = await s.command(s.staff, '/requests/' + row.id + '/resolve', { expectedVersion: row.version, rootCause: 'Nguyên nhân synthetic đã được xác nhận.', resolution: 'Khắc phục synthetic do nhân viên thực hiện.', verification: 'Kiểm chứng synthetic hoàn thành đầy đủ.' });
    await note(s.staff, row.id, 'Ghi chú sau xử lý, trước xác nhận.');
    row = await s.command(s.user, '/requests/' + row.id + '/confirm', { expectedVersion: row.version });
    for (const actor of [s.staff, s.manager]) { assert.equal((await s.call(actor.token, endpoint(row.id))).status, 200); assert.equal((await s.call(actor.token, endpoint(row.id), { body: 'Closed denial' })).status, 409); }
    let canceled = await s.assign(await s.create('canceled'));
    await note(s.manager, canceled.id, 'Ghi chú trước khi hủy.');
    canceled = await s.command(s.manager, '/requests/' + canceled.id + '/cancel', { expectedVersion: canceled.version, reason: 'Hủy tình huống synthetic.' });
    assert.equal((await s.call(s.staff.token, endpoint(canceled.id))).status, 200);
    assert.equal((await s.call(s.manager.token, endpoint(canceled.id), { body: 'Canceled denial' })).status, 409);
    const snapshot = await workflowSnapshot(s.prisma, request.id);
    await note(s.staff, request.id, 'Note must not invalidate loaded version');
    const reassigned = await s.command(s.manager, '/manager/requests/' + request.id + '/reassign', { expectedVersion: snapshot.request.version, staffId: s.otherStaff.actor.id, teamId: s.decision.teamId, reason: 'Bàn giao synthetic để kiểm tra scope.' });
    assert.equal(reassigned.version, snapshot.request.version + 1);
    assert.equal((await s.call(s.staff.token, endpoint(request.id))).status, 404);
    assert.equal((await s.call(s.staff.token, endpoint(request.id), { body: 'Old assignee denied' })).status, 404);
    assert.equal((await s.call(s.otherStaff.token, endpoint(request.id))).status, 200);
    report.checks.terminalReassignmentVersion = 'PASS';
  });

  await t.test('parent lock rechecks assignment/terminal state and live identity after concurrent change', async () => {
    const race = await s.assign(await s.create('race'));
    // The test owner holds the same parent row lock as the actual state machine.
    await owner.query('BEGIN'); await owner.query('SELECT id FROM "Request" WHERE id=$1 FOR UPDATE', [race.id]);
    const pending = s.call(s.staff.token, endpoint(race.id), { body: 'Must not reach reassigned request' });
    try {
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        // PostgreSQL caches statistics snapshots inside this lock-holder transaction.
        await owner.query('SELECT pg_stat_clear_snapshot()');
        waiting = (await owner.query('SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pg_backend_pid()=ANY(pg_blocking_pids(pid))')).rowCount > 0;
        if (waiting) break; await delay(20);
      }
      assert.equal(waiting, true, 'Observe the actual note operation waiting on the parent lock');
      await owner.query('UPDATE "Request" SET "currentAssigneeId"=$1 WHERE id=$2', [s.otherStaff.actor.id, race.id]); await owner.query('COMMIT');
    } finally { await owner.query('ROLLBACK'); }
    assert.equal((await pending).status, 404); assert.equal(await s.prisma.requestInternalNote.count({ where: { requestId: race.id } }), 0);
    const actorEmail = 'm18.race.' + randomUUID() + '@synthetic.local';
    const template = await s.prisma.user.findUniqueOrThrow({ where: { id: s.manager.actor.id } });
    await s.prisma.user.create({ data: { id: randomUUID(), email: actorEmail, passwordHash: template.passwordHash, displayName: 'Synthetic race manager', role: 'MANAGER' } });
    const actor = await s.login(actorEmail);
    // Unit plus runtime tests cover the guard; direct service call tests its own transactional identity check.
    await s.prisma.refreshSession.update({ where: { id: actor.actor.sessionId }, data: { revokedAt: new Date() } });
    const service = s.app.get((await import('../dist/requests/internal-note.service.js')).InternalNoteService);
    await assert.rejects(service.create(race.id, actor.actor, { body: 'revoked session' }, randomUUID()), error => error.getStatus() === 401);
    assert.equal((await s.call(actor.token, endpoint(race.id))).status, 401);
    await s.prisma.user.update({ where: { id: actor.actor.id }, data: { active: false } });
    assert.equal((await s.call(actor.token, endpoint(race.id), { body: 'inactive denial' })).status, 401);
    report.checks.raceAndLiveIdentity = 'PASS';
  });

  await t.test('actual intake, RAG/embedding, Recommendation V2 and Copilot context builders exclude notes and their audit activity', async () => {
    let aiRequest = await s.create('context');
    const canary = await note(s.manager, aiRequest.id, privateBody + ' AI isolation');
    const audit = await s.prisma.auditLog.findFirstOrThrow({ where: { resourceId: canary.id, action: 'INTERNAL_NOTE_CREATED' } });
    const run = await s.machine.scheduleAnalysis(aiRequest.id, s.manager.actor, aiRequest.version, false, randomUUID());
    await s.app.get(AnalysisWorker).tick();
    assert.equal((await s.prisma.aiRun.findUniqueOrThrow({ where: { id: run.id } })).status, 'SUCCEEDED');
    aiRequest = await s.prisma.request.findUniqueOrThrow({ where: { id: aiRequest.id } });
    const docs = s.app.get(DocumentService);
    for (const doc of await s.prisma.knowledgeDocument.findMany({ where: { status: { not: 'DISABLED' } } })) await docs.command(doc.id, s.manager.actor, doc.version, 'disable', randomUUID(), 'Isolate deterministic M18 context fixture');
    const text = '# Synthetic M18 context SOP\nKiểm tra SIM và cấu hình APN cho thiết bị IoT mất kết nối tại Amata. Chỉ dùng kiểm tra nguồn và cách tạo context, không đo chất lượng model.';
    const buffer = Buffer.from(text);
    const doc = await docs.upload(s.manager.actor, { title: 'Synthetic M18 context SOP' }, { originalname: 'm18.txt', mimetype: 'text/plain', buffer, size: buffer.length }, randomUUID());
    await s.app.get(IngestionWorker).tick(); assert.equal((await docs.detail(doc.id, s.manager.actor)).status, 'READY');
    const recommendations = s.app.get(RecommendationService);
    const recommendation = await recommendations.schedule(aiRequest.id, s.manager.actor, aiRequest.version, randomUUID());
    await recommendations.cycle(AbortSignal.timeout(30000));
    assert.equal((await s.prisma.aiRun.findUniqueOrThrow({ where: { id: recommendation.id } })).status, 'SUCCEEDED');
    // Use the existing explicit manual approval to reach a staff context.
    const assigned = await s.assign(aiRequest);
    const operations = s.app.get(OperationalAiService);
    const copilot = await operations.scheduleCopilot(assigned.id, s.staff.actor, { expectedVersion: assigned.version, action: 'SUMMARIZE_REQUEST' }, randomUUID());
    await operations.cycle(AbortSignal.timeout(30000));
    // A previous RESOLVED fixture may have an earlier queued summary; drain boundedly.
    for (let i = 0; i < 4 && (await s.prisma.aiRun.findUniqueOrThrow({ where: { id: copilot.id } })).status === 'QUEUED'; i++) await operations.cycle(AbortSignal.timeout(30000));
    assert.equal((await s.prisma.aiRun.findUniqueOrThrow({ where: { id: copilot.id } })).status, 'SUCCEEDED');
    assert.ok(s.captured.intake.length > 0 && s.captured.structured.some(messages => messages[0].content.includes('Action=SUMMARIZE_REQUEST')) && s.captured.structured.some(messages => messages[1].content.includes('evidence')) && s.captured.embedding.length > 0);
    const contexts = JSON.stringify(s.captured);
    for (const value of [privateBody, canary.id, audit.id, 'INTERNAL_NOTE_CREATED', 'RequestInternalNote']) assert.equal(contexts.includes(value), false, 'AI context contains private activity');
    report.checks.intakeRagRecommendationCopilotIsolation = 'PASS';
  });

  await t.test('generated OpenAPI operationIds, role/auth/input/page schemas and all local refs', async () => {
    const route = s.document.paths['/api/v1/requests/{id}/internal-notes']; assert.ok(route);
    assert.equal(route.get.operationId, 'listRequestInternalNotes'); assert.equal(route.post.operationId, 'createRequestInternalNote');
    for (const operation of [route.get, route.post]) { assert.ok(operation.security.some(value => 'bearer' in value)); for (const status of ['400', '401', '403', '404', '429', '503']) assert.ok(operation.responses[status]); }
    assert.ok(route.post.responses['409'] && route.post.responses['413'] && route.post.responses['415']);
    assert.deepEqual(route.post.requestBody.content['application/json'].schema.required, ['body']);
    assert.equal(route.post.requestBody.content['application/json'].schema.additionalProperties, false);
    function refs(value) { if (!value || typeof value !== 'object') return; if (value.$ref) { assert.ok(value.$ref.startsWith('#/')); let found = s.document; for (const segment of value.$ref.slice(2).split('/')) found = found?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')]; assert.ok(found, value.$ref); } for (const child of Object.values(value)) refs(child); }
    refs(s.document); report.checks.openApiContracts = 'PASS';
  });
  await t.test('notes persist across an API shutdown/restart and new DB connections', async () => {
    await s.close();
    const restarted = await createInternalNotesHarness(process.env.M18_DATABASE_URL);
    try { const response = await restarted.call(restarted.manager.token, endpoint(request.id)); assert.equal(response.status, 200); for (const id of report.noteIds) assert.ok(response.body.data.some(row => row.id === id)); } finally { await restarted.close(); }
    report.checks.apiRestartPersistence = 'PASS';
  });
  // Only the parent runner can mark the overall gate PASS after node --test exits 0.
  mkdirSync('artifacts/m18', { recursive: true }); writeFileSync('artifacts/m18/api-report.json', JSON.stringify(report, null, 2) + '\n');
});
