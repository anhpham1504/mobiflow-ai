import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCursor, cursorPosition } from '../src/lib/cursor-history.ts';

test('cursor history supports previous, browser Back/Forward, and a changed next cursor', () => {
  let history = advanceCursor(null, 'USER:filters', null, 'second');
  history = advanceCursor(history, 'USER:filters', 'second', 'third');
  assert.equal(cursorPosition(history, 'USER:filters', 'third').previous, 'second');
  assert.equal(cursorPosition(history, 'USER:filters', 'second').page, 2);
  assert.equal(cursorPosition(history, 'USER:filters', null).canPrevious, false);
  assert.deepEqual(advanceCursor(history, 'USER:filters', null, 'second'), history);
  const refreshed = advanceCursor(history, 'USER:filters', 'second', 'different-third');
  assert.deepEqual(refreshed.cursors, [null, 'second', 'different-third']);
});
test('filter, search, role, account and route scope changes discard old cursors', () => {
  const history = advanceCursor(null, 'original', null, 'old-cursor');
  for (const scope of ['filter','search','role','account','route']) {
    assert.equal(cursorPosition(history, scope, null).canPrevious, false);
    assert.deepEqual(advanceCursor(history, scope, null, 'new-cursor').cursors, [null, 'new-cursor']);
  }
});
test('direct cursor URLs have honest relative orientation and cannot loop to themselves', () => {
  assert.equal(cursorPosition(null, 'scope', 'unobserved').startsAtFirst, false);
  assert.equal(cursorPosition({scope:'scope',cursors:[null,'known']}, 'scope', 'unobserved').page, null);
  const history = advanceCursor(null, 'scope', 'unobserved', 'next');
  assert.equal(cursorPosition(history, 'scope', 'next').page, 2);
  assert.deepEqual(advanceCursor(history, 'scope', 'next', 'next'), history);
});
