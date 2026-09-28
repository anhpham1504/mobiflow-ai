import { spawnSync } from 'node:child_process';
import { Client } from 'pg';

const ownerUrl = process.env.MIGRATION_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
if (!ownerUrl || !appUrl) throw new Error('Both migration and runtime database URLs are required.');
const owner = new URL(ownerUrl);
const app = new URL(appUrl);
const testDatabase = 'mobiflow_m2_test';
if (!['localhost', '127.0.0.1'].includes(owner.hostname) || !['localhost', '127.0.0.1'].includes(app.hostname)) throw new Error('M2 integration database must be loopback local.');
const ownerAdminUrl = new URL(owner); ownerAdminUrl.pathname = '/postgres';
const ownerTestUrl = new URL(owner); ownerTestUrl.pathname = `/${testDatabase}`;
const appTestUrl = new URL(app); appTestUrl.pathname = `/${testDatabase}`;
const admin = new Client({ connectionString: ownerAdminUrl.toString() });

function run(args, env) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Command failed with exit code ${result.status}: node ${args.join(' ')}`);
}

await admin.connect();
try {
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDatabase}' AND pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${testDatabase}`);
  await admin.query(`CREATE DATABASE ${testDatabase}`);
  run(['scripts/dev/prisma.mjs', 'migrate', 'deploy'], { MIGRATION_DATABASE_URL: ownerTestUrl.toString() });
  run(['scripts/dev/seed.mjs'], { DATABASE_URL: appTestUrl.toString(), DEMO_MODE: 'true' });
  run(['scripts/dev/seed.mjs'], { DATABASE_URL: appTestUrl.toString(), DEMO_MODE: 'true' });

  const verification = new Client({ connectionString: ownerTestUrl.toString() });
  await verification.connect();
  const migrationCount = Number((await verification.query('SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count);
  const vectorVersion = (await verification.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).rows[0]?.extversion;
  const embeddingColumns = Number((await verification.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND column_name='embedding'")).rows[0].count);
  const runtimePrivileges = await verification.query("SELECT has_table_privilege('mobiflow_app', '\"User\"', 'SELECT') AS user_select, has_table_privilege('mobiflow_app', '\"AuditLog\"', 'INSERT') AS audit_insert, has_table_privilege('mobiflow_app', '\"AuditLog\"', 'UPDATE') AS audit_update, has_sequence_privilege('mobiflow_app', 'request_public_code_seq', 'USAGE') AS public_code_sequence_usage");
  await verification.end();
  if (migrationCount !== 3 || !vectorVersion || embeddingColumns !== 0 || !runtimePrivileges.rows[0].user_select || !runtimePrivileges.rows[0].audit_insert || runtimePrivileges.rows[0].audit_update || !runtimePrivileges.rows[0].public_code_sequence_usage) throw new Error('Clean migration privilege/vector verification failed.');
  console.log(JSON.stringify({ event: 'm2.clean-migration.verified', database: testDatabase, migrationCount, vectorVersion, embeddingColumns, runtimePrivileges: runtimePrivileges.rows[0] }));
  run(['--test', 'apps/api/test/auth.integration.test.mjs'], { M2_INTEGRATION_DATABASE_URL: appTestUrl.toString() });
  run(['--test', 'apps/api/test/workflow.integration.test.mjs'], { M2_INTEGRATION_DATABASE_URL: appTestUrl.toString() });
} finally {
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDatabase}' AND pid <> pg_backend_pid()`);
  await admin.query(`DROP DATABASE IF EXISTS ${testDatabase}`);
  await admin.end();
}
