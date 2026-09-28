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
  record('real PostgreSQL and pgvector', db.rows[0]);
  const roles = await pool.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user');
  assert.deepEqual(roles.rows[0], { rolsuper: false, rolcreatedb: false, rolcreaterole: false });
  const distance = await pool.query("SELECT '[1,2,3]'::vector <-> '[1,2,3]'::vector AS distance");
  assert.equal(distance.rows[0].distance, 0); record('restricted runtime role and real vector operator', roles.rows[0]);
  const tables = await pool.query("SELECT tablename AS table_name FROM pg_catalog.pg_tables WHERE schemaname='public'");
  assert.ok(tables.rows.every((row) => row.table_name === '_prisma_migrations')); record('no M2 business tables', tables.rows);
  for (const path of ['/api/v1/health/live', '/health/live']) assert.equal((await fetch(base + path)).status, 200);
  const response = await fetch(base + '/api/v1/health/ready');
  assert.equal(response.status, 200);
  const result = readinessResponseSchema.parse(await response.json());
  assert.equal(result.data.coreReady, true); record('running API core readiness', result.data);
  const tags = await (await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })).json();
  assert.ok(tags.models.some((model) => model.name === env.OLLAMA_MODEL));
  assert.equal(result.data.components.OLLAMA_LLM_MODEL.status, 'UP');
  record('actual installed LLM and live Ollama health', { configured: env.OLLAMA_MODEL, installed: tags.models.map(({ name, digest }) => ({ name, digest })), embedding: result.data.components.OLLAMA_EMBEDDING_MODEL });
  const page = await fetch(web); assert.equal(page.status, 200); assert.match(await page.text(), /MobiFlow/); record('web responds', { status: 200 });
  const doc = await (await fetch(base + '/api/docs-json')).json(); assert.equal(Object.keys(doc.paths).length, 2); record('health-only OpenAPI', Object.keys(doc.paths));
  // Test a real offline connection without stopping the user's shared Ollama service.
  const offline = await createApplication({ ...env, OLLAMA_BASE_URL: 'http://127.0.0.1:1', HEALTH_TIMEOUT_MS: 250 }, { quiet: true, log: () => {} });
  try {
    await offline.app.listen(0, '127.0.0.1'); const url = await offline.app.getUrl();
    const readiness = await fetch(url + '/health/ready'); const body = await readiness.json();
    assert.equal(readiness.status, 200); assert.equal(body.data.status, 'DEGRADED'); assert.equal(body.data.components.OLLAMA_SERVER.status, 'DOWN');
    assert.equal((await fetch(url + '/health/live')).status, 200); record('real offline Ollama connection, live API and real DB', body.data);
  } finally { await offline.app.close(); await offline.database.close(); }
  evidence.result = 'PASS';
} finally {
  await pool.end(); mkdirSync('artifacts/m1', { recursive: true }); writeFileSync('artifacts/m1/runtime.json', JSON.stringify(evidence, null, 2));
}
