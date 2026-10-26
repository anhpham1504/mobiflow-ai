import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { IsString, MaxLength } from 'class-validator';
import { parseApiEnvironment } from '@mobiflow/config';
import { readinessResponseSchema } from '@mobiflow/contracts';
import { createApplication } from '../dist/app.js';
import { validationPipe } from '../dist/http.js';
import { OllamaHealthClient } from '../dist/health/ollama.js';
import { PostgresProbe } from '../dist/health/database.js';
import { SignJWT } from 'jose';
import { TextEncoder } from 'node:util';

const up = { status: 'UP', code: 'OK' };
const down = { status: 'DOWN', code: 'UNAVAILABLE' };
const base = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/mobiflow', JWT_SECRET: 'a'.repeat(40), REFRESH_TOKEN_SECRET: 'b'.repeat(40), AI_GENERATION_PROVIDER:'ollama',AI_PROVIDER:'ollama',RAG_RETRIEVAL_MODE:'vector',AI_RAG_ENABLED:'false', OLLAMA_MODEL: 'fixture-llm:1', OLLAMA_EMBEDDING_MODEL: 'fixture-embed:1', HEALTH_TIMEOUT_MS: 200 };
async function fixture(t, mode = 'online') {
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'timeout') return;
    if (mode === 'malformed') { res.end('{invalid'); return; }
    if (req.url === '/api/tags') { res.end(JSON.stringify({ models: [{ name: 'fixture-llm:1' }, { name: 'fixture-embed:1' }] })); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const { model } = JSON.parse(body);
    res.end(JSON.stringify({ capabilities: mode === 'mismatch' ? [] : [model === 'fixture-llm:1' ? 'completion' : 'embedding'] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
async function api(t, { origin = 'http://127.0.0.1:1', database, changes = {} } = {}) {
  const logs = [];
  const env = parseApiEnvironment({ ...base, OLLAMA_BASE_URL: origin, ...changes });
  const created = await createApplication(env, { quiet: true, log: (entry) => logs.push(entry), database: database ?? { check: async () => ({ database: up, vector: up }), close: async () => {} } });
  await created.app.listen(0, '127.0.0.1');
  t.after(async () => { await created.app.close(); await created.database.close(); await created.prisma.$disconnect(); });
  return { url: await created.app.getUrl(), logs, ...created };
}

test('API boots; complete Ollama fixture health gives READY and both route aliases work', async (t) => {
  const origin = await fixture(t);
  const app = await api(t, { origin });
  for (const path of ['/api/v1/health/ready', '/health/ready']) {
    const response = await fetch(app.url + path);
    assert.equal(response.status, 200);
    const result = readinessResponseSchema.parse(await response.json());
    assert.equal(result.data.status, 'READY'); assert.equal(result.data.aiReady, true);
  }
});
test('Ollama offline is degraded while API liveness/core readiness survive', async (t) => {
  const app = await api(t);
  const response = await fetch(app.url + '/api/v1/health/ready');
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.status, 'DEGRADED'); assert.equal(data.components.OLLAMA_SERVER.status, 'DOWN');
  assert.equal((await fetch(app.url + '/health/live')).status, 200);
});
test('offline server does not turn an unconfigured embedding into a configured outage', async () => {
  const result=await new OllamaHealthClient(parseApiEnvironment({...base,OLLAMA_BASE_URL:'http://127.0.0.1:1',OLLAMA_EMBEDDING_MODEL:'unconfigured'})).healthCheck();
  assert.equal(result.server.status,'DOWN');assert.equal(result.llm.status,'DOWN');assert.equal(result.embedding.status,'NOT_CONFIGURED');
});
test('database outage is 503, independent liveness still 200', async (t) => {
  const database = new PostgresProbe(base.DATABASE_URL, 200);
  const app = await api(t, { database });
  const response = await fetch(app.url + '/health/ready');
  assert.equal(response.status, 503); assert.equal((await response.json()).data.coreReady, false);
  assert.equal((await fetch(app.url + '/api/v1/health/live')).status, 200);
});
test('missing vector extension is a core readiness failure', async (t) => {
  const app = await api(t, { database: { check: async () => ({ database: up, vector: { status: 'DOWN', code: 'EXTENSION_MISSING' } }), close: async () => {} } });
  assert.equal((await fetch(app.url + '/health/ready')).status, 503);
});
test('DeepSeek lexical profile boots without Ollama; disabled live calls are truthful degraded health',async t=>{
  const app=await api(t,{database:{check:async()=>({database:up,vector:{status:'DOWN',code:'EXTENSION_MISSING'}}),close:async()=>{}},changes:{AI_GENERATION_PROVIDER:'deepseek',AI_PROVIDER:'deepseek',RAG_RETRIEVAL_MODE:'lexical',AI_LIVE_CALLS_ENABLED:'false'}});
  const response=await fetch(app.url+'/health/ready'),{data}=await response.json();assert.equal(response.status,200);assert.equal(data.coreReady,true);assert.equal(data.aiReady,false);assert.equal(data.status,'DEGRADED');assert.deepEqual(data.components.DEEPSEEK_API,{status:'DISABLED',code:'LIVE_CALLS_DISABLED'});assert.equal(data.components.OLLAMA_SERVER.status,'DISABLED');assert.equal(data.rag.retrievalMode,'lexical');
});
test('missing model is not reported installed; unconfigured embedding is distinct', async (t) => {
  const origin = await fixture(t);
  const env = parseApiEnvironment({ ...base, OLLAMA_BASE_URL: origin, OLLAMA_MODEL: 'missing:tag', OLLAMA_EMBEDDING_MODEL: 'unconfigured' });
  const result = await new OllamaHealthClient(env).healthCheck();
  assert.equal(result.server.status, 'UP'); assert.equal(result.llm.code, 'MODEL_NOT_INSTALLED'); assert.equal(result.embedding.status, 'NOT_CONFIGURED');
});
test('installed model with wrong capability is not considered ready', async (t) => {
  const origin = await fixture(t, 'mismatch');
  const result = await new OllamaHealthClient(parseApiEnvironment({ ...base, OLLAMA_BASE_URL: origin })).healthCheck();
  assert.equal(result.llm.code, 'CAPABILITY_MISMATCH'); assert.equal(result.embedding.code, 'CAPABILITY_MISMATCH');
});
test('Ollama timeout is bounded and a malformed response is safely unavailable', async (t) => {
  for (const mode of ['timeout', 'malformed']) {
    const origin = await fixture(t, mode);
    const start = performance.now();
    const result = await new OllamaHealthClient(parseApiEnvironment({ ...base, OLLAMA_BASE_URL: origin })).healthCheck();
    assert.deepEqual(result.server, down); assert.ok(performance.now() - start < 2000);
  }
});
test('request IDs, sanitized errors, safe logs, CORS and Swagger M2 inventory', async (t) => {
  const app = await api(t);
  const id = '11111111-1111-4111-8111-111111111111';
  const response = await fetch(app.url + '/api/v1/missing?password=do-not-log', { headers: { 'X-Request-ID': id, Authorization: 'Bearer do-not-log', Origin: 'http://localhost:3000' } });
  assert.equal(response.status, 404); assert.equal(response.headers.get('X-Request-ID'), id);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
  const body = await response.json(); assert.equal(body.requestId, id); assert.equal(body.error.code, 'NOT_FOUND');
  const badId = await fetch(app.url + '/health/live', { headers: { 'X-Request-ID': 'untrusted-value' } });
  assert.notEqual(badId.headers.get('X-Request-ID'), 'untrusted-value');
  const doc = await (await fetch(app.url + '/api/docs-json')).json();
  for (const path of ['/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/me', '/api/v1/auth/refresh', '/api/v1/health/live', '/api/v1/health/ready', '/api/v1/users/me', '/api/v1/users/staff', '/api/v1/requests', '/api/v1/manager/approvals/{id}/accept']) assert.ok(doc.paths[path]);
  assert.ok(!JSON.stringify(app.logs).includes('do-not-log'));
});
test('global validation foundation rejects unknown fields and invalid values', async () => {
  class ProbeDto {}
  IsString()(ProbeDto.prototype, 'value'); MaxLength(8)(ProbeDto.prototype, 'value');
  const pipe = validationPipe();
  const metadata = { type: 'body', metatype: ProbeDto };
  assert.equal((await pipe.transform({ value: 'valid' }, metadata)).value, 'valid');
  await assert.rejects(pipe.transform({ value: 'valid', role: 'MANAGER' }, metadata));
  await assert.rejects(pipe.transform({ value: 42 }, metadata));
});

test('malformed and oversized JSON receive safe client errors without exposing the body', async (t) => {
  const app = await api(t);
  for (const [body, status, code] of [['{"private":"do-not-log"', 400, 'INVALID_INPUT'], [JSON.stringify({ private: 'x'.repeat(70000) }), 413, 'PAYLOAD_TOO_LARGE']]) {
    const response = await fetch(app.url + '/health/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  }
  assert.ok(!JSON.stringify(app.logs).includes('do-not-log'));
});

test('invalid compressed JSON is rejected safely without leaking payload or parser details',async t=>{
  const app=await api(t),marker='compressed-private-do-not-log';
  const response=await fetch(app.url+'/health/live',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:marker});
  assert.equal(response.status,400);const body=await response.json();assert.equal(body.error.code,'INVALID_INPUT');
  assert.equal(JSON.stringify(body).includes(marker)||JSON.stringify(app.logs).includes(marker),false);
});

test('unavailable real database gives sanitized bounded login dependency errors', async (t) => {
  const app=await api(t),started=Date.now();
  const response=await fetch(app.url+'/api/v1/auth/login',{method:'POST',headers:{Origin:'http://localhost:3000','X-CSRF-Protection':'1','Content-Type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',password:'do-not-log-password'})});
  assert.equal(response.status,503);assert.ok(Date.now()-started<10000);
  const body=await response.json();assert.deepEqual(body.error,{code:'DATABASE_UNAVAILABLE',message:'The database is temporarily unavailable.'});
  assert.equal(/postgresql:|stack|Prisma|do-not-log-password/.test(JSON.stringify(body)+JSON.stringify(app.logs)),false);
});

test('valid JWT plus unavailable session store is 503; invalid or expired JWT stays 401', async (t) => {
  const app=await api(t),env=parseApiEnvironment({...base,OLLAMA_BASE_URL:'http://127.0.0.1:1'}),key=new TextEncoder().encode(env.JWT_SECRET);
  const token=expiration=>new SignJWT({sid:'22222222-2222-4222-8222-222222222222',role:'MANAGER'}).setProtectedHeader({alg:'HS256'}).setSubject('11111111-1111-4111-8111-111111111111').setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).setExpirationTime(expiration).sign(key);
  const valid=await fetch(app.url+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+await token('1m')}});assert.equal(valid.status,503);assert.equal((await valid.json()).error.code,'DATABASE_UNAVAILABLE');
  for(const credential of ['invalid-synthetic-token',await token(Math.floor(Date.now()/1000)-60)]){const rejected=await fetch(app.url+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+credential}});assert.equal(rejected.status,401);assert.equal((await rejected.json()).error.code,'UNAUTHORIZED');}
});
