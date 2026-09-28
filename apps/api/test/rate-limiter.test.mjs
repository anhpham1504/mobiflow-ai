import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthRateLimiter } from '../dist/auth/rate-limiter.js';

test('login limits normalized account plus IP to 5 attempts per minute', () => {
  const limiter = new AuthRateLimiter();
  for (let index = 0; index < 5; index += 1) limiter.login('user@test.local', '127.0.0.1');
  assert.throws(() => limiter.login('user@test.local', '127.0.0.1'), (error) => error.getStatus() === 429 && error.code === 'RATE_LIMITED' && error.retryAfterSeconds > 0);
});

test('login has an independent 20/minute IP bound and refresh has a 30/minute session plus IP bound', () => {
  const limiter = new AuthRateLimiter();
  for (let index = 0; index < 20; index += 1) limiter.login(`user-${index}@test.local`, '127.0.0.2');
  assert.throws(() => limiter.login('user-21@test.local', '127.0.0.2'), (error) => error.getStatus() === 429);
  for (let index = 0; index < 30; index += 1) limiter.refresh('session', '127.0.0.3');
  assert.throws(() => limiter.refresh('session', '127.0.0.3'), (error) => error.getStatus() === 429);
});
