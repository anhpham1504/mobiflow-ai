import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTemplateSchema, createTemplateRevisionSchema, archiveTemplateSchema, templateListQuerySchema, templateHistoryQuerySchema, messageSchema, provideInfoSchema, triageSchema } from '@mobiflow/contracts';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';
import { TemplateService } from '../dist/templates/template.service.js';
import { validateTemplateSource } from '../dist/templates/template-provenance.js';

const id = '11111111-1111-4111-8111-111111111111', policy = new AuthorizationPolicyService();
const actor = role => ({ id, role, sessionId: id });
const response = { type: 'RESPONSE', name: ' Yêu cầu bổ sung 🙂 ', content: { body: ' Chúng tôi đang kiểm tra. ' } };
const checklist = { type: 'CHECKLIST', name: 'Checklist', content: { items: [{ text: 'Kiểm tra APN', required: true }] } };

test('M20 names/descriptions trim and bound Unicode points; content retains literal text', () => {
  const literal = '<img src=x onerror=alert(1)>\n<script>alert(1)</script> 🙂';
  assert.deepEqual(createTemplateSchema.parse(response), { ...response, name: 'Yêu cầu bổ sung 🙂', content: { body: 'Chúng tôi đang kiểm tra.' } });
  assert.equal(createTemplateSchema.parse({ ...response, name: '🙂'.repeat(120), description: 'đ'.repeat(500), content: { body: literal } }).content.body, literal);
  for (const change of [{ name: ' ' }, { name: '🙂'.repeat(121) }, { description: 'đ'.repeat(501) }, { type: 'AI' }, { content: { body: ' ' } }, { content: { body: 'a'.repeat(4001) } }, { content: { body: '🙂'.repeat(4001) } }]) assert.equal(createTemplateSchema.safeParse({ ...response, ...change }).success, false);
  assert.equal(createTemplateSchema.safeParse({ ...response, content: { body: '🙂'.repeat(4000) } }).success, true);
});
test('M20 strict type/content pairing and ordered compatible checklist bounds', () => {
  assert.equal(createTemplateSchema.safeParse(checklist).success, true);
  for (const content of [{ items: [] }, { items: Array.from({ length: 31 }, () => checklist.content.items[0]) }, { items: [{ text: 'x'.repeat(501), required: true }] }, { items: [{ text: 'x', required: 'true' }] }, { items: [{ text: 'x', required: true, position: 1 }] }, { body: 'wrong' }, { items: checklist.content.items, body: 'wrong' }]) assert.equal(createTemplateSchema.safeParse({ ...checklist, content }).success, false);
  assert.equal(createTemplateSchema.safeParse({ ...checklist, content: { items: Array.from({ length: 30 }, () => ({ text: '🙂'.repeat(500), required: false })) } }).success, true);
});
test('M20 server-owned fields, management revision and strict queries', () => {
  for (const key of ['id','createdById','revision','createdAt','archivedAt','status','role','organizationId']) assert.equal(createTemplateSchema.safeParse({ ...response, [key]: id }).success, false);
  for (const expectedRevision of [0,-1,'1',1.1,undefined]) assert.equal(createTemplateRevisionSchema.safeParse({ ...response, expectedRevision }).success, false);
  assert.equal(createTemplateRevisionSchema.safeParse({ ...response, expectedRevision: 2 }).success, true);
  assert.equal(archiveTemplateSchema.safeParse({ expectedRevision: 1, status: 'ACTIVE' }).success, false);
  assert.equal(templateListQuerySchema.parse({ limit: '50' }).limit, 50);
  for (const q of [{ limit: '51' }, { limit: '0' }, { limit: 20 }, { status: 'DELETED' }, { q: 'x'.repeat(121) }, { cursor: 'x'.repeat(501) }, { role: 'MANAGER' }, { organizationId: id }]) assert.equal(templateListQuerySchema.safeParse(q).success, false);
  assert.equal(templateHistoryQuerySchema.safeParse({ type: 'RESPONSE' }).success, false);
  assert.equal(messageSchema.safeParse({ expectedVersion: 1, body: 'Text', sourceTemplateRevisionId: id }).success, true);
  assert.equal(provideInfoSchema.safeParse({ expectedVersion: 1, body: 'Text', sourceTemplateRevisionId: id }).success, false);
  assert.ok(triageSchema.shape.sourceTemplateRevisionId);
});
test('M20 centralized policy confines STAFF to active responses and USER to no library', () => {
  assert.deepEqual(policy.templateScope(actor('STAFF')), { type: 'RESPONSE', status: 'ACTIVE' });
  assert.deepEqual(policy.templateScope(actor('MANAGER')), {});
  assert.throws(() => policy.templateScope(actor('USER')), error => error.getStatus() === 403);
  for (const role of ['USER','STAFF']) assert.throws(() => policy.assertCanManageTemplates(actor(role)), error => error.getStatus() === 403);
});
test('M20 prohibited roles/filters are rejected before database work', async () => {
  const service = new TemplateService({ $transaction: () => { throw new Error('must not query'); } }, policy);
  for (const role of ['USER','STAFF']) {
    await assert.rejects(service.create(actor(role), response, id), error => error.getStatus() === 403);
    await assert.rejects(service.revise(id, actor(role), { ...response, expectedRevision: 1 }, id), error => error.getStatus() === 403);
    await assert.rejects(service.archive(id, actor(role), { expectedRevision: 1 }, id), error => error.getStatus() === 403);
    await assert.rejects(service.history(id, actor(role), {}), error => error.getStatus() === 403);
  }
  await assert.rejects(service.list(actor('USER'), {}), error => error.getStatus() === 403);
  for (const query of [{ type: 'CHECKLIST' }, { status: 'ARCHIVED' }]) await assert.rejects(service.list(actor('STAFF'), query), error => error.getStatus() === 403);
});
test('M20 source adoption revalidates current type/status/revision without replacing human content', async () => {
  let source = { templateId: id, revisionId: id, type: 'RESPONSE', status: 'ACTIVE', revision: 1, currentRevision: 1 };
  const tx = { $queryRaw: async query => { assert.ok(query.sql.includes('FOR SHARE OF t')); assert.ok(query.values.includes(id)); return source ? [source] : []; } };
  assert.deepEqual(await validateTemplateSource(tx, actor('STAFF'), id, 'RESPONSE'), source);
  await assert.rejects(validateTemplateSource(tx, actor('USER'), id, 'RESPONSE'), error => error.getStatus() === 403);
  await assert.rejects(validateTemplateSource(tx, actor('STAFF'), id, 'CHECKLIST'), error => error.getStatus() === 403);
  source = { ...source, currentRevision: 2 }; await assert.rejects(validateTemplateSource(tx, actor('MANAGER'), id, 'RESPONSE'), error => error.code === 'TEMPLATE_UNAVAILABLE');
  source = { ...source, currentRevision: 1, status: 'ARCHIVED' }; await assert.rejects(validateTemplateSource(tx, actor('MANAGER'), id, 'RESPONSE'), error => error.code === 'TEMPLATE_UNAVAILABLE');
  source = { ...source, status: 'ACTIVE', type: 'CHECKLIST' }; await assert.rejects(validateTemplateSource(tx, actor('MANAGER'), id, 'RESPONSE'), error => error.code === 'INVALID_TEMPLATE_SOURCE');
  source = null; await assert.rejects(validateTemplateSource(tx, actor('MANAGER'), id, 'RESPONSE'), error => error.code === 'INVALID_TEMPLATE_SOURCE');
});
