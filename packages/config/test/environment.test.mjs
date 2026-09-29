import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseApiEnvironment } from '../dist/index.js';

const valid = { DATABASE_URL: 'postgresql://app:local@localhost:5432/mobiflow', JWT_SECRET: 'a'.repeat(40), REFRESH_TOKEN_SECRET: 'b'.repeat(40), OLLAMA_BASE_URL: 'http://localhost:11434', OLLAMA_MODEL: 'installed:tag', OLLAMA_EMBEDDING_MODEL: 'unconfigured' };
test('M5 rejects invalid embedding/retrieval bounds without silently clamping',()=>{
  assert.equal(parseApiEnvironment(valid).AI_RAG_ENABLED,false);
  assert.equal(parseApiEnvironment(valid).EMBEDDING_DIMENSION,undefined);
  for(const change of [{EMBEDDING_PROVIDER:'cloud'},{EMBEDDING_BASE_URL:'file:///private'},{EMBEDDING_BASE_URL:'http://user:secret@localhost:11434'},{EMBEDDING_DIMENSION:0},{EMBEDDING_DIMENSION:2001},{EMBEDDING_BATCH_SIZE:17},{EMBEDDING_TIMEOUT_MS:30001},{RAG_TOP_K:6},{RAG_TOP_K:0},{RAG_MAX_DISTANCE:2.1},{RAG_CONTEXT_CHARS:6001},{KNOWLEDGE_JOB_TIMEOUT_MS:600001},{AI_RAG_ENABLED:'yes'}])assert.throws(()=>parseApiEnvironment({...valid,...change}),/Invalid environment keys:/);
});
test('AI settings enable intake by default and enforce bounded inference at startup', () => {
  const env=parseApiEnvironment(valid);
  assert.equal(env.AI_AUTO_ANALYZE,true);
  assert.equal(env.AI_ATTEMPT_TIMEOUT_MS,120000);
  assert.equal(env.AI_RUN_TIMEOUT_MS,300000);
  assert.equal(parseApiEnvironment({...valid,AI_AUTO_ANALYZE:'false'}).AI_AUTO_ANALYZE,false);
  for(const change of [{AI_AUTO_ANALYZE:'yes'},{AI_ATTEMPT_TIMEOUT_MS:120001},{AI_RUN_TIMEOUT_MS:300001},{AI_TEMPERATURE:2},{AI_MAX_OUTPUT_TOKENS:4097},{AI_PROVIDER:'cloud'}]){
    assert.throws(()=>parseApiEnvironment({...valid,...change}),/Invalid environment keys:/);
  }
});
test('validates native and Docker Ollama origins and coerces bounded ports', () => {
  assert.equal(parseApiEnvironment({ ...valid, API_PORT: '3001' }).API_PORT, 3001);
  assert.equal(parseApiEnvironment({ ...valid, OLLAMA_BASE_URL: 'http://host.docker.internal:11434' }).AI_PROVIDER, 'ollama');
});
test('rejects missing config, invalid protocols, bounds and reused secrets without echoing values', () => {
  for (const change of [{ DATABASE_URL: undefined }, { API_PORT: 0 }, { HEALTH_TIMEOUT_MS: 50000 }, { OLLAMA_MODEL: '' }, { OLLAMA_BASE_URL: 'file:///private' }, { OLLAMA_BASE_URL: 'http://user:secret@localhost:11434' }, { REFRESH_TOKEN_SECRET: valid.JWT_SECRET }]) {
    assert.throws(() => parseApiEnvironment({ ...valid, ...change }), /Invalid environment keys:/);
  }
  assert.throws(() => parseApiEnvironment({ ...valid, JWT_SECRET: 'private-value' }), (error) => !error.message.includes('private-value'));
});

test('malformed URL values produce key-only diagnostics rather than URL parser errors', () => {
  for (const key of ['DATABASE_URL', 'OLLAMA_BASE_URL', 'WEB_ORIGIN']) {
    assert.throws(() => parseApiEnvironment({ ...valid, [key]: 'invalid-sensitive-value' }), (error) => error.message === `Invalid environment keys: ${key}`);
  }
});

test('insecure refresh cookies are accepted only for the explicit loopback HTTP demo', () => {
  assert.equal(parseApiEnvironment({ ...valid, WEB_ORIGIN: 'http://127.0.0.1:3000', AUTH_COOKIE_SECURE: 'false' }).AUTH_COOKIE_SECURE, false);
  assert.throws(() => parseApiEnvironment({ ...valid, WEB_ORIGIN: 'https://example.test', AUTH_COOKIE_SECURE: 'false' }), /AUTH_COOKIE_SECURE/);
  assert.equal(parseApiEnvironment({ ...valid, WEB_ORIGIN: 'https://example.test', AUTH_COOKIE_SECURE: 'true' }).AUTH_COOKIE_SECURE, true);
});

test('production rejects low-entropy and placeholder-like auth secrets with key-only diagnostics',()=>{
  for(const [key,value] of [['JWT_SECRET','a'.repeat(40)],['REFRESH_TOKEN_SECRET','example-secret-value-12345678901234567890']]){
    assert.throws(()=>parseApiEnvironment({...valid,NODE_ENV:'production',JWT_SECRET:'Aa3!secure-random-looking-value-012345',REFRESH_TOKEN_SECRET:'Bb7!different-random-looking-value-98765',[key]:value}),error=>error.message===`Invalid environment keys: ${key}`);
  }
});
