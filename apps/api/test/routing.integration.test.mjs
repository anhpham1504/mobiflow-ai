import assert from 'node:assert/strict';
import { test, before, after, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { routingDetailResponseSchema, routingListResponseSchema, routingHistoryResponseSchema, routingEvaluationResponseSchema, routingTargetsResponseSchema } from '@mobiflow/contracts';
import { createRoutingHarness, workflowSnapshot } from './helpers/routing-fixture.mjs';
import { RoutingService } from '../dist/routing/routing.service.js';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';
import { TemplateService } from '../dist/templates/template.service.js';

let s, service, owner, targets;
const report = { checkedAt: new Date().toISOString(), synthetic: true, database: 'mobiflow_m21_test', checks: {}, performance: {} };
const pass = name => { report.checks[name] = 'PASS'; };
const expected = rule => ({ expectedRevision: rule.currentRevision, expectedRuleVersion: rule.version });
const input = (change = {}) => ({ name: 'Synthetic routing ' + randomUUID(), priority: 10, target: { type: 'TEAM', id: targets[0].id }, conditions: [{ field: 'priority', operator: 'EQ', values: ['MEDIUM'] }], ...change });
async function fixture(change = {}, active = true) { let rule = await service.create(s.manager.actor, input(change), randomUUID()); if (active) rule = await service.lifecycle(rule.id, s.manager.actor, expected(rule), 'ACTIVE', randomUUID()); return rule; }
async function evaluate(id) { const result = await s.call(s.manager.token, '/requests/' + id + '/routing/evaluate', {}); assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.headers.get('cache-control'), 'no-store'); return routingEvaluationResponseSchema.parse(result.body).data; }
const definitionOf = rule => ({ name: rule.current.name, ...(rule.current.description ? { description: rule.current.description } : {}), priority: rule.current.priority, target: rule.current.target, conditions: rule.current.conditions });
async function state(id) { return { workflow: await workflowSnapshot(s.prisma, id), audits: await s.prisma.auditLog.findMany({ where: { requestId: id }, orderBy: { id: 'asc' } }), allNotifications: await s.prisma.notification.count(), notes: await s.prisma.requestInternalNote.findMany({ where: { requestId: id }, orderBy: { id: 'asc' } }), aiRuns: await s.prisma.aiRun.findMany({ where: { requestId: id }, orderBy: { id: 'asc' } }) }; }

before(async () => {
  if (!process.env.M21_DATABASE_URL) throw new Error('Run isolated test:integration:m21');
  s = await createRoutingHarness(process.env.M21_DATABASE_URL); service = s.app.get(RoutingService);
  owner = new Client({ connectionString: process.env.M21_OWNER_DATABASE_URL }); await owner.connect();
  targets = await service.targets(s.manager.actor, {}); assert.ok(targets.length >= 2);
});
beforeEach(async () => { for (const rule of await s.prisma.routingRule.findMany({ where: { status: 'ACTIVE' } })) await service.lifecycle(rule.id, s.manager.actor, expected(rule), 'INACTIVE', randomUUID()); });
after(async () => {
  if (s) { report.rateWaitsSeconds = s.rateWaitsSeconds; report.aiCalls = Object.values(s.captured).reduce((n, calls) => n + calls.length, 0); await s.close(); }
  if (owner) await owner.end(); mkdirSync('artifacts/m21', { recursive: true }); writeFileSync('artifacts/m21/api-report.json', JSON.stringify(report, null, 2) + '\n');
});

