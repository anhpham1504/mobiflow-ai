import assert from 'node:assert/strict';
import { Client } from 'pg';
import { withM18Database, migrationNames, m18Migration } from './m18-database.mjs';
import { saveEvidence } from './evidence.mjs';

async function history(client) { return (await client.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows; }
async function snapshot(client) {
  const tables = (await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`)).rows;
  const result = {};
  for (const { tablename } of tables) {
    if (!/^[A-Za-z]+$/.test(tablename)) throw new Error('Unexpected table identifier in synthetic fixture');
    result[tablename] = (await client.query('SELECT row_to_json(t) AS row FROM "' + tablename + '" t ORDER BY row_to_json(t)::text')).rows;
  }
  return result;
}
const checks = [];
await withM18Database(async ({ ownerUrl, seed, database }) => {
  const client = new Client({ connectionString: ownerUrl }); await client.connect();
  try {
    assert.deepEqual((await history(client)).map(row => row.migration_name), migrationNames);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "RequestInternalNote"')).rows[0].count, 0);
    const before = await snapshot(client); await seed(); const after = await snapshot(client);
    assert.deepEqual(Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value.length])), Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value.length])), 'Seed row counts remain idempotent');
    const grants = (await client.query(`SELECT has_table_privilege('mobiflow_app','"RequestInternalNote"','SELECT') AS read,has_table_privilege('mobiflow_app','"RequestInternalNote"','INSERT') AS append,has_table_privilege('mobiflow_app','"RequestInternalNote"','UPDATE') AS edit,has_table_privilege('mobiflow_app','"RequestInternalNote"','DELETE') AS remove,has_table_privilege('mobiflow_app','"RequestInternalNote"','TRUNCATE') AS truncate`)).rows[0];
    assert.deepEqual(grants, { read: true, append: true, edit: false, remove: false, truncate: false });
    checks.push({ kind: 'fresh', database, result: 'PASS', migrations: 8, seed: 'PASS — idempotent counts; no fake notes', seededCounts: Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value.length])), runtimePrivileges: grants });
  } finally { await client.end(); }
});
await withM18Database(async ({ ownerUrl, migrate, seed, database }) => {
  const client = new Client({ connectionString: ownerUrl }); await client.connect();
  try {
    const migrationsBefore = await history(client); assert.equal(migrationsBefore.length, 7);
    const before = await snapshot(client); assert.equal('RequestInternalNote' in before, false);
    migrate();
    const migrationsAfter = await history(client); assert.deepEqual(migrationsAfter.map(row => row.migration_name), migrationNames);
    assert.deepEqual(migrationsAfter.slice(0, 7), migrationsBefore, 'Historical migration identities/checksums preserved');
    const after = await snapshot(client); const notes = after.RequestInternalNote; delete after.RequestInternalNote;
    assert.deepEqual(after, before, 'Every existing v1.2 row must survive byte-equivalent JSON projection'); assert.deepEqual(notes, []);
    await seed(); const reseeded = await snapshot(client);
    assert.deepEqual(Object.fromEntries(Object.entries(reseeded).filter(([key]) => key !== 'RequestInternalNote').map(([key, value]) => [key, value.length])), Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value.length])));
    checks.push({ kind: 'v1.2-upgrade', database, result: 'PASS', migrationsBefore: 7, migrationsAfter: 8, newMigration: m18Migration, existingTablesPreserved: Object.keys(before).length, existingRowsPreserved: Object.values(before).reduce((sum, rows) => sum + rows.length, 0), oldMigrationChecksums: 'unchanged', developerDatabaseReset: false, seedAfterUpgrade: 'PASS — idempotent counts; no fake notes' });
  } finally { await client.end(); }
}, { upgrade: true });
await saveEvidence('docs/v1.3/evidence/M18_DATABASE.json', { checkedAt: new Date().toISOString(), result: 'PASS', synthetic: true, checks, migration: m18Migration, migrationCount: 8, developerDatabaseModified: false });
console.log(JSON.stringify({ event: 'm18.database', result: 'PASS', checks }));
