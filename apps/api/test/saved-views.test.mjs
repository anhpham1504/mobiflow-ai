import assert from 'node:assert/strict';
import test from 'node:test';
/* global URLSearchParams */
import { createSavedViewSchema, updateSavedViewSchema, deleteSavedViewSchema, requestFilterSchema, requestListQuerySchema, requestFiltersAllowed,
  normalizeSavedViewName, savedViewNameSchema, savedViewSchema, SAVED_REQUEST_VIEW_SCHEMA_VERSION, MAX_SAVED_REQUEST_VIEWS,
  replaceRequestFilters, requestFiltersFromUrl, sameRequestFilters } from '@mobiflow/contracts';
const id = '00000000-0000-4000-8000-000000000023';
test('saved payload is the strict canonical subset, never transport or authorization', () => {
  const valid = { status: 'IN_PROGRESS', priority: 'HIGH', category: 'NETWORK', assigneeId: id, from: '2026-01-01T00:00:00Z', to: '2027-01-01T00:00:00.000Z' };
  assert.equal(requestFilterSchema.parse(valid).from, '2026-01-01T00:00:00.000Z');
  assert.equal(requestListQuerySchema.parse({ ...valid, limit: '20' }).limit, 20);
  for (const key of ['cursor', 'limit', 'page', 'sort', 'search', 'role', 'ownerUserId', 'createdById', 'where', 'bypassScope', 'teamId', 'sla', 'unreadOnly']) {
    assert.equal(createSavedViewSchema.safeParse({ name: 'View', filters: { [key]: 'x' } }).success, false, key);
  }
  for (const key of ['schemaVersion', 'id', 'ownerUserId', 'createdAt', 'role']) assert.equal(createSavedViewSchema.safeParse({ name: 'View', filters: {}, [key]: id }).success, false);
  for (const filters of [{ status: ['IN_PROGRESS'] }, { priority: 'INVALID' }, { from: 'yesterday' }, { from: '2026-01-01T00:00:00.001Z', to: '2026-01-01T00:00:00Z' }]) assert.equal(requestFilterSchema.safeParse(filters).success, false);
});
test('normalization counts Unicode points, NFC and case but retains Vietnamese accents', () => {
  assert.equal(normalizeSavedViewName('  ĐA\u0303 LƯU  '), normalizeSavedViewName('đã lưu'));
  assert.notEqual(normalizeSavedViewName('đã lưu'), normalizeSavedViewName('da luu'));
  assert.ok(savedViewNameSchema.safeParse('🙂'.repeat(80)).success);
  for (const name of ['', '   ', '🙂'.repeat(81), 'bad\nname']) assert.equal(savedViewNameSchema.safeParse(name).success, false);
  assert.equal(savedViewNameSchema.parse('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
});
test('live-role capability never comes from a stored role', () => {
  for (const role of ['USER', 'STAFF', 'MANAGER']) assert.ok(requestFiltersAllowed({ status: 'IN_PROGRESS' }, role));
  for (const role of ['USER', 'STAFF']) assert.equal(requestFiltersAllowed({ assigneeId: id }, role), false);
  assert.ok(requestFiltersAllowed({ assigneeId: id }, 'MANAGER'));
});
test('positive expectedVersion is mandatory independently for update and delete', () => {
  assert.ok(updateSavedViewSchema.safeParse({ name: 'Next', filters: {}, expectedVersion: 1 }).success);
  for (const expectedVersion of [undefined, 0, -1, '1', 1.5, 2147483647]) {
    assert.equal(updateSavedViewSchema.safeParse({ name: 'Next', filters: {}, expectedVersion }).success, false);
    assert.equal(deleteSavedViewSchema.safeParse({ expectedVersion }).success, false);
  }
  assert.equal(MAX_SAVED_REQUEST_VIEWS, 50);
});
test('unavailable DTO cannot expose filters or unsupported schema metadata', () => {
  const row = { id, name: 'Unavailable', version: 1, availability: 'UNAVAILABLE', reasonCode: 'ROLE_INCOMPATIBLE' };
  assert.ok(savedViewSchema.safeParse(row).success);
  assert.equal(savedViewSchema.safeParse({ ...row, filters: { assigneeId: id } }).success, false);
  const available = { id, name: 'Fine', version: 1, availability: 'AVAILABLE', schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION, filters: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
  assert.ok(savedViewSchema.safeParse(available).success);
  assert.equal(savedViewSchema.safeParse({ ...available, schemaVersion: 'unsupported' }).success, false);
});
test('apply replaces all managed filters, clears transients, preserves navigation; empty resets', () => {
  const before = new URLSearchParams({ priority: 'HIGH', category: 'NETWORK', from: '2026-01-01T00:00:00Z', assigneeId: id, cursor: 'old', page: '4', sort: 'old', search: 'sentinel', panel: 'details', view: id });
  const applied = replaceRequestFilters(before, { status: 'IN_PROGRESS' });
  assert.deepEqual(requestFiltersFromUrl(applied), { status: 'IN_PROGRESS' });
  assert.equal(applied.get('panel'), 'details'); assert.equal(applied.get('view'), id);
  for (const key of ['priority', 'category', 'from', 'assigneeId', 'cursor', 'page', 'sort', 'search']) assert.equal(applied.has(key), false, key);
  assert.deepEqual(requestFiltersFromUrl(replaceRequestFilters(applied, {})), {});
  assert.equal(before.get('priority'), 'HIGH');
  assert.throws(() => requestFiltersFromUrl(new URLSearchParams('status=NEW&status=CLOSED')));
  assert.ok(sameRequestFilters({ priority: 'HIGH', status: 'NEW' }, { status: 'NEW', priority: 'HIGH' }));
  assert.equal(sameRequestFilters({}, { priority: 'HIGH' }), false);
});
