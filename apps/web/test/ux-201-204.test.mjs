import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsQuerySchema, createRoutingRuleSchema } from '@mobiflow/contracts';
import { analyticsValidationErrors, focusFirstInvalid, routingValidationErrors } from '../src/lib/form-errors.ts';
import { requestActionNotice } from '../src/lib/request-action-notice.ts';

const rule = { name: 'Quy tắc synthetic', priority: 10, target: { type: 'TEAM', id: '10000000-0000-4000-8000-000000000001' }, conditions: [{ field: 'priority', operator: 'EQ', values: ['MEDIUM'] }] };
const errorsForRule = input => {
  const result = createRoutingRuleSchema.safeParse(input);
  assert.equal(result.success, false);
  return routingValidationErrors(result.error.issues);
};

for (const name of ['', ' '.repeat(4), 'x'.repeat(121)]) test(`UX-201: invalid name of ${name.length} characters has constraint feedback without changing the draft`, () => {
  const input = { ...rule, name };
  const before = JSON.parse(JSON.stringify(input));
  assert.match(errorsForRule(input).name, /1 đến 120 ký tự/);
  assert.deepEqual(input, before);
});
test('UX-201: schema accepts the exact 120-character boundary, including Unicode code points', () => {
  for (const name of ['x'.repeat(120), '😀'.repeat(120)]) assert.equal(createRoutingRuleSchema.safeParse({ ...rule, name }).success, true);
});
test('UX-201: priority and missing target errors map to their own controls', () => {
  for (const priority of [0, 10001, 1.5]) assert.match(errorsForRule({ ...rule, priority }).priority, /số nguyên từ 1 đến 10000/);
  assert.match(errorsForRule({ ...rule, target: { type: 'TEAM', id: '' } })['target.id'], /Chọn nhóm/);
});
test('UX-201: empty IN values get a condition error while valid EQ/IN remain accepted', () => {
  const errors = errorsForRule({ ...rule, conditions: [{ field: 'priority', operator: 'IN', values: [] }] });
  assert.match(errors['conditions.0.values'], /EQ.*IN/);
  assert.equal(createRoutingRuleSchema.safeParse({ ...rule, conditions: [...rule.conditions, { field: 'priority', operator: 'IN', values: ['HIGH', 'URGENT'] }] }).success, true);
});
test('UX-201/202: invalid focus follows visual field order, independent of schema issue order', () => {
  const focus = [];
  const fields = ['name', 'priority', 'target.id', 'conditions.0.values'].map(path => ({ dataset: { errorField: path }, focus: () => focus.push(path) }));
  focusFirstInvalid({ querySelectorAll: () => fields }, { priority: 'Invalid', name: 'Invalid' });
  assert.deepEqual(focus, ['name']);
  focusFirstInvalid({ querySelectorAll: () => fields }, { conditions: 'Invalid' });
  assert.equal(focus.at(-1), 'conditions.0.values');
  focusFirstInvalid({ querySelectorAll: () => ['from', 'to'].map(path => ({ dataset: { errorField: path }, focus: () => focus.push(path) })) }, { to: 'Invalid', from: 'Invalid' });
  assert.equal(focus.at(-1), 'from');
});
for (const [from, to] of [['2026-10-09', '2026-10-01'], ['2026-10-01', '2026-10-01'], ['2025-10-01', '2026-10-02']]) test(`UX-202: invalid relational range ${from}/${to} describes both dates`, () => {
  const draft = { from, to };
  const result = analyticsQuerySchema.safeParse(draft);
  assert.equal(result.success, false);
  const errors = analyticsValidationErrors(result.error.issues, draft);
  assert.match(errors.from, /trước ngày kết thúc.*365 ngày/);
  assert.equal(errors.from, errors.to);
  assert.deepEqual(draft, { from, to });
});
test('UX-202: missing date feedback identifies the missing field; valid boundaries retain contract semantics', () => {
  for (const key of ['from', 'to']) {
    const input = { from: '2026-10-01', to: '2026-10-09', [key]: '' };
    const result = analyticsQuerySchema.safeParse(input);
    assert.equal(result.success, false);
    const errors = analyticsValidationErrors(result.error.issues, input);
    assert.ok(errors[key]);
    assert.equal(errors[key === 'from' ? 'to' : 'from'], undefined);
  }
  for (const input of [{ from: '2025-10-01', to: '2026-10-01' }, { from: '2026-10-01', to: '2026-10-02' }, { preset: '30d', priority: 'HIGH' }]) {
    const result = analyticsQuerySchema.safeParse(input);
    assert.equal(result.success, true);
    assert.deepEqual(result.data, input);
  }
});
test('UX-204: waiting STAFF and resolved STAFF/MANAGER receive the canonical next-step explanation', () => {
  assert.match(requestActionNotice('STAFF', 'WAITING_USER'), /chờ người yêu cầu bổ sung.*tiếp tục xử lý/);
  for (const role of ['STAFF', 'MANAGER']) assert.match(requestActionNotice(role, 'RESOLVED'), /chờ người yêu cầu xác nhận.*xử lý lại/);
});
test('UX-204: existing USER notices survive; actionable and terminal states add no conflicting notice', () => {
  for (const status of ['ASSIGNED', 'IN_PROGRESS']) assert.equal(requestActionNotice('USER', status), 'Hiện chưa có thao tác nào cần bạn thực hiện.');
  for (const [role, status] of [['STAFF', 'ASSIGNED'], ['STAFF', 'IN_PROGRESS'], ['USER', 'WAITING_USER'], ['USER', 'RESOLVED'], ['MANAGER', 'WAITING_USER'], ['MANAGER', 'TRIAGED']]) assert.equal(requestActionNotice(role, status), null);
  for (const role of ['USER', 'STAFF', 'MANAGER']) for (const status of ['CLOSED', 'CANCELED']) assert.equal(requestActionNotice(role, status), null);
});