test('M21 real HTTP denies all USER/STAFF routing surfaces and preserves A01 scope', async () => {
  const rule = await fixture(), request = await s.create('rbac');
  const reads = ['/routing-rules', '/routing-rules/targets', '/routing-rules/' + rule.id, '/routing-rules/' + rule.id + '/revisions'];
  const writes = [['/routing-rules', input()], ['/routing-rules/' + rule.id + '/revisions', { ...input(), ...expected(rule) }], ...['activate','deactivate','archive'].map(command => ['/routing-rules/' + rule.id + '/' + command, expected(rule)]), ['/requests/' + request.id + '/routing/evaluate', {}]];
  for (const role of [s.user, s.staff]) { for (const path of reads) assert.equal((await s.call(role.token, path)).status, 403); for (const [path, body] of writes) assert.equal((await s.call(role.token, path, body)).status, 403); }
  assert.equal((await s.call(null, '/routing-rules')).status, 401);
  assert.equal((await s.call(s.manager.token, '/routing-rules/' + randomUUID())).status, 404);
  assert.equal((await s.call(s.manager.token, '/requests/' + randomUUID() + '/routing/evaluate', {})).status, 404);
  assert.equal((await s.call(s.manager.token, '/routing-rules/' + rule.id, {}, 'DELETE')).status, 404);
  const policy = new AuthorizationPolicyService(); policy.requestScope = () => ({ createdById: randomUUID() });
  await assert.rejects(new RoutingService(s.prisma, policy).evaluate(request.id, s.manager.actor, {}), error => error.getStatus() === 404);
  pass('RBAC / absent and scoped request IDOR / A01 policy reuse / no delete');
});
test('M21 strict input and injection/media/origin/unknown query negatives', async () => {
  const request = await s.create('validation');
  for (const change of [{ createdById: s.manager.actor.id }, { revision: 2 }, { autoAssign: true }, { expectedVersion: 1 }, { isFallback: true }, { conditions: [] }, { role: 'MANAGER' }, { conditions: [{ field: '__proto__', operator: 'EQ', values: ['HIGH'] }] }, { conditions: [{ field: 'priority', operator: 'SQL', values: ['DROP TABLE'] }] }]) assert.equal((await s.call(s.manager.token, '/routing-rules', input(change))).status, 400);
  for (const query of ['limit=51','status=DELETED','role=MANAGER','cursor=invalid']) assert.equal((await s.call(s.manager.token, '/routing-rules?' + query)).status, 400);
  for (const body of [{ priority: 'URGENT' }, { requestFacts: {} }, { execute: true }, { authorizationScope: 'all' }]) assert.equal((await s.call(s.manager.token, '/requests/' + request.id + '/routing/evaluate', body)).status, 400);
  assert.equal((await s.call(s.manager.token, '/requests/' + request.id + '/routing/evaluate?priority=HIGH', {})).status, 400);
  assert.equal((await s.call(s.manager.token, '/routing-rules', input(), 'POST', { Origin: 'http://invalid.local' })).status, 403);
  assert.equal((await s.call(s.manager.token, '/routing-rules', input(), 'POST', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await s.call(s.manager.token, '/routing-rules', input({ name: 'a'.repeat(70000) }))).status, 413);
  assert.equal((await s.call(s.manager.token, '/routing-rules', '{invalid')).status, 400);
  pass('Strict JSON/query / injection / fact overrides / origin / media / size');
});
test('M21 manager create/revise/lifecycle/history/pagination with safe audit', async () => {
  const response = await s.call(s.manager.token, '/routing-rules', input({ name: 'M21 lifecycle', description: '<script>inert()</script>' }));
  assert.equal(response.status, 201, JSON.stringify(response.body)); let rule = routingDetailResponseSchema.parse(response.body).data;
  assert.equal(rule.currentRevision, 1); assert.equal(rule.version, 1); assert.equal(rule.status, 'INACTIVE');
  const original = rule.current;
  let revised = await s.call(s.manager.token, '/routing-rules/' + rule.id + '/revisions', { ...input({ name: 'M21 lifecycle revision2' }), ...expected(rule) });
  assert.equal(revised.status, 201); rule = routingDetailResponseSchema.parse(revised.body).data; assert.equal(rule.currentRevision, 2);
  for (const [command, status] of [['activate','ACTIVE'],['deactivate','INACTIVE'],['activate','ACTIVE'],['archive','ARCHIVED']]) {
    const result = await s.call(s.manager.token, '/routing-rules/' + rule.id + '/' + command, expected(rule)); assert.equal(result.status, 200); rule = routingDetailResponseSchema.parse(result.body).data; assert.equal(rule.status, status);
  }
  assert.equal((await s.call(s.manager.token, '/routing-rules/' + rule.id + '/activate', expected(rule))).status, 409);
  assert.equal((await s.call(s.manager.token, '/routing-rules/' + rule.id + '/revisions', { ...input(), ...expected(rule) })).status, 409);
  const first = await s.call(s.manager.token, '/routing-rules/' + rule.id + '/revisions?limit=1'); const h = routingHistoryResponseSchema.parse(first.body); assert.equal(h.data[0].revision, 2); assert.equal(h.page.hasMore, true);
  const second = routingHistoryResponseSchema.parse((await s.call(s.manager.token, '/routing-rules/' + rule.id + '/revisions?limit=1&cursor=' + encodeURIComponent(h.page.nextCursor))).body); assert.deepEqual(second.data[0], original);
  const list = await s.call(s.manager.token, '/routing-rules?status=ARCHIVED&q=M21%20lifecycle&limit=1'); assert.equal(list.headers.get('cache-control'), 'no-store'); assert.equal(routingListResponseSchema.parse(list.body).data[0].id, rule.id);
  assert.ok(routingTargetsResponseSchema.parse((await s.call(s.manager.token, '/routing-rules/targets')).body).data.every(target => target.eligible));
  const audits = await s.prisma.auditLog.findMany({ where: { resourceType: 'RoutingRule', resourceId: rule.id } }); assert.equal(audits.length, 6);
  for (const audit of audits) { assert.equal(audit.requestId, null); assert.deepEqual(Object.keys(audit.safeAfterJson).sort(), ['priority','revision','ruleId','version']); }
  pass('Manager CRUD lifecycle / immutable paginated history / search / targets / safe atomic audit');
});
test('M21 concurrent revisions and lifecycle races return one success and one409', async () => {
  let rule = await fixture({}, false);
  const before = await s.prisma.routingRuleRevision.count({ where: { ruleId: rule.id } });
  const responses = await Promise.all([1,2].map(n => s.call(s.manager.token, '/routing-rules/' + rule.id + '/revisions', { ...input({ name: 'Concurrent ' + n }), ...expected(rule) })));
  assert.deepEqual(responses.map(r => r.status).sort(), [201,409]); assert.equal(await s.prisma.routingRuleRevision.count({ where: { ruleId: rule.id } }), before + 1);
  rule = (await service.detail(rule.id, s.manager.actor));
  const race = await Promise.all(['activate','archive'].map(action => s.call(s.manager.token, '/routing-rules/' + rule.id + '/' + action, expected(rule)))); assert.deepEqual(race.map(r => r.status).sort(), [200,409]);
  rule = await fixture();
  const mix = await Promise.all([s.call(s.manager.token, '/routing-rules/' + rule.id + '/revisions', { ...input(), ...expected(rule) }), s.call(s.manager.token, '/routing-rules/' + rule.id + '/archive', expected(rule))]);
  assert.equal(mix.filter(r => [200,201].includes(r.status)).length, 1); assert.equal(mix.filter(r => r.status === 409).length, 1);
  const stale = await fixture(), inactive = await service.lifecycle(stale.id, s.manager.actor, expected(stale), 'INACTIVE', randomUUID());
  await service.lifecycle(stale.id, s.manager.actor, expected(inactive), 'ACTIVE', randomUUID());
  const unchanged = await service.detail(stale.id, s.manager.actor);
  await assert.rejects(service.revise(stale.id, s.manager.actor, { ...input(), ...expected(stale) }, randomUUID()), e => e.getStatus() === 409); assert.deepEqual(await service.detail(stale.id, s.manager.actor), unchanged);
  pass('Two writers / activate-archive / revise-archive / lifecycle ABA staleness');
});
test('M21 authoritative facts, explicit no-match, priority, same-target ties and conflict are read-only', async () => {
  const request = await s.create('facts'), before = await state(request.id);
  const empty = await evaluate(request.id); assert.equal(empty.status, 'NO_MATCH'); assert.deepEqual(empty.facts, { category: null, subcategory: null, priority: 'MEDIUM' });
  await fixture({ conditions: [{ field: 'category', operator: 'EQ', values: ['NETWORK'] }] }); assert.equal((await evaluate(request.id)).status, 'NO_MATCH');
  const top = await fixture(), same = await fixture();
  let result = await evaluate(request.id); assert.equal(result.status, 'MATCH'); assert.equal(result.ruleRevisions.length, 2);
  const lower = await fixture({ priority: 20, target: { type: 'TEAM', id: targets[1].id } }); result = await evaluate(request.id); assert.equal(result.suggestedTarget.id, targets[0].id);
  await service.revise(lower.id, s.manager.actor, { ...definitionOf(lower), priority: 10, ...expected(lower) }, randomUUID());
  result = await evaluate(request.id); assert.equal(result.status, 'CONFLICT'); assert.equal(result.suggestedTarget, null);
  assert.ok(result.ruleRevisions.some(rule => rule.ruleId === top.id)); assert.ok(result.ruleRevisions.some(rule => rule.ruleId === same.id));
  assert.deepEqual(await state(request.id), before);
  pass('Authoritative null facts / MATCH / NO_MATCH / tie / CONFLICT / priority / all workflow tables unchanged');
});
test('M21 target creation/activation/current eligibility never silently redirects', async () => {
  const request = await s.create('target'), rule = await fixture();
  assert.equal((await s.call(s.manager.token, '/routing-rules', input({ target: { type: 'TEAM', id: randomUUID() } }))).status, 422);
  await fixture({ priority: 20, target: { type: 'TEAM', id: targets[1].id } });
  await owner.query('UPDATE "Team" SET active=false WHERE id=$1', [targets[0].id]);
  try {
    const result = await evaluate(request.id); assert.equal(result.status, 'NO_MATCH'); assert.equal(result.diagnostic, 'INVALID_TARGET'); assert.equal(result.suggestedTarget, null);
    const inactive = await service.lifecycle(rule.id, s.manager.actor, expected(rule), 'INACTIVE', randomUUID());
    assert.equal((await s.call(s.manager.token, '/routing-rules/' + rule.id + '/activate', expected(inactive))).status, 422);
    assert.equal((await s.call(s.manager.token, '/routing-rules', input())).status, 422);
  } finally { await owner.query('UPDATE "Team" SET active=true WHERE id=$1', [targets[0].id]); }
  await owner.query('UPDATE "TeamMember" SET active=false WHERE "teamId"=$1', [targets[1].id]);
  try { await assert.rejects(service.create(s.manager.actor, input({ target: { type: 'TEAM', id: targets[1].id } }), randomUUID()), e => e.getStatus() === 422); }
  finally { await owner.query('UPDATE "TeamMember" SET active=true WHERE "teamId"=$1', [targets[1].id]); }
  pass('Missing/inactive/empty-eligible target / fail closed without lower-priority redirect');
});
test('M21 request and rule staleness preserve existing protected commands', async () => {
  let request = await s.assign(await s.create('stale'));
  const rule = await fixture({ conditions: [{ field: 'priority', operator: 'EQ', values: ['HIGH'] }] });
  const prior = await evaluate(request.id); assert.equal(prior.requestVersion, request.version);
  await service.revise(rule.id, s.manager.actor, { ...definitionOf(rule), priority: 5, ...expected(rule) }, randomUUID());
  const next = await evaluate(request.id); assert.notDeepEqual(next.evaluatedRevisions, prior.evaluatedRevisions); assert.equal(next.requestVersion, prior.requestVersion);
  request = await s.command(s.manager, '/requests/' + request.id + '/messages', { expectedVersion: request.version, body: 'Concurrent legitimate update' }, 201);
  const before = await state(request.id);
  const rejected = await s.call(s.manager.token, '/manager/requests/' + request.id + '/reassign', { expectedVersion: prior.requestVersion, teamId: s.decision.teamId, staffId: s.otherStaff.actor.id, reason: 'Stale operation' });
  assert.equal(rejected.status, 409); assert.equal(rejected.body.error.code, 'STALE_VERSION'); assert.deepEqual(await state(request.id), before);
  pass('Stale rule snapshot detectable / stale expectedVersion409 / no partial protected writes');
});
test('M21 human override, explicit assignment, M19 dedup and M20/M18 isolation', async () => {
  let request = await s.create('human'); await fixture();
  const managerRow = await s.prisma.user.findUniqueOrThrow({ where: { id: s.manager.actor.id } });
  const watcherId = randomUUID(); await s.prisma.user.create({ data: { id: watcherId, email: 'm21.watcher@mobiflow.local', displayName: 'Synthetic watcher', passwordHash: managerRow.passwordHash, role: 'MANAGER' } });
  const watcher = await s.login('m21.watcher@mobiflow.local'); assert.equal((await s.call(watcher.token, '/requests/' + request.id + '/watch', {}, 'PUT')).status, 200);
  assert.equal((await s.call(s.manager.token, '/requests/' + request.id + '/internal-notes', { body: 'Private synthetic note; never routing facts', mentionedUserIds: [] })).status, 201);
  const templates = s.app.get(TemplateService), template = await templates.create(s.manager.actor, { type: 'CHECKLIST', name: 'Independent checklist', content: { items: [{ text: 'Human checkpoint', required: false }] } }, randomUUID());
  const before = await state(request.id), suggestion = await evaluate(request.id); assert.equal(suggestion.status, 'MATCH'); assert.deepEqual(await state(request.id), before);
  const otherTeam = targets.find(target => target.id !== suggestion.suggestedTarget.id); const member = await s.prisma.teamMember.findFirstOrThrow({ where: { teamId: otherTeam.id, active: true, user: { active: true, available: true, role: 'STAFF' } } });
  const decision = { ...s.decision, teamId: otherTeam.id, staffId: member.userId, actions: [{ text: 'Human checkpoint edited', required: false, sourceIds: [], provenance: 'HUMAN' }] };
  request = await s.command(s.manager, '/manager/requests/' + request.id + '/triage', { expectedVersion: request.version, finalDecision: decision, sourceTemplateRevisionId: template.current.id });
  assert.equal(await s.prisma.assignment.count({ where: { requestId: request.id } }), 0);
  request = await s.command(s.manager, '/manager/requests/' + request.id + '/submit-approval', { expectedVersion: request.version, manualDraftRevision: request.manualDraftRevision });
  request = await s.command(s.manager, '/manager/approvals/' + request.id + '/accept', { expectedVersion: request.version, reviewKind: 'MANUAL', manualDraftRevision: request.pendingDraftRevision, acknowledgedMissingFields: [] });
  assert.equal(request.teamId, otherTeam.id); assert.equal(request.currentAssignee.id, member.userId);
  const assignment = await s.prisma.assignment.findFirstOrThrow({ where: { requestId: request.id } });
  const delivered = await s.prisma.notification.findMany({ where: { eventId: assignment.eventId } });
  assert.equal(delivered.filter(n => n.type === 'REQUEST_ASSIGNED').length, 1); assert.equal(delivered.filter(n => n.type === 'REQUEST_WATCH_ACTIVITY' && n.recipientId === watcherId).length, 1);
  assert.equal((await s.prisma.checklist.findUniqueOrThrow({ where: { requestId: request.id } })).sourceTemplateRevisionId, template.current.id);
  const sla = await s.prisma.slaInstance.findUniqueOrThrow({ where: { requestId: request.id } });
  request = await s.command(s.manager, '/manager/requests/' + request.id + '/reassign', { expectedVersion: request.version, teamId: s.decision.teamId, staffId: s.staff.actor.id, reason: 'Human selected reassignment' });
  assert.deepEqual(await s.prisma.slaInstance.findUniqueOrThrow({ where: { requestId: request.id } }), sla);
  for (const path of ['/requests/' + request.id, '/requests/' + request.id + '/history', '/notifications']) {
    const result = await s.call(s.user.token, path); assert.equal(result.status, 200); assert.doesNotMatch(JSON.stringify(result.body), /routingRule|routingSuggestion|ruleRevisions|Private synthetic note|Independent checklist/);
  }
  assert.equal((await s.call(s.user.token, '/requests/' + request.id + '/internal-notes')).status, 403);
  pass('Explicit human assignment / target override / M19 one fan-out / M18 privacy / M20 provenance unchanged / SLA unchanged');
});
test('M21 real row ordering and50-rule bounded SQL/latency measurement', async () => {
  const request = await s.create('performance');
  for (let index = 0; index < 50; index++) await fixture({ name: 'M21 performance ' + index, priority: index % 5 + 1, conditions: Array.from({ length: 10 }, () => ({ field: 'priority', operator: 'IN', values: ['MEDIUM','HIGH'] })) }, index % 3 !== 0);
  const first = await evaluate(request.id);
  // Reorder physical tuples without changing any logical field/ID/version.
  await owner.query('CREATE INDEX m21_test_physical_order ON "RoutingRule"(id DESC)'); await owner.query('CLUSTER "RoutingRule" USING m21_test_physical_order');
  assert.deepEqual(await evaluate(request.id), first); await owner.query('DROP INDEX m21_test_physical_order');
  const latencies = [], samples = [];
  for (let index = 0; index < 5; index++) { const from = s.queries.length, started = performance.now(); assert.deepEqual(await service.evaluate(request.id, s.manager.actor, {}), first); latencies.push(performance.now() - started); samples.push(s.queries.slice(from)); }
  const ruleSql = samples[0].filter(row => row.sql.includes('"RoutingRule"') || row.sql.includes('"RoutingRuleRevision"'));
  assert.ok(ruleSql.length <= 2); assert.ok(samples.every(sample => sample.length === samples[0].length)); assert.ok(samples[0].length <= 12);
  const from = s.queries.length; await service.list(s.manager.actor, { limit: '50', q: 'M21 performance' }); const listQueries = s.queries.slice(from);
  assert.ok(listQueries.length <= 9);
  report.performance = { fixture: { rules: 50, active: 33, inactive: 17, conditionsPerRule: 10 }, activeRuleLoadSql: ruleSql.length, evaluationSql: samples[0].length, ruleListSql: listQueries.length, evaluationSamplesMs: latencies.map(n => Math.round(n * 100) / 100), sqlCountsIncludeTransactionAndIdentity: true, NPlusOne: false, enterpriseSlo: 'NOT CLAIMED' };
  pass('Physical row-order determinism /50x10 mixed rules / batched SQL and actual latency');
});
test('M21 OpenAPI refs/security/operation IDs and zero AI calls', async () => {
  const document = s.document, ids = new Set();
  for (const path of Object.values(document.paths)) for (const operation of Object.values(path)) if (operation && typeof operation === 'object' && operation.operationId) { assert.equal(ids.has(operation.operationId), false); ids.add(operation.operationId); }
  const routes = Object.entries(document.paths).filter(([path]) => path.includes('routing'));
  assert.equal(routes.length, 8);
  for (const [, methods] of routes) for (const method of Object.values(methods)) { assert.ok(method.security.some(value => 'bearer' in value)); assert.ok(method.responses['200'] || method.responses['201']); }
  function refs(value) { if (!value || typeof value !== 'object') return; if (value.$ref) { assert.ok(value.$ref.startsWith('#/')); let target = document; for (const part of value.$ref.slice(2).split('/')) target = target?.[part.replaceAll('~1','/').replaceAll('~0','~')]; assert.ok(target, value.$ref); } for (const child of Object.values(value)) refs(child); } refs(document);
  assert.equal(Object.values(s.captured).reduce((n, calls) => n + calls.length, 0), 0);
  assert.doesNotMatch(JSON.stringify(s.logs), /Private synthetic note|passwordHash|Bearer |postgresql:\/\//);
  pass('Generated OpenAPI refs / unique IDs / bearer / safe logs / zero AI activity');
});

test('M21 failed audit rolls back rule/revision; live identity rechecked in service and API', async () => {
  const counts = async () => [await s.prisma.routingRule.count(), await s.prisma.routingRuleRevision.count(), await s.prisma.auditLog.count({ where: { resourceType: 'RoutingRule' } })];
  const before = await counts();
  await owner.query(`CREATE FUNCTION m21_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='ROUTING_RULE_CREATED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END; $$`);
  await owner.query('CREATE TRIGGER m21_test_audit_failure BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION m21_test_audit_failure()');
  try { assert.equal((await s.call(s.manager.token, '/routing-rules', input())).status, 500); assert.deepEqual(await counts(), before); }
  finally { await owner.query('DROP TRIGGER m21_test_audit_failure ON "AuditLog"'); await owner.query('DROP FUNCTION m21_test_audit_failure()'); }
  const request = await s.create('identity');
  await owner.query('UPDATE "User" SET active=false WHERE id=$1', [s.manager.actor.id]);
  try {
    assert.equal((await s.call(s.manager.token, '/routing-rules')).status, 401);
    await assert.rejects(service.evaluate(request.id, s.manager.actor, {}), e => e.getStatus() === 401);
  } finally { await owner.query('UPDATE "User" SET active=true WHERE id=$1', [s.manager.actor.id]); }
  await owner.query('UPDATE "RefreshSession" SET "revokedAt"=now() WHERE id=$1', [s.manager.actor.sessionId]);
  try { await assert.rejects(service.list(s.manager.actor, {}), e => e.getStatus() === 401); }
  finally { await owner.query('UPDATE "RefreshSession" SET "revokedAt"=NULL WHERE id=$1', [s.manager.actor.sessionId]); }
  pass('Audit failure atomic rollback / live active account and revocable session');
});
