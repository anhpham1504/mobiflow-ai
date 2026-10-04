import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, mkdtempSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';
import { DEMO_DATABASES, safeDatabaseTarget } from '../demo/release-core.mjs';
import { m24Environment } from './m24-runtime.mjs';
import { seedDemo } from '../demo/seed-data.mjs';

export const m24Migration = '20261004010000_m23_saved_request_views';
export const migrationNames = readdirSync('apps/api/prisma/migrations').filter(name => /^\d/.test(name)).sort();
export function runNode(args, env = {}) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error('M24 child command failed: ' + args.join(' '));
}
function configFor(count) {
  assert.ok([7, 8, 9, 10, 11, 12, 13].includes(count)); assert.equal(migrationNames.length, 13); assert.equal(migrationNames[12], m24Migration);
  mkdirSync('artifacts/m24', { recursive: true });
  const folder = mkdtempSync(resolve('artifacts/m24/migrations-' + count + '-'));
  const schemaPath = join(folder, 'schema.prisma'), migrationsPath = join(folder, 'migrations');
  const ref = count === 7 ? 'v1.2.0' : '4735afafe7cda4dbf98bdd387cc2fd49db22f764';
  writeFileSync(schemaPath, count === 13 ? readFileSync('apps/api/prisma/schema.prisma') : execFileSync('git', ['show', ref + ':apps/api/prisma/schema.prisma'], { windowsHide: true }));
  for (const name of migrationNames.slice(0, count)) {
    const path = 'apps/api/prisma/migrations/' + name + '/migration.sql', bytes = readFileSync(path);
    if (name !== m24Migration) assert.equal(bytes.toString().replaceAll('\r\n', '\n'), execFileSync('git', ['show', '4735afafe7cda4dbf98bdd387cc2fd49db22f764:' + path], { windowsHide: true, encoding: 'utf8' }).replaceAll('\r\n', '\n'), 'Historical migration changed');
    mkdirSync(join(migrationsPath, name), { recursive: true }); writeFileSync(join(migrationsPath, name, 'migration.sql'), bytes);
  }
  copyFileSync('apps/api/prisma/migrations/migration_lock.toml', join(migrationsPath, 'migration_lock.toml'));
  const config = join(folder, 'prisma.config.ts');
  writeFileSync(config, "import {defineConfig,env} from 'prisma/config';\nexport default defineConfig({schema:" + JSON.stringify(schemaPath) + ',migrations:{path:' + JSON.stringify(migrationsPath) + "},datasource:{url:env('MIGRATION_DATABASE_URL')}});\n");
  return config;
}
async function seed(url) {
  safeDatabaseTarget(url, { demoMode: process.env.DEMO_MODE, allowedDatabases: new Set(['mobiflow_m24_test']) });
  DEMO_DATABASES.add('mobiflow_m24_test');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), omit: { notification: { slaAlertId: true }, request: { manualDraftSourceTemplateRevisionId: true }, requestMessage: { sourceTemplateRevisionId: true }, checklist: { sourceTemplateRevisionId: true } } });
  try { return await seedDemo(prisma, { databaseUrl: url }); } finally { await prisma.$disconnect(); }
}
export async function withM24Database(work, { baseline = 13 } = {}) {
  if (process.env.DEMO_MODE !== 'true') throw new Error('M24 requires explicit synthetic DEMO_MODE=true');
  const isolated = m24Environment();
  const owner = new URL(isolated.MIGRATION_DATABASE_URL), runtime = new URL(isolated.DATABASE_URL);
  if ([owner, runtime].some(url => url.protocol !== 'postgresql:' || !['localhost', '127.0.0.1'].includes(url.hostname)) || owner.host !== runtime.host) throw new Error('Same loopback PostgreSQL required');
  if (owner.username !== 'mobiflow_owner' || runtime.username !== 'mobiflow_app') throw new Error('Established separate owner/runtime accounts required');
  const name = 'mobiflow_m24_test', adminUrl = new URL(owner); adminUrl.pathname = '/postgres';
  const ownerUrl = new URL(owner); ownerUrl.pathname = '/' + name;
  const databaseUrl = new URL(runtime); databaseUrl.pathname = '/' + name;
  const admin = new Client({ connectionString: adminUrl.toString() }); await admin.connect();
  let locked = false, created = false;
  try {
    locked = (await admin.query('SELECT pg_try_advisory_lock($1) AS locked', [2401004])).rows[0].locked;
    if (!locked) throw new Error('Another M24 gate owns the test DB');
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) throw new Error('M24 target exists; inspect it, no overwrite/reset');
    await admin.query('CREATE DATABASE mobiflow_m24_test'); created = true;
    const migrate = count => runNode(['scripts/dev/prisma.mjs', 'migrate', 'deploy', '--config', configFor(count)], { MIGRATION_DATABASE_URL: ownerUrl.toString() });
    migrate(baseline); await seed(databaseUrl.toString());
    return await work({ databaseUrl: databaseUrl.toString(), ownerUrl: ownerUrl.toString(), database: name, migrate, seed: () => seed(databaseUrl.toString()) });
  } finally {
    try { if (created) { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]); await admin.query('DROP DATABASE mobiflow_m24_test'); } }
    finally { try { if (locked) await admin.query('SELECT pg_advisory_unlock($1)', [2401004]); } finally { await admin.end(); } }
  }
}
