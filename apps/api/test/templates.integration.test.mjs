import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { templateListResponseSchema, templateDetailResponseSchema, templateHistoryResponseSchema } from '@mobiflow/contracts';
import { createTemplatesHarness, workflowSnapshot } from './helpers/templates-fixture.mjs';
import { TemplateService } from '../dist/templates/template.service.js';

let s;
const report = { checkedAt: new Date().toISOString(), synthetic: true, database: 'mobiflow_m20_test', checks: {}, performance: {} };
const pass = name => { report.checks[name] = 'PASS'; };
const responseInput = (name = randomUUID()) => ({ type: 'RESPONSE', name: 'Synthetic response ' + name, description: 'Synthetic operational draft', content: { body: 'Chúng tôi đã tiếp nhận và đang kiểm tra. ' + name } });
const checklistInput = (name = randomUUID()) => ({ type: 'CHECKLIST', name: 'Synthetic checklist ' + name, content: { items: [{ text: 'Kiểm tra APN', required: true }, { text: 'Ghi nhận kết quả', required: false }] } });
async function template(input = responseInput()) { const result = await s.call(s.manager.token, '/templates', input); assert.equal(result.status, 201, JSON.stringify(result.body)); return templateDetailResponseSchema.parse(result.body).data; }
async function revise(t, input = responseInput()) { const result = await s.call(s.manager.token, '/templates/' + t.id + '/revisions', { ...input, expectedRevision: t.currentRevision }); assert.equal(result.status, 201, JSON.stringify(result.body)); return templateDetailResponseSchema.parse(result.body).data; }
async function archive(t) { const result = await s.call(s.manager.token, '/templates/' + t.id + '/archive', { expectedRevision: t.currentRevision }); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body.data; }
const detail = async (actor, id) => (await s.call(actor.token, '/requests/' + id)).body.data;
function assertNoTemplateLeak(value, forbiddenIds = []) { const text = JSON.stringify(value); for (const id of forbiddenIds) assert.equal(text.includes(id), false); const visit = object => { if (!object || typeof object !== 'object') return; for (const [key, child] of Object.entries(object)) { assert.doesNotMatch(key, /template|provenance/i); visit(child); } }; visit(value); }

before(async () => { if (!process.env.M20_DATABASE_URL) throw new Error('Run isolated test:integration:m20'); s = await createTemplatesHarness(process.env.M20_DATABASE_URL); });
after(async () => { if (s) { report.rateWaitsSeconds = s.rateWaitsSeconds; await s.close(); } mkdirSync('artifacts/m20', { recursive: true }); writeFileSync('artifacts/m20/api-report.json', JSON.stringify(report, null, 2) + '\n'); });

