import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';
import { DEMO_DATABASES, safeDatabaseTarget } from '../demo/release-core.mjs';
import { seedDemo } from '../demo/seed-data.mjs';

const root = resolve('apps/api/prisma/migrations');
export const m18Migration = '20261002010000_m18_internal_notes';
export const migrationNames = readdirSync(root).filter(name => /^\d/.test(name)).sort();
export function runNode(args, env = {}) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error('M18 command failed: node ' + args.join(' '));
}
function v12Config() {
  assert.equal(migrationNames.length, 8); assert.equal(migrationNames[7], m18Migration);
  mkdirSync('artifacts/m18', { recursive: true });
  const temp = mkdtempSync(resolve('artifacts/m18/v12-baseline-'));
  const schemaPath = join(temp, 'schema.prisma'), migrationsPath = join(temp, 'migrations');
  writeFileSync(schemaPath, execFileSync('git', ['show', 'v1.2.0:apps/api/prisma/schema.prisma'], { windowsHide: true }));
  for (const name of migrationNames.slice(0, 7)) {
    const relativePath = 'apps/api/prisma/migrations/' + name + '/migration.sql';
    const historical = execFileSync('git', ['show', 'v1.2.0:' + relativePath], { windowsHide: true });
    // Windows Git checkout converts LF to CRLF; compare canonical Git text bytes.
    const canonical = bytes => bytes.toString('utf8').replaceAll('\r\n', '\n');
    assert.equal(createHash('sha256').update(canonical(readFileSync(relativePath))).digest('hex'), createHash('sha256').update(canonical(historical)).digest('hex'), 'Historical migration changed');
    mkdirSync(join(migrationsPath, name), { recursive: true }); writeFileSync(join(migrationsPath, name, 'migration.sql'), historical);
  }
  copyFileSync(join(root, 'migration_lock.toml'), join(migrationsPath, 'migration_lock.toml'));
  const config = join(temp, 'prisma.config.ts');
  writeFileSync(config, "import {defineConfig,env} from 'prisma/config';\nexport default defineConfig({schema:" + JSON.stringify(schemaPath) + ',migrations:{path:' + JSON.stringify(migrationsPath) + "},datasource:{url:env('MIGRATION_DATABASE_URL')}});\n");
  return config;
}
async function seed(databaseUrl) {
  safeDatabaseTarget(databaseUrl, { demoMode: process.env.DEMO_MODE, allowedDatabases: new Set(['mobiflow_m18_test']) });
  // Extend the synthetic allowlist within this test process only.
  DEMO_DATABASES.add('mobiflow_m18_test');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try { return await seedDemo(prisma, { databaseUrl }); } finally { await prisma.$disconnect(); }
}
export async function withM18Database(work, { upgrade = false } = {}) {
  if (process.env.DEMO_MODE !== 'true') throw new Error('M18 tests require explicit DEMO_MODE=true');
  const owner = new URL(process.env.MIGRATION_DATABASE_URL), runtime = new URL(process.env.DATABASE_URL), name = 'mobiflow_m18_test';
  if ([owner, runtime].some(url => !['localhost', '127.0.0.1'].includes(url.hostname) || url.protocol !== 'postgresql:') || owner.host !== runtime.host) throw new Error('Same loopback PostgreSQL server required');
  if (owner.username !== 'mobiflow_owner' || runtime.username !== 'mobiflow_app') throw new Error('Separate established owner/runtime principals required');
  const adminUrl = new URL(owner); adminUrl.pathname = '/postgres';
  const ownerUrl = new URL(owner); ownerUrl.pathname = '/' + name;
  const databaseUrl = new URL(runtime); databaseUrl.pathname = '/' + name;
  const admin = new Client({ connectionString: adminUrl.toString() }); await admin.connect();
  let locked = false, created = false;
  try {
    locked = (await admin.query('SELECT pg_try_advisory_lock($1) AS locked', [1801002])).rows[0].locked;
    if (!locked) throw new Error('Another M18 gate owns the isolated test target');
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) throw new Error('M18 test target already exists; inspect it. No overwrite/reset.');
    await admin.query('CREATE DATABASE mobiflow_m18_test'); created = true;
    if (upgrade) {
      runNode(['scripts/dev/prisma.mjs', 'migrate', 'deploy', '--config', v12Config()], { MIGRATION_DATABASE_URL: ownerUrl.toString() });
      await seed(databaseUrl.toString());
    } else {
      runNode(['scripts/dev/prisma.mjs', 'migrate', 'deploy'], { MIGRATION_DATABASE_URL: ownerUrl.toString() });
      await seed(databaseUrl.toString());
    }
    return await work({ databaseUrl: databaseUrl.toString(), ownerUrl: ownerUrl.toString(), database: name, seed: () => seed(databaseUrl.toString()), migrate: () => runNode(['scripts/dev/prisma.mjs', 'migrate', 'deploy'], { MIGRATION_DATABASE_URL: ownerUrl.toString() }) });
  } finally {
    try {
      if (created) { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]); await admin.query('DROP DATABASE mobiflow_m18_test'); }
    } finally { try { if (locked) await admin.query('SELECT pg_advisory_unlock($1)', [1801002]); } finally { await admin.end(); } }
  }
}
