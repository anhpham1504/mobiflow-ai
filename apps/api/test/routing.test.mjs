import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoutingRuleSchema, createRoutingRevisionSchema, routingCommandSchema, routingListQuerySchema, routingEmptySchema, normalizeRoutingConditions, ROUTING_FIELD_DEFINITIONS } from '@mobiflow/contracts';
import { RoutingFactsBuilder } from '../dist/routing/routing-facts.js';
import { RoutingRuleEvaluator } from '../dist/routing/routing-evaluator.js';
import { RoutingService } from '../dist/routing/routing.service.js';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';

const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const facts = { category: 'NETWORK', subcategory: 'IOT_CONNECTIVITY', priority: 'HIGH' };
const condition = { field: 'priority', operator: 'EQ', values: ['HIGH'] };
const definition = { name: 'Network', priority: 10, target: { type: 'TEAM', id }, conditions: [condition] };
const rule = (change = {}) => ({ ruleId: id, revisionId: id, revision: 1, ruleVersion: 2, name: 'Network', priority: 10, status: 'ACTIVE', target: { type: 'TEAM', id, displayName: 'Network', eligible: true }, conditions: [condition], ...change });
const evaluator = new RoutingRuleEvaluator();

test('M21 facts builder projects only approved canonical fields and preserves null', () => {
  assert.deepEqual(new RoutingFactsBuilder().build({ ...facts, description: 'secret', ai: { priority: 'URGENT' }, triageDraftJson: {} }), facts);
  assert.deepEqual(new RoutingFactsBuilder().build({ category: null, subcategory: null, priority: 'MEDIUM' }), { category: null, subcategory: null, priority: 'MEDIUM' });
  assert.deepEqual(Object.keys(ROUTING_FIELD_DEFINITIONS), ['category', 'subcategory', 'priority']);
  assert.throws(() => new RoutingFactsBuilder().build({ ...facts, priority: 'fake' }));
});
test('M21 strict typed allowlist, enums, operators, bounds and inert text', () => {
  for (const key of ['request.foo.bar','__proto__','constructor','description','watchers','sla','template','1=1','DROP TABLE','process.exit()','${x}']) assert.equal(createRoutingRuleSchema.safeParse({ ...definition, conditions: [{ ...condition, field: key }] }).success, false);
  for (const change of [{ values: ['URGENT', 'HIGH'] }, { operator: 'REGEX' }, { values: ['1=1'] }, { values: [] }, { values: [null] }, { values: 'HIGH' }, { expression: 'true' }]) assert.equal(createRoutingRuleSchema.safeParse({ ...definition, conditions: [{ ...condition, ...change }] }).success, false);
  for (const field of ['createdById','revision','createdAt','requestFacts','autoAssign','execute','role','organization','authorizationScope','rawSql','expression','isFallback']) assert.equal(createRoutingRuleSchema.safeParse({ ...definition, [field]: true }).success, false);
  for (const change of [{ priority: 0 }, { priority: 1.5 }, { priority: 10001 }, { conditions: [] }, { conditions: Array(11).fill(condition) }, { target: { type: 'STAFF', id } }]) assert.equal(createRoutingRuleSchema.safeParse({ ...definition, ...change }).success, false);
  assert.equal(createRoutingRuleSchema.parse({ ...definition, name: '<script>process.exit()</script>', description: 'DROP TABLE ${x}' }).description, 'DROP TABLE ${x}');
  assert.equal(createRoutingRuleSchema.safeParse({ ...definition, name: '🙂'.repeat(120) }).success, true);
  assert.equal(createRoutingRuleSchema.safeParse({ ...definition, name: '🙂'.repeat(121) }).success, false);
});
test('M21 normalization canonicalizes IN without altering conjunction/order', () => {
  const input = [{ field: 'priority', operator: 'IN', values: ['URGENT','HIGH','HIGH'] }, condition];
  assert.deepEqual(normalizeRoutingConditions(input), [{ field: 'priority', operator: 'IN', values: ['HIGH','URGENT'] }, condition]);
  assert.equal(input[0].values.length, 3);
});
test('M21 AND, EQ, IN and null facts yield explicit match/no-match', () => {
  const r = rule({ conditions: [condition, { field: 'category', operator: 'IN', values: ['NETWORK','IOT'] }] });
  assert.equal(evaluator.evaluate(facts, 3, [r]).status, 'MATCH');
  assert.equal(evaluator.evaluate({ ...facts, category: 'BILLING' }, 3, [r]).status, 'NO_MATCH');
  assert.equal(evaluator.evaluate({ ...facts, category: null }, 3, [r]).status, 'NO_MATCH');
  assert.deepEqual(evaluator.evaluate(facts, 3, []).ruleRevisions, []);
});
test('M21 explicit priority, same-target tie, conflict and invalid winning target', () => {
  const a = rule(), b = rule({ ruleId: other, revisionId: other });
  const same = evaluator.evaluate(facts, 3, [a, b]); assert.equal(same.status, 'MATCH'); assert.equal(same.ruleRevisions.length, 2);
  const different = { ...b, target: { ...b.target, id: other } };
  const conflict = evaluator.evaluate(facts, 3, [a, different]); assert.equal(conflict.status, 'CONFLICT'); assert.equal(conflict.suggestedTarget, null);
  assert.equal(evaluator.evaluate(facts, 3, [a, { ...different, priority: 20 }]).suggestedTarget.id, id);
  const invalid = evaluator.evaluate(facts, 3, [{ ...a, target: { ...a.target, eligible: false } }, { ...different, priority: 20 }]);
  assert.equal(invalid.status, 'NO_MATCH'); assert.equal(invalid.diagnostic, 'INVALID_TARGET'); assert.equal(invalid.suggestedTarget, null);
});
test('M21 inactive/archive ignored and repeated/permuted inputs produce deep-equal results', () => {
  assert.equal(evaluator.evaluate(facts, 1, [rule({ status: 'INACTIVE' }), rule({ status: 'ARCHIVED' })]).status, 'NO_MATCH');
  const rules = [rule(), rule({ ruleId: other, revisionId: other })], before = globalThis.structuredClone(rules), expected = evaluator.evaluate(facts, 4, rules);
  for (let i = 0; i < 100; i++) assert.deepEqual(evaluator.evaluate(facts, 4, i % 2 ? [...rules].reverse() : rules), expected);
  assert.deepEqual(rules, before);
});
test('M21 strict revision/lifecycle/query/fact override contracts', () => {
  for (const expected of [{}, { expectedRevision: 1 }, { expectedRevision: 1, expectedRuleVersion: '1' }, { expectedRevision: 0, expectedRuleVersion: 1 }]) assert.equal(createRoutingRevisionSchema.safeParse({ ...definition, ...expected }).success, false);
  assert.equal(routingCommandSchema.safeParse({ expectedRevision: 2, expectedRuleVersion: 3 }).success, true);
  for (const input of [{ limit: '51' }, { status: 'DELETED' }, { role: 'MANAGER' }, { cursor: 'x'.repeat(501) }]) assert.equal(routingListQuerySchema.safeParse(input).success, false);
  assert.equal(routingEmptySchema.safeParse({ priority: 'HIGH' }).success, false);
});
test('M21 all service operations deny USER/STAFF before database work', async () => {
  const service = new RoutingService({ $transaction: () => { throw new Error('must not query'); } }, new AuthorizationPolicyService());
  for (const role of ['USER','STAFF']) {
    const actor = { id, role, sessionId: id };
    for (const task of [() => service.list(actor, {}), () => service.detail(id, actor), () => service.history(id, actor, {}), () => service.targets(actor, {}), () => service.create(actor, definition, id), () => service.revise(id, actor, definition, id), () => service.lifecycle(id, actor, {}, 'ACTIVE', id), () => service.evaluate(id, actor, {})]) await assert.rejects(task(), error => error.getStatus() === 403);
  }
});