test('M20 real HTTP role matrix, filters and guessed ID isolation', async () => {
  const response = await template(), checklist = await template(checklistInput()), archived = await template(); await archive(archived);
  for (const path of ['/templates', '/templates/' + response.id, '/templates/' + checklist.id, '/templates/' + archived.id, '/templates/' + response.id + '/revisions']) assert.equal((await s.call(s.user.token, path)).status, 403);
  assert.equal((await s.call(null, '/templates')).status, 401);
  for (const actor of [s.user, s.staff]) for (const [path, body] of [['/templates', responseInput()], ['/templates/' + response.id + '/revisions', { ...responseInput(), expectedRevision: 1 }], ['/templates/' + response.id + '/archive', { expectedRevision: 1 }]]) assert.equal((await s.call(actor.token, path, body)).status, 403);
  const list = await s.call(s.staff.token, '/templates'); assert.equal(list.status, 200); assert.equal(list.headers.get('cache-control'), 'no-store');
  assert.ok(templateListResponseSchema.parse(list.body).data.every(row => row.type === 'RESPONSE' && row.status === 'ACTIVE'));
  for (const path of ['/templates?type=CHECKLIST', '/templates?status=ARCHIVED', '/templates/' + response.id + '/revisions']) assert.equal((await s.call(s.staff.token, path)).status, 403);
  for (const id of [checklist.id, archived.id, randomUUID()]) assert.equal((await s.call(s.staff.token, '/templates/' + id)).status, 404);
  for (const id of [response.id, checklist.id, archived.id]) assert.equal((await s.call(s.manager.token, '/templates/' + id)).status, 200);
  assert.equal((await s.call(s.manager.token, '/templates/' + randomUUID())).status, 404);
  assert.equal((await s.call(s.manager.token, '/templates/' + response.id, undefined, 'DELETE')).status, 404);
  pass('RBAC/IDOR/active filtering/no-store');
});
test('M20 strict JSON/queries/media/origin/size and safe errors', async () => {
  const input = responseInput('validation');
  for (const change of [{ createdById: s.manager.actor.id }, { role: 'MANAGER' }, { status: 'ARCHIVED' }, { revision: 2 }, { organizationId: randomUUID() }, { content: { body: 'Text', html: true } }, { name: ' ' }, { type: 'AI' }, { content: { body: 'a'.repeat(4001) } }]) assert.equal((await s.call(s.manager.token, '/templates', { ...input, ...change })).status, 400);
  for (const q of ['limit=51','limit=0','limit=1.5','type=AI','status=DELETED','role=MANAGER','cursor=invalid']) { const result = await s.call(s.manager.token, '/templates?' + q); assert.equal(result.status, 400); assert.doesNotMatch(JSON.stringify(result.body), /SQL|Prisma|stack|postgresql:|JWT_SECRET/); }
  assert.equal((await s.call(s.manager.token, '/templates', input, 'POST', { Origin: 'http://invalid.local' })).status, 403);
  assert.equal((await s.call(s.manager.token, '/templates', input, 'POST', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await s.call(s.manager.token, '/templates', { ...input, content: { body: 'a'.repeat(70000) } })).status, 413);
  assert.equal((await s.call(s.manager.token, '/templates', '{invalid json')).status, 400);
  pass('validation/safe errors/media/origin/payload');
});
test('M20 immutable revision lifecycle preserves old name/body and exact history; stale writes atomic', async () => {
  const first = await template(responseInput('history-1')), before = await s.prisma.operationalTemplateRevision.findUnique({ where: { id: first.current.id } });
  const second = await revise(first, responseInput('history-2')); assert.equal(second.currentRevision, 2); assert.notEqual(first.current.id, second.current.id);
  const auditBefore = await s.prisma.auditLog.count();
  for (const path of ['revisions','archive']) { const result = await s.call(s.manager.token, '/templates/' + first.id + '/' + path, path === 'archive' ? { expectedRevision: 1 } : { ...responseInput('stale'), expectedRevision: 1 }); assert.equal(result.status, 409); assert.equal(result.body.error.code, 'STALE_TEMPLATE_REVISION'); }
  assert.equal(await s.prisma.auditLog.count(), auditBefore); assert.equal(await s.prisma.operationalTemplateRevision.count({ where: { templateId: first.id } }), 2);
  assert.equal((await s.call(s.manager.token, '/templates/' + first.id + '/revisions', { ...checklistInput(), expectedRevision: 2 })).status, 422);
  await archive(second); assert.equal((await s.call(s.staff.token, '/templates/' + first.id)).status, 404);
  assert.deepEqual(await s.prisma.operationalTemplateRevision.findUnique({ where: { id: first.current.id } }), before);
  const response = await s.call(s.manager.token, '/templates/' + first.id + '/revisions?limit=1'); const history = templateHistoryResponseSchema.parse(response.body); assert.equal(history.data[0].id, second.current.id); assert.equal(history.page.hasMore, true);
  const older = templateHistoryResponseSchema.parse((await s.call(s.manager.token, '/templates/' + first.id + '/revisions?limit=1&cursor=' + encodeURIComponent(history.page.nextCursor))).body); assert.equal(older.data[0].id, first.current.id);
  const safeAudits = await s.prisma.auditLog.findMany({ where: { resourceId: first.id, resourceType: 'OperationalTemplate' } }); assert.deepEqual(safeAudits.map(a => a.action).sort(), ['TEMPLATE_ARCHIVED','TEMPLATE_CREATED','TEMPLATE_REVISED']); assert.ok(safeAudits.every(a => a.requestId === null && !JSON.stringify(a.safeAfterJson).includes('content')));
  pass('immutable revisions/archive/history/stale atomicity');
});
test('M20 simultaneous revision and archive/revise resolve with no duplicate or lost update', async () => {
  let t = await template();
  const revisions = await Promise.all([1, 2].map(i => s.call(s.manager.token, '/templates/' + t.id + '/revisions', { ...responseInput('race-' + i), expectedRevision: 1 })));
  assert.deepEqual(revisions.map(r => r.status).sort(), [201, 409]); assert.equal(await s.prisma.operationalTemplateRevision.count({ where: { templateId: t.id } }), 2);
  t = await template();
  const race = await Promise.all([s.call(s.manager.token, '/templates/' + t.id + '/revisions', { ...responseInput('archive-race'), expectedRevision: 1 }), s.call(s.manager.token, '/templates/' + t.id + '/archive', { expectedRevision: 1 })]);
  assert.equal(race.filter(r => r.status === 409).length, 1); assert.equal(race.filter(r => [200,201].includes(r.status)).length, 1);
  t = await template(); const archives = await Promise.all([1, 2].map(() => s.call(s.manager.token, '/templates/' + t.id + '/archive', { expectedRevision: 1 }))); assert.deepEqual(archives.map(r => r.status).sort(), [200,409]);
  pass('management concurrent revision/archive');
});
test('M20 response preview is read-only; final human-edited message owns content and provenance', async () => {
  const t = await template(), request = await s.assign(await s.create('response-human'));
  assert.equal((await s.call(s.manager.token, '/requests/' + request.id + '/watch', {}, 'PUT')).status, 200);
  const before = await workflowSnapshot(s.prisma, request.id), auditBefore = await s.prisma.auditLog.count();
  assert.equal((await s.call(s.staff.token, '/templates/' + t.id)).status, 200); assert.equal((await s.call(s.staff.token, '/templates?type=RESPONSE')).status, 200);
  assert.deepEqual(await workflowSnapshot(s.prisma, request.id), before); assert.equal(await s.prisma.auditLog.count(), auditBefore);
  const body = 'Đây là phản hồi cuối do nhân viên chỉnh sửa 🙂 <script>literal</script>';
  const sent = await s.command(s.staff, '/requests/' + request.id + '/messages', { expectedVersion: request.version, body, sourceTemplateRevisionId: t.current.id }, 201);
  assert.equal(sent.message.body, body); assert.equal(sent.version, request.version + 1); assert.equal(sent.status, 'ASSIGNED');
  const message = await s.prisma.requestMessage.findUnique({ where: { id: sent.message.id } }); assert.equal(message.sourceTemplateRevisionId, t.current.id);
  const usage = await s.prisma.auditLog.findFirst({ where: { action: 'TEMPLATE_USED', resourceId: message.id } }); assert.equal(usage.requestId, null); assert.equal(usage.safeAfterJson.templateRevisionId, t.current.id); assert.equal(JSON.stringify(usage.safeAfterJson).includes(body), false);
  // M19's frozen allowlist excludes generic MESSAGE; preserve its zero fan-out.
  assert.equal(await s.prisma.notification.count({ where: { requestId: request.id, type: 'REQUEST_WATCH_ACTIVITY' } }), 0);
  await revise(t); assert.equal((await s.prisma.requestMessage.findUnique({ where: { id: message.id } })).sourceTemplateRevisionId, t.current.id);
  const userDetail = await s.call(s.user.token, '/requests/' + request.id), userHistory = await s.call(s.user.token, '/requests/' + request.id + '/history'); assertNoTemplateLeak(userDetail.body, [t.id, t.current.id]); assertNoTemplateLeak(userHistory.body, [t.id, t.current.id]); assert.ok(JSON.stringify(userHistory.body).includes(body));
  assert.equal((await s.call(s.otherStaff.token, '/requests/' + request.id + '/messages', { expectedVersion: sent.version, body, sourceTemplateRevisionId: t.current.id })).status, 404);
  pass('response read-only/human content/provenance/USER isolation/generic message no fanout');
});
test('M20 checklist draft adopts final human items only through versioned triage/submit/approval', async () => {
  const t = await template(checklistInput('human-approved')), request = await s.create('checklist-human');
  const before = await workflowSnapshot(s.prisma, request.id); await s.call(s.manager.token, '/templates/' + t.id); assert.deepEqual(await workflowSnapshot(s.prisma, request.id), before);
  const actions = [{ text: 'Bước do quản lý đã chỉnh sửa', required: false, sourceIds: [], provenance: 'HUMAN' }, { text: 'Bước cuối do quản lý bổ sung', required: true, sourceIds: [], provenance: 'HUMAN' }];
  let row = await s.command(s.manager, '/manager/requests/' + request.id + '/triage', { expectedVersion: request.version, finalDecision: { ...s.decision, actions }, sourceTemplateRevisionId: t.current.id });
  assert.equal(row.manualDraftSourceTemplateRevisionId, t.current.id); assert.equal(await s.prisma.checklist.count({ where: { requestId: request.id } }), 0); assert.equal(row.currentAssignee, null); assert.equal(row.sla, null); assert.equal(row.priority, 'MEDIUM');
  const second = await revise(t, checklistInput('revision2')); await archive(second);
  row = await s.command(s.manager, '/manager/requests/' + request.id + '/submit-approval', { expectedVersion: row.version, manualDraftRevision: row.manualDraftRevision }); assert.equal(await s.prisma.checklist.count({ where: { requestId: request.id } }), 0);
  row = await s.command(s.manager, '/manager/approvals/' + request.id + '/accept', { expectedVersion: row.version, manualDraftRevision: row.pendingDraftRevision, reviewKind: 'MANUAL', acknowledgedMissingFields: [] });
  assert.equal(row.status, 'ASSIGNED'); assert.equal(row.checklist.sourceTemplateRevisionId, t.current.id); assert.deepEqual(row.checklist.items.map(i => ({ text: i.text, required: i.required })), actions.map(i => ({ text: i.text, required: i.required })));
  const saved = await s.prisma.checklist.findUnique({ where: { requestId: request.id }, include: { sourceTemplateRevision: true } }); assert.equal(saved.sourceTemplateRevision.revision, 1); assert.equal(saved.sourceTemplateRevision.name, t.name);
  assertNoTemplateLeak((await s.call(s.user.token, '/requests/' + request.id)).body, [t.id, t.current.id]); assertNoTemplateLeak((await s.call(s.user.token, '/requests/' + request.id + '/history')).body, [t.id, t.current.id]);
  const staffDetail = await detail(s.staff, request.id); assert.equal('sourceTemplateRevisionId' in staffDetail.checklist, false);
  pass('checklist draft/no activation/protected human snapshot/archive history');
});
test('M20 stale Request version after template selection still changes nothing', async () => {
  const t = await template(checklistInput()), request = await s.create('stale-request'); await s.call(s.manager.token, '/templates/' + t.id);
  const updated = await s.command(s.user, '/requests/' + request.id + '/messages', { expectedVersion: request.version, body: 'Thông tin đồng thời hợp lệ.' }, 201);
  let before = await workflowSnapshot(s.prisma, request.id), audits = await s.prisma.auditLog.count();
  const stale = await s.call(s.manager.token, '/manager/requests/' + request.id + '/triage', { expectedVersion: request.version, finalDecision: s.decision, sourceTemplateRevisionId: t.current.id }); assert.equal(stale.status, 409); assert.equal(stale.body.error.code, 'STALE_VERSION'); assert.deepEqual(await workflowSnapshot(s.prisma, request.id), before); assert.equal(await s.prisma.auditLog.count(), audits);
  let row = await s.command(s.manager, '/manager/requests/' + request.id + '/triage', { expectedVersion: updated.version, finalDecision: s.decision, sourceTemplateRevisionId: t.current.id });
  row = await s.command(s.manager, '/manager/requests/' + request.id + '/submit-approval', { expectedVersion: row.version, manualDraftRevision: row.manualDraftRevision });
  await s.command(s.user, '/requests/' + request.id + '/messages', { expectedVersion: row.version, body: 'Thông tin đồng thời trước duyệt.' }, 201);
  before = await workflowSnapshot(s.prisma, request.id); audits = await s.prisma.auditLog.count();
  const approval = await s.call(s.manager.token, '/manager/approvals/' + request.id + '/accept', { expectedVersion: row.version, reviewKind: 'MANUAL', manualDraftRevision: row.pendingDraftRevision, acknowledgedMissingFields: [] }); assert.equal(approval.status, 409); assert.equal(approval.body.error.code, 'STALE_VERSION'); assert.deepEqual(await workflowSnapshot(s.prisma, request.id), before); assert.equal(await s.prisma.auditLog.count(), audits);
  pass('stale expectedVersion triage and approval rollback');
});
test('M20 archived/revised/wrong-type/USER provenance rejects atomically; manual retry succeeds', async () => {
  const t = await template(), checklist = await template(checklistInput()), request = await s.assign(await s.create('source-race')); await archive(t);
  for (const [actor, id, status, code] of [[s.staff, t.current.id, 409, 'TEMPLATE_UNAVAILABLE'], [s.staff, checklist.current.id, 422, 'INVALID_TEMPLATE_SOURCE'], [s.staff, randomUUID(), 422, 'INVALID_TEMPLATE_SOURCE'], [s.user, t.current.id, 403, 'FORBIDDEN']]) {
    const before = await workflowSnapshot(s.prisma, request.id), audit = await s.prisma.auditLog.count();
    const result = await s.call(actor.token, '/requests/' + request.id + '/messages', { expectedVersion: request.version, body: 'Human-edited preserved draft', sourceTemplateRevisionId: id }); assert.equal(result.status, status); assert.equal(result.body.error.code, code); assert.deepEqual(await workflowSnapshot(s.prisma, request.id), before); assert.equal(await s.prisma.auditLog.count(), audit);
  }
  const row = await s.command(s.staff, '/requests/' + request.id + '/messages', { expectedVersion: request.version, body: 'Human-edited preserved draft' }, 201); assert.equal((await s.prisma.requestMessage.findUnique({ where: { id: row.message.id } })).sourceTemplateRevisionId, null);
  const newer = await template(); await revise(newer); assert.equal((await s.call(s.staff.token, '/requests/' + request.id + '/messages', { expectedVersion: row.version, body: 'Not sent', sourceTemplateRevisionId: newer.current.id })).body.error.code, 'TEMPLATE_UNAVAILABLE');
  pass('archive/revision race policy/type/permission/manual fallback');
});
test('M20 existing REQUEST_USER_INFO still pauses SLA/notifies only on explicit final action', async () => {
  const t = await template(), request = await s.assign(await s.create('information-composer'));
  assert.equal((await s.call(s.manager.token, '/requests/' + request.id + '/watch', {}, 'PUT')).status, 200);
  let row = await s.command(s.staff, '/requests/' + request.id + '/start', { expectedVersion: request.version });
  const before = await workflowSnapshot(s.prisma, row.id); await s.call(s.staff.token, '/templates/' + t.id); assert.deepEqual(await workflowSnapshot(s.prisma, row.id), before);
  const body = 'Câu hỏi cuối do nhân viên chỉnh sửa và xác nhận gửi.'; row = await s.command(s.staff, '/requests/' + row.id + '/request-info', { expectedVersion: row.version, body, sourceTemplateRevisionId: t.current.id }); assert.equal(row.status, 'WAITING_USER'); assert.ok(row.sla.pausedAt);
  const message = await s.prisma.requestMessage.findFirst({ where: { requestId: row.id, kind: 'INFO_REQUEST' } }); assert.equal(message.body, body); assert.equal(message.sourceTemplateRevisionId, t.current.id);
  assert.equal(await s.prisma.notification.count({ where: { requestId: row.id, type: 'USER_INFO_REQUIRED' } }), 1);
  assert.equal(await s.prisma.notification.count({ where: { requestId: row.id, type: 'REQUEST_WATCH_ACTIVITY' } }), 2);
  assert.equal((await s.call(s.user.token, '/requests/' + row.id + '/provide-info', { expectedVersion: row.version, body: 'Reply', sourceTemplateRevisionId: t.current.id })).status, 400);
  row = await s.command(s.user, '/requests/' + row.id + '/provide-info', { expectedVersion: row.version, body: 'Thông tin được người gửi xác nhận.' }); assert.equal(row.status, 'IN_PROGRESS'); assert.equal(row.sla.pausedAt, null);
  pass('existing request-info human send and SLA/notification semantics');
});
test('M20 affected M18/M19 privacy, append-only note, structured mention and watcher delivery', async () => {
  const row = await s.assign(await s.create('collaboration-regression'));
  assert.equal((await s.call(s.manager.token, '/requests/' + row.id + '/watch', {}, 'PUT')).status, 200);
  const note = await s.call(s.staff.token, '/requests/' + row.id + '/internal-notes', { body: 'Private synthetic regression note', mentionedUserIds: [s.manager.actor.id] }); assert.equal(note.status, 201);
  assert.equal((await s.call(s.user.token, '/requests/' + row.id + '/internal-notes')).status, 403);
  assert.equal((await s.call(s.staff.token, '/requests/' + row.id + '/internal-notes/' + note.body.data.id, { body: 'edit' }, 'PATCH')).status, 404);
  assert.equal(await s.prisma.notification.count({ where: { requestId: row.id, type: 'INTERNAL_NOTE_MENTION' } }), 1); assert.equal(await s.prisma.notification.count({ where: { requestId: row.id, type: 'REQUEST_WATCH_ACTIVITY' } }), 0);
  const before = await workflowSnapshot(s.prisma, row.id), notes = await s.prisma.requestInternalNote.findMany({ where: { requestId: row.id } });
  const t = await template(); await revise(t); await s.call(s.staff.token, '/templates/' + t.id); await archive(await s.app.get(TemplateService).detail(t.id, s.manager.actor));
  assert.deepEqual(await workflowSnapshot(s.prisma, row.id), before); assert.deepEqual(await s.prisma.requestInternalNote.findMany({ where: { requestId: row.id } }), notes);
  const userHistory = await s.call(s.user.token, '/requests/' + row.id + '/history'); assert.equal(JSON.stringify(userHistory.body).includes('Private synthetic'), false); assert.equal((await s.prisma.request.findUnique({ where: { id: row.id } })).version, row.version);
  pass('affected M18/M19 scoped privacy/mentions/watch no template fanout');
});
test('M20 50-template fixture SQL bounds/keyset/current revision/history and measured API samples', async () => {
  const service = s.app.get(TemplateService), fixture = [];
  for (let i = 0; i < 50; i++) {
    const input = i % 2 === 0 ? responseInput('Perf-' + String(i).padStart(2, '0')) : { ...checklistInput('Perf-' + String(i).padStart(2, '0')), content: { items: Array.from({ length: 30 }, (_, n) => ({ text: 'Synthetic perf step ' + n, required: n % 2 === 0 })) } };
    const t = await service.create(s.manager.actor, input, randomUUID()); fixture.push(await service.revise(t.id, s.manager.actor, { ...input, expectedRevision: 1 }, randomUUID()));
  }
  const measure = async path => { s.queries.length = 0; const response = await s.call(s.manager.token, path); assert.equal(response.status, 200, JSON.stringify(response.body)); return { response, totalSql: s.queries.length, templateSql: s.queries.filter(q => /FROM "public"\."OperationalTemplate/.test(q.sql)).length, sqlMs: s.queries.map(q => q.durationMs), latencyMs: response.latencyMs }; };
  const list = await measure('/templates?q=Perf-&limit=50'); assert.equal(list.response.body.data.length, 50); assert.equal(list.response.body.page.hasMore, false); assert.equal(list.templateSql, 1);
  const detailSample = await measure('/templates/' + fixture[1].id); assert.equal(detailSample.response.body.data.current.content.items.length, 30); assert.ok(detailSample.templateSql <= 3);
  const historySample = await measure('/templates/' + fixture[1].id + '/revisions'); assert.equal(historySample.response.body.data.length, 2); assert.ok(historySample.templateSql <= 3);
  const seen = [], samples = []; let cursor;
  do { const sample = await measure('/templates?q=Perf-&limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')); samples.push(sample.latencyMs); seen.push(...sample.response.body.data.map(t => t.id)); cursor = sample.response.body.page.nextCursor; } while (cursor);
  assert.equal(seen.length, 50); assert.equal(new Set(seen).size, 50);
  const staff = await s.call(s.staff.token, '/templates?q=Perf-&limit=50'); assert.equal(staff.body.data.length, 25); assert.ok(staff.body.data.every(t => t.type === 'RESPONSE'));
  report.performance = { fixture: { templates: 50, revisionsPerTemplate: 2, checklistItems: 30 }, list: { totalSql: list.totalSql, templateSql: list.templateSql, latencyMs: list.latencyMs }, detail: { totalSql: detailSample.totalSql, templateSql: detailSample.templateSql, latencyMs: detailSample.latencyMs }, history: { totalSql: historySample.totalSql, templateSql: historySample.templateSql, latencyMs: historySample.latencyMs }, apiSamplesMs: samples, NPlusOne: false, limitations: 'Modest loopback synthetic fixture, no enterprise SLO claim.' };
  pass('performance/keyset/search/no N+1');
});
test('M20 generated OpenAPI, resource-only audits and absence of template provider work', async () => {
  for (const [path, methods] of [['/api/v1/templates',['get','post']], ['/api/v1/templates/{id}',['get']], ['/api/v1/templates/{id}/revisions',['get','post']], ['/api/v1/templates/{id}/archive',['post']]]) for (const method of methods) assert.ok(s.document.paths[path][method]);
  const schema = s.document.paths['/api/v1/templates'].post.requestBody.content['application/json'].schema; assert.ok(schema.oneOf || schema.anyOf);
  const sourceCommand = s.document.paths['/api/v1/requests/{id}/messages'].post.requestBody.content['application/json'].schema; assert.ok(sourceCommand.properties.sourceTemplateRevisionId);
  assert.equal(s.captured.intake.length + s.captured.structured.length + s.captured.embedding.length, 0);
  for (const row of await s.prisma.auditLog.findMany({ where: { action: { startsWith: 'TEMPLATE_' } } })) { assert.equal(row.requestId, null); assert.equal(row.safeAfterJson.body, undefined); assert.equal(row.safeAfterJson.content, undefined); }
  assert.equal(await s.prisma.notification.count({ where: { type: { startsWith: 'TEMPLATE_' } } }), 0);
  assert.equal(s.logs.some(log => /Synthetic response|Human-edited preserved draft|Private synthetic/.test(JSON.stringify(log))), false);
  pass('OpenAPI/safe audit/logs/no AI or new notification');
});
