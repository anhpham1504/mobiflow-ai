import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { parseApiEnvironment } from '@mobiflow/config';
import { readinessResponseSchema } from '@mobiflow/contracts';
import { createApplication } from '../../apps/api/dist/app.js';

const env = parseApiEnvironment(process.env);
const base = process.env.VERIFY_API_URL ?? 'http://localhost:3001';
const web = process.env.VERIFY_WEB_URL ?? 'http://localhost:3000';
const evidence = { checkedAt: new Date().toISOString(), result: 'FAIL', checks: [] };
const record = (name, details) => { evidence.checks.push({ name, result: 'PASS', details }); console.log(`PASS ${name}`); };
const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 2000, query_timeout: 2000 });
try {
  const db = await pool.query("SELECT current_user AS role, version() AS version, (SELECT extversion FROM pg_extension WHERE extname='vector') AS vector");
  assert.equal(db.rows[0].role, 'mobiflow_app'); assert.ok(db.rows[0].vector);
  const tables = new Set((await pool.query("SELECT tablename AS table_name FROM pg_catalog.pg_tables WHERE schemaname='public'")).rows.map(({ table_name }) => table_name));
  for (const required of ['User', 'RefreshSession', 'Request', 'AuditLog', 'KnowledgeChunk', '_prisma_migrations']) assert.ok(tables.has(required));
  const embeddingColumns = Number((await pool.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND column_name='embedding'")).rows[0].count);
  assert.equal(embeddingColumns, 2);
  record('real PostgreSQL M2 schema, pgvector and M5 verified vector dimension', { ...db.rows[0], requiredTables: 6, embeddingColumns });

  for (const path of ['/api/v1/health/live', '/health/live']) assert.equal((await fetch(base + path)).status, 200);
  const readiness = await fetch(base + '/api/v1/health/ready');
  assert.equal(readiness.status, 200);
  const readinessBody = readinessResponseSchema.parse(await readiness.json());
  assert.equal(readinessBody.data.coreReady, true); record('running Docker API preserves M1 health contract', readinessBody.data);
  const tags = await (await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })).json();
  assert.ok(tags.models.some((model) => model.name === env.OLLAMA_MODEL));
  assert.equal(readinessBody.data.components.OLLAMA_LLM_MODEL.status, 'UP');
  record('actual installed host Ollama LLM', { configured: env.OLLAMA_MODEL, installed: tags.models.map(({ name, digest }) => ({ name, digest })) });

  const page = await fetch(web); assert.equal(page.status, 200); assert.match(await page.text(), /MobiFlow/); record('production web container responds', { status: 200 });
  const openapi = await (await fetch(base + '/api/docs-json')).json();
  for (const path of ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout', '/api/v1/auth/me', '/api/v1/users/staff']) assert.ok(openapi.paths[path]);
  assert.ok(!JSON.stringify(openapi).includes('passwordHash')); record('M2 OpenAPI contains safe auth and RBAC routes', Object.keys(openapi.paths));

  const headers = { Origin: env.WEB_ORIGIN, 'X-CSRF-Protection': '1', 'Content-Type': 'application/json' };
  const login = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers, body: JSON.stringify({ email: 'manager@mobiflow.local', password: 'MobiFlowDemo!2026' }) });
  assert.equal(login.status, 200); const loginBody = await login.json(); const setCookie = login.headers.get('set-cookie');
  assert.equal(loginBody.data.user.role, 'MANAGER'); assert.ok(setCookie?.includes('HttpOnly'));
  assert.ok(!JSON.stringify(loginBody).includes('passwordHash')); assert.ok(!Object.hasOwn(loginBody.data, 'refreshToken'));
  const me = await fetch(base + '/api/v1/auth/me', { headers: { Authorization: `Bearer ${loginBody.data.accessToken}` } });
  assert.equal(me.status, 200);
  const logout = await fetch(base + '/api/v1/auth/logout', { method: 'POST', headers: { Origin: env.WEB_ORIGIN, 'X-CSRF-Protection': '1', Cookie: setCookie.split(';')[0] } });
  assert.equal(logout.status, 204); record('production container login, protected profile and logout', { login: 200, me: 200, logout: 204 });

  const offline = await createApplication({ ...env, OLLAMA_BASE_URL: 'http://127.0.0.1:1', HEALTH_TIMEOUT_MS: 250 }, { quiet: true, log: () => {} });
  try {
    await offline.app.listen(0, '127.0.0.1'); const url = await offline.app.getUrl();
    const response = await fetch(url + '/health/ready'); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.data.status, 'DEGRADED'); assert.equal(body.data.components.OLLAMA_SERVER.status, 'DOWN');
    assert.equal((await fetch(url + '/health/live')).status, 200); record('Ollama offline leaves API alive and reports degraded readiness', body.data);
  } finally { await offline.app.close(); await offline.database.close(); await offline.prisma.$disconnect(); }
  evidence.result = 'PASS';
} finally {
  await pool.end(); mkdirSync('artifacts/m2', { recursive: true }); writeFileSync('artifacts/m2/runtime.json', JSON.stringify(evidence, null, 2));
}
