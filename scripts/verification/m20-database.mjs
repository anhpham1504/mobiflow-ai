import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, mkdtempSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../apps/api/dist/generated/prisma/client.js';
import { DEMO_DATABASES, safeDatabaseTarget } from '../demo/release-core.mjs';
import { seedDemo } from '../demo/seed-data.mjs';

export const m20Migration = '20261002030000_m20_response_checklist_templates';
export const migrationNames = readdirSync('apps/api/prisma/migrations').filter(name => /^\d/.test(name)).sort();
export function runNode(args, env = {}) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error('M20 child command failed: ' + args.join(' '));
}
function configFor(count) {
  assert.ok([7, 8, 9, 10].includes(count)); assert.equal(migrationNames.length, 10); assert.equal(migrationNames[9], m20Migration);
  mkdirSync('artifacts/m20', { recursive: true });
  const folder = mkdtempSync(resolve('artifacts/m20/migrations-' + count + '-'));
  const schemaPath = join(folder, 'schema.prisma'), migrationsPath = join(folder, 'migrations');
  const ref = count === 7 ? 'v1.2.0' : '35e4b1c41165fa04348871dee31bd20c28386b47';
  writeFileSync(schemaPath, count === 10 ? readFileSync('apps/api/prisma/schema.prisma') : execFileSync('git', ['show', ref + ':apps/api/prisma/schema.prisma'], { windowsHide: true }));
  for (const name of migrationNames.slice(0, count)) {
    const path = 'apps/api/prisma/migrations/' + name + '/migration.sql', bytes = readFileSync(path);
    if (name !== m20Migration) assert.equal(bytes.toString().replaceAll('\r\n', '\n'), execFileSync('git', ['show', '35e4b1c41165fa04348871dee31bd20c28386b47:' + path], { windowsHide: true, encoding: 'utf8' }).replaceAll('\r\n', '\n'), 'Historical migration changed');
    mkdirSync(join(migrationsPath, name), { recursive: true }); writeFileSync(join(migrationsPath, name, 'migration.sql'), bytes);
  }
  copyFileSync('apps/api/prisma/migrations/migration_lock.toml', join(migrationsPath, 'migration_lock.toml'));
  const config = join(folder, 'prisma.config.ts');
  writeFileSync(config, "import {defineConfig,env} from 'prisma/config';\nexport default defineConfig({schema:" + JSON.stringify(schemaPath) + ',migrations:{path:' + JSON.stringify(migrationsPath) + "},datasource:{url:env('MIGRATION_DATABASE_URL')}});\n");
  return config;
}
async function seed(url) {
  safeDatabaseTarget(url, { demoMode: process.env.DEMO_MODE, allowedDatabases: new Set(['mobiflow_m20_test']) });
  DEMO_DATABASES.add('mobiflow_m20_test');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), omit: { request: { manualDraftSourceTemplateRevisionId: true }, requestMessage: { sourceTemplateRevisionId: true }, checklist: { sourceTemplateRevisionId: true } } });
  try { return await seedDemo(prisma, { databaseUrl: url }); } finally { await prisma.$disconnect(); }
}
export async function withM20Database(work, { baseline = 10 } = {}) {
  if (process.env.DEMO_MODE !== 'true') throw new Error('M20 requires explicit synthetic DEMO_MODE=true');
  const owner = new URL(process.env.MIGRATION_DATABASE_URL), runtime = new URL(process.env.DATABASE_URL);
  if ([owner, runtime].some(url => url.protocol !== 'postgresql:' || !['localhost', '127.0.0.1'].includes(url.hostname)) || owner.host !== runtime.host) throw new Error('Same loopback PostgreSQL required');
  if (owner.username !== 'mobiflow_owner' || runtime.username !== 'mobiflow_app') throw new Error('Established separate owner/runtime accounts required');
  const name = 'mobiflow_m20_test', adminUrl = new URL(owner); adminUrl.pathname = '/postgres';
  const ownerUrl = new URL(owner); ownerUrl.pathname = '/' + name;
  const databaseUrl = new URL(runtime); databaseUrl.pathname = '/' + name;
  const admin = new Client({ connectionString: adminUrl.toString() }); await admin.connect();
  let locked = false, created = false;
  try {
    locked = (await admin.query('SELECT pg_try_advisory_lock($1) AS locked', [2001002])).rows[0].locked;
    if (!locked) throw new Error('Another M20 gate owns the test DB');
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) throw new Error('M20 target exists; inspect it, no overwrite/reset');
    await admin.query('CREATE DATABASE mobiflow_m20_test'); created = true;
    const migrate = count => runNode(['scripts/dev/prisma.mjs', 'migrate', 'deploy', '--config', configFor(count)], { MIGRATION_DATABASE_URL: ownerUrl.toString() });
    migrate(baseline); await seed(databaseUrl.toString());
    return await work({ databaseUrl: databaseUrl.toString(), ownerUrl: ownerUrl.toString(), database: name, migrate, seed: () => seed(databaseUrl.toString()) });
  } finally {
    try { if (created) { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]); await admin.query('DROP DATABASE mobiflow_m20_test'); } }
    finally { try { if (locked) await admin.query('SELECT pg_advisory_unlock($1)', [2001002]); } finally { await admin.end(); } }
  }
}
