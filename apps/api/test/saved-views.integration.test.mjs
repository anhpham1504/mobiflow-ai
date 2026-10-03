import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Client } from 'pg';
import { setTimeout as delay } from 'node:timers/promises';
import { savedViewResponseSchema, savedViewListSchema, SAVED_REQUEST_VIEW_SCHEMA_VERSION } from '@mobiflow/contracts';
import { createSavedViewsHarness, workflowSnapshot } from './helpers/saved-views-fixture.mjs';
/* global URLSearchParams */
const checks = {}, metrics = {};
let aiCalls = 0;
const endpoint = '/saved-request-views';
const definition = (name = randomUUID(), filters = {}) => ({ name, filters });
async function setup(t) {
  const s = await createSavedViewsHarness(process.env.M23_DATABASE_URL);
  const owner = new Client({ connectionString: process.env.M23_OWNER_DATABASE_URL }); await owner.connect();
  t.after(async () => { aiCalls += Object.values(s.captured).reduce((n, values) => n + values.length, 0); await owner.end(); await s.close(); });
  s.owner = owner;
  s.save = async (actor, input = definition()) => { const r = await s.call(actor.token, endpoint, input); assert.equal(r.status, 201, JSON.stringify(r.body)); return savedViewResponseSchema.parse(r.body).data; };
  s.isolatedActor = async (role = 'STAFF') => {
    const seed = await s.prisma.user.findUniqueOrThrow({ where: { id: s.staff.actor.id } });
    const row = await s.prisma.user.create({ data: { id: randomUUID(), email: randomUUID() + '@synthetic.local', displayName: 'Synthetic M23', passwordHash: seed.passwordHash, role } });
    return s.login(row.email);
  };
  return s;
}
async function waitForOwnerWaiters(owner, count) {
  for (let i = 0; i < 80; i++) {
    await owner.query('SELECT pg_stat_clear_snapshot()');
    const rows = await owner.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM \"User\"%' AND query LIKE '%FOR UPDATE%'");
    if (rows.rows[0].n >= count) return rows.rows[0].n;
    await delay(25);
  }
  throw Error('Concurrent owner-lock waiters were not observed');
}
test('M23 own CRUD, normalization and preference-only atomic audit', async t => {
  const s = await setup(t), request = await s.assign(await s.create()), before = await workflowSnapshot(s.prisma, request.id);
  const v = await s.save(s.staff, definition('  ĐA\u0303 LƯU  ', { status: 'ASSIGNED' }));
  assert.equal(v.name, 'ĐÃ LƯU'); assert.equal(v.version, 1);
  const stored = await s.prisma.savedRequestView.findUniqueOrThrow({ where: { id: v.id } });
  assert.equal(stored.ownerUserId, s.staff.actor.id); assert.equal(stored.normalizedName, 'đã lưu');
  assert.equal(stored.schemaVersion, SAVED_REQUEST_VIEW_SCHEMA_VERSION);
  assert.ok(savedViewListSchema.parse((await s.call(s.staff.token, endpoint)).body).data.some(row => row.id === v.id));
  const updated = await s.call(s.staff.token, endpoint + '/' + v.id, { ...definition('Updated', {}), expectedVersion: 1 }, 'PUT');
  assert.equal(updated.status, 200); assert.equal(updated.body.data.version, 2); assert.deepEqual(updated.body.data.filters, {});
  assert.equal((await s.call(s.staff.token, endpoint + '/' + v.id, { expectedVersion: 1 }, 'DELETE')).status, 409);
  assert.equal((await s.call(s.staff.token, endpoint + '/' + v.id, { expectedVersion: 2 }, 'DELETE')).status, 200);
  assert.equal((await s.call(s.staff.token, endpoint + '/' + v.id)).status, 404);
  assert.deepEqual(await workflowSnapshot(s.prisma, request.id), before);
  const audits = await s.prisma.auditLog.findMany({ where: { resourceType: 'SavedRequestView', resourceId: v.id } });
  assert.equal(audits.length, 3); assert.ok(audits.every(a => a.requestId === null && Object.keys(a.safeAfterJson).sort().join() === 'version,viewId'));
  checks.crudAtomicPreference = 'PASS';
});
test('M23 ownership across all roles, resource hiding and strict request guards', async t => {
  const s = await setup(t), actors = [s.user, s.staff, s.manager], views = await Promise.all(actors.map(a => s.save(a)));
  for (let i = 0; i < actors.length; i++) for (let j = 0; j < actors.length; j++) if (i !== j) {
    for (const [body, method] of [[undefined, 'GET'], [{ ...definition(), expectedVersion: 1 }, 'PUT'], [{ expectedVersion: 1 }, 'DELETE']]) {
      const r = await s.call(actors[i].token, endpoint + '/' + views[j].id, body, method); assert.equal(r.status, 404);
      const missing = await s.call(actors[i].token, endpoint + '/' + randomUUID(), body, method); assert.deepEqual(r.body.error, missing.body.error);
    }
    assert.ok(!(await s.call(actors[i].token, endpoint)).body.data.some(row => row.id === views[j].id));
  }
  assert.equal((await s.call(null, endpoint)).status, 401);
  for (const extra of [{ ownerUserId: s.manager.actor.id }, { schemaVersion: 'forged' }, { role: 'MANAGER' }, { id: randomUUID() }]) assert.equal((await s.call(s.staff.token, endpoint, { ...definition(), ...extra })).status, 400);
  for (const key of ['role', 'where', 'cursor', 'limit', 'createdById', 'search', 'sort', 'bypassScope', 'teamId', 'sla']) assert.equal((await s.call(s.staff.token, endpoint, definition(randomUUID(), { [key]: 'forged' }))).status, 400);
  assert.equal((await s.call(s.staff.token, endpoint + '?ownerUserId=' + s.manager.actor.id)).status, 400);
  assert.equal((await s.call(s.staff.token, endpoint, definition(), 'POST', { Origin: 'https://invalid.example' })).status, 403);
  assert.equal((await s.call(s.staff.token, endpoint, definition(), 'POST', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await s.call(s.staff.token, endpoint, definition('x'.repeat(70000)))).status, 413);
  assert.equal((await s.call(s.staff.token, endpoint)).headers.get('cache-control'), 'no-store');
  assert.ok(s.document.paths['/api/v1/saved-request-views'].get); assert.ok(s.document.paths['/api/v1/saved-request-views/{id}'].delete); assert.ok(s.document.paths['/api/v1/saved-request-views/{id}'].put);
  checks.ownershipGuardsOpenApi = 'PASS';
});
test('M23 normal Request queries independently validate filters and never widen live scope', async t => {
  const s = await setup(t), own = await s.assign(await s.create()), foreign = await s.assign(await s.create());
  await s.prisma.request.update({ where: { id: foreign.id }, data: { currentAssigneeId: s.otherStaff.actor.id } });
  const foreignUser = await s.isolatedActor('USER');
  await s.prisma.request.update({ where: { id: foreign.id }, data: { createdById: foreignUser.actor.id } });
  for (const [actor, route] of [[s.staff, '/staff/work-queue'], [s.user, '/requests/mine'], [s.manager, '/manager/requests']]) {
    const v = await s.save(actor, definition(randomUUID(), { status: 'ASSIGNED', priority: 'HIGH' }));
    const response = await s.call(actor.token, route + '?' + new URLSearchParams(v.filters)); assert.equal(response.status, 200);
    assert.ok(response.body.data.some(r => r.id === own.id));
    assert.equal(response.body.data.some(r => r.id === foreign.id), actor === s.manager);
    for (const query of ['where=all', 'ownerUserId=' + foreignUser.actor.id, 'role=MANAGER', 'priority=HIGH&priority=LOW', 'from=2026-01-01T00:00:00.001Z&to=2026-01-01T00:00:00Z']) assert.equal((await s.call(actor.token, route + '?' + query)).status, 400);
    if (actor !== s.manager) {
      assert.equal((await s.call(actor.token, route + '?assigneeId=' + s.otherStaff.actor.id)).status, 403);
      assert.equal((await s.call(actor.token, endpoint, definition(randomUUID(), { assigneeId: s.otherStaff.actor.id }))).status, 403);
    }
  }
  const managerFilter = await s.save(s.manager, definition(randomUUID(), { assigneeId: s.staff.actor.id }));
  assert.equal((await s.call(s.manager.token, '/manager/requests?assigneeId=' + s.staff.actor.id)).body.data.some(r => r.id === foreign.id), false);
  assert.equal((await s.call(s.manager.token, endpoint, definition(randomUUID(), { assigneeId: randomUUID() }))).status, 422);
  await s.prisma.user.update({ where: { id: s.staff.actor.id }, data: { active: false } });
  try {
    const unavailable = (await s.call(s.manager.token, endpoint + '/' + managerFilter.id)).body.data;
    assert.equal(unavailable.reasonCode, 'REFERENCE_UNAVAILABLE'); assert.equal('filters' in unavailable, false);
    assert.equal((await s.call(s.manager.token, '/manager/requests?assigneeId=' + s.staff.actor.id)).status, 422);
    assert.equal((await s.call(s.staff.token, endpoint)).status, 401);
  } finally { await s.prisma.user.update({ where: { id: s.staff.actor.id }, data: { active: true } }); }
  checks.authorizedCanonicalQueries = 'PASS';
});
test('M23 current role filters metadata, corrupt peers remain isolated and recoverable', async t => {
  const s = await setup(t), actor = await s.isolatedActor('MANAGER');
  const roleView = await s.save(actor, definition('Manager selection', { assigneeId: s.staff.actor.id }));
  const valid = await s.save(actor, definition('Valid', { status: 'ASSIGNED' })), corrupt = await s.save(actor, definition('Corrupt')), future = await s.save(actor, definition('Future'));
  await s.prisma.savedRequestView.update({ where: { id: corrupt.id }, data: { filters: { role: 'MANAGER', privateField: 'must-not-leak' } } });
  await s.prisma.savedRequestView.update({ where: { id: future.id }, data: { schemaVersion: 'future' } });
  await s.prisma.user.update({ where: { id: actor.actor.id }, data: { role: 'STAFF' } });
  const rows = savedViewListSchema.parse((await s.call(actor.token, endpoint)).body).data;
  for (const [id, reason] of [[roleView.id, 'ROLE_INCOMPATIBLE'], [corrupt.id, 'INVALID_FILTERS'], [future.id, 'UNSUPPORTED_VERSION']]) {
    const row = rows.find(r => r.id === id); assert.equal(row.reasonCode, reason); assert.deepEqual(Object.keys(row).sort(), ['availability', 'id', 'name', 'reasonCode', 'version']);
  }
  assert.equal(rows.find(r => r.id === valid.id).availability, 'AVAILABLE');
  assert.equal((await s.call(actor.token, endpoint + '/' + corrupt.id, { expectedVersion: 1 }, 'DELETE')).status, 200);
  const repaired = await s.call(actor.token, endpoint + '/' + roleView.id, { ...definition('Repaired', {}), expectedVersion: 1 }, 'PUT');
  assert.equal(repaired.status, 200); assert.equal(repaired.body.data.availability, 'AVAILABLE');
  // A STAFF-created definition survives a role change only within the new USER ownership predicate.
  const staffActor = await s.isolatedActor('STAFF'), v = await s.save(staffActor, definition('Current scope', { status: 'ASSIGNED' }));
  const request = await s.assign(await s.create()); await s.prisma.request.update({ where: { id: request.id }, data: { currentAssigneeId: staffActor.actor.id } });
  await s.prisma.user.update({ where: { id: staffActor.actor.id }, data: { role: 'USER' } });
  const now = await s.call(staffActor.token, endpoint + '/' + v.id); assert.equal(now.status, 200);
  assert.equal((await s.call(staffActor.token, '/requests/mine?' + new URLSearchParams(now.body.data.filters))).body.data.some(r => r.id === request.id), false);
  checks.corruptAndLiveRole = 'PASS';
});
test('M23 cap49 concurrent distinct creates serializes per owner and never globally', async t => {
  const s = await setup(t), a = await s.isolatedActor(), b = await s.isolatedActor();
  await s.prisma.savedRequestView.createMany({ data: Array.from({ length: 49 }, (_, i) => ({ id: randomUUID(), ownerUserId: a.actor.id, name: 'Cap ' + i, normalizedName: 'cap ' + i, schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION, filters: {} })) });
  await s.owner.query('BEGIN'); await s.owner.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', [a.actor.id]);
  const first = s.call(a.token, endpoint, definition('Distinct A')), second = s.call(a.token, endpoint, definition('Distinct B'));
  let waiters, results;
  try { waiters = await waitForOwnerWaiters(s.owner, 2); assert.equal((await s.call(b.token, endpoint, definition('Independent owner'))).status, 201); }
  finally { await s.owner.query('COMMIT'); results = await Promise.all([first, second]); }
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]); assert.equal(results.find(r => r.status === 409).body.error.code, 'SAVED_VIEW_LIMIT');
  assert.equal(await s.prisma.savedRequestView.count({ where: { ownerUserId: a.actor.id } }), 50);
  metrics.cap = { startingViews: 49, concurrentCreates: 2, blockedWaitersObserved: waiters, successes: 1, finalViews: 50, independentOwnerProgress: true };
  checks.capConcurrency = 'PASS';
});
test('M23 duplicate normalized create/rename and stale edit/delete races are atomic', async t => {
  const s = await setup(t), a = await s.isolatedActor();
  const creates = await Promise.all([' ĐA\u0303 LƯU ', 'đã lưu'].map(name => s.call(a.token, endpoint, definition(name))));
  assert.deepEqual(creates.map(r => r.status).sort(), [201, 409]); assert.equal(creates.find(r => r.status === 409).body.error.code, 'SAVED_VIEW_NAME_CONFLICT');
  const [v, w] = await Promise.all([s.save(a, definition('Edit one')), s.save(a, definition('Edit two'))]);
  const renames = await Promise.all([v, w].map(row => s.call(a.token, endpoint + '/' + row.id, { ...definition('Same rename'), expectedVersion: 1 }, 'PUT')));
  assert.deepEqual(renames.map(r => r.status).sort(), [200, 409]);
  const edited = await s.save(a, definition('Double edit'));
  const edits = await Promise.all(['First', 'Second'].map(name => s.call(a.token, endpoint + '/' + edited.id, { ...definition(name), expectedVersion: 1 }, 'PUT')));
  assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
  const raced = await s.save(a, definition('Edit delete'));
  const race = await Promise.all([s.call(a.token, endpoint + '/' + raced.id, { ...definition('Changed'), expectedVersion: 1 }, 'PUT'), s.call(a.token, endpoint + '/' + raced.id, { expectedVersion: 1 }, 'DELETE')]);
  assert.equal(race.filter(r => r.status === 200).length, 1); assert.ok(race.some(r => [404, 409].includes(r.status)));
  checks.nameAndVersionConcurrency = 'PASS';
});
test('M23 mandatory audit failure rolls back preference and leaves safe errors', async t => {
  const s = await setup(t), a = await s.isolatedActor(), count = await s.prisma.savedRequestView.count({ where: { ownerUserId: a.actor.id } });
  await s.owner.query("CREATE FUNCTION m23_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.\"resourceType\"='SavedRequestView' THEN RAISE EXCEPTION 'M23 private injected error'; END IF; RETURN NEW; END $$");
  await s.owner.query('CREATE TRIGGER m23_fail BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION m23_audit_failure()');
  try { const r = await s.call(a.token, endpoint, definition()); assert.equal(r.status, 500); assert.equal(JSON.stringify(r.body).includes('private injected'), false); assert.equal(await s.prisma.savedRequestView.count({ where: { ownerUserId: a.actor.id } }), count); }
  finally { await s.owner.query('DROP TRIGGER m23_fail ON "AuditLog"'); await s.owner.query('DROP FUNCTION m23_audit_failure()'); }
  assert.equal((await s.call(a.token, endpoint, definition())).status, 201); checks.auditRollback = 'PASS';
});
test('M23 50-view list and real apply query SQL/latency samples have no per-view reads', async t => {
  const s = await setup(t), a = await s.isolatedActor('MANAGER');
  await s.prisma.savedRequestView.createMany({ data: Array.from({ length: 50 }, (_, i) => ({ id: randomUUID(), ownerUserId: a.actor.id, name: 'Measured ' + i, normalizedName: 'measured ' + i, schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION, filters: { status: 'ASSIGNED', assigneeId: s.staff.actor.id } })) });
  const sample = await s.prisma.request.findFirstOrThrow({ where: { currentAssigneeId: s.staff.actor.id } });
  await s.prisma.request.createMany({ data: Array.from({ length: 100 }, (_, i) => ({ id: randomUUID(), publicCode: 'M23-PERF-' + i, title: 'Synthetic measured request ' + i, description: 'Synthetic M23 performance fixture.', createdById: s.user.actor.id, status: 'ASSIGNED', priority: 'HIGH', currentAssigneeId: s.staff.actor.id, teamId: sample.teamId })) });
  const samples = [];
  for (let i = 0; i < 5; i++) {
    let start = s.queries.length; const list = await s.call(a.token, endpoint); assert.equal(list.status, 200); assert.equal(list.body.data.length, 50);
    const listSql = s.queries.slice(start), preferenceSelects = listSql.filter(q => /SELECT/.test(q.sql) && q.sql.includes('SavedRequestView')).length;
    assert.equal(preferenceSelects, 1); assert.ok(listSql.length < 15);
    start = s.queries.length; const applied = await s.call(a.token, '/manager/requests?' + new URLSearchParams(list.body.data[0].filters)); assert.equal(applied.status, 200);
    assert.ok(applied.body.data.every(r => r.currentAssignee.id === s.staff.actor.id && r.status === 'ASSIGNED'));
    samples.push({ listMs: list.latencyMs, listSql: listSql.length, preferenceSelects, applyMs: applied.latencyMs, applySql: s.queries.length - start, resultRows: applied.body.data.length });
  }
  metrics.performance = { savedViews: 50, addedSyntheticRequests: 100, totalRequests: await s.prisma.request.count(), samples, claim: 'Local synthetic samples only; no enterprise SLO' };
  checks.performance = 'PASS';
});
test('M23 authenticated rate limiting respects Retry-After and revoked sessions', async t => {
  const s = await setup(t), a = await s.isolatedActor(), original = Date.now;
  let now = original(); Date.now = () => now;
  try {
    for (let i = 0; i < 120; i++) assert.equal((await s.call(a.token, endpoint, undefined, 'GET', {}, 1)).status, 200);
    const limited = await s.call(a.token, endpoint, undefined, 'GET', {}, 1); assert.equal(limited.status, 429);
    const retry = Number(limited.headers.get('retry-after')); assert.ok(retry > 0 && retry <= 60);
    now += retry * 1000 + 1;
    assert.equal((await s.call(a.token, endpoint, undefined, 'GET', {}, 1)).status, 200);
    await s.prisma.refreshSession.update({ where: { id: a.actor.sessionId }, data: { revokedAt: new Date() } });
    assert.equal((await s.call(a.token, endpoint)).status, 401);
    metrics.rate = { successfulWindowReads: 120, rejectedNextRead: 429, retryAfterSeconds: retry, fakeClockAdvanced: true, revokedSession: 401 };
  } finally { Date.now = original; }
  checks.rateAndRevocation = 'PASS';
});
after(() => { mkdirSync('artifacts/m23', { recursive: true }); writeFileSync('artifacts/m23/api-report.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, metrics, aiCalls, synthetic: true }, null, 2)); });
