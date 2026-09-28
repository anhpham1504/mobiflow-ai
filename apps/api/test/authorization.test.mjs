import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';

const policy = new AuthorizationPolicyService();
const request = { createdById: 'user-a', currentAssigneeId: 'staff-a' };
const actor = (id, role) => ({ id, role, email: `${id}@test.local`, displayName: id, active: true, available: true, sessionId: 'session' });

test('ownership policy scopes USER to ownership, STAFF to current assignment and MANAGER to all requests', () => {
  assert.deepEqual(policy.requestScope(actor('user-a', 'USER')), { createdById: 'user-a' });
  assert.deepEqual(policy.requestScope(actor('staff-a', 'STAFF')), { currentAssigneeId: 'staff-a' });
  assert.deepEqual(policy.requestScope(actor('manager-a', 'MANAGER')), {});
  assert.equal(policy.canReadRequest(actor('user-a', 'USER'), request), true);
  assert.equal(policy.canReadRequest(actor('user-b', 'USER'), request), false);
  assert.equal(policy.canReadRequest(actor('staff-b', 'STAFF'), request), false);
  assert.equal(policy.canReadRequest(actor('manager-a', 'MANAGER'), request), true);
});

test('out-of-scope and absent requests have the same 404 policy result', () => {
  for (const value of [request, null]) {
    assert.throws(() => policy.assertCanReadRequest(actor('user-b', 'USER'), value), (error) => error.getStatus() === 404 && error.code === 'NOT_FOUND');
  }
});
