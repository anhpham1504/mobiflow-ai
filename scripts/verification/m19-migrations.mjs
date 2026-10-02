import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { withM19Database, migrationNames, m19Migration } from './m19-database.mjs';
import { saveEvidence } from './evidence.mjs';
async function history(client) { return (await client.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows; }
async function snapshot(client) {
  const names = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename")).rows;
  const data = {};
  for (const { tablename } of names) {
    assert.match(tablename, /^[A-Za-z]+$/);
    data[tablename] = (await client.query('SELECT row_to_json(t) AS row FROM "' + tablename + '" t ORDER BY row_to_json(t)::text')).rows;
  }
  return data;
}
const checks = [];
for (const baseline of [9, 7, 8]) await withM19Database(async ({ ownerUrl, databaseUrl, migrate, seed }) => {
  const owner = new Client({ connectionString: ownerUrl }), runtime = new Client({ connectionString: databaseUrl });
  await owner.connect(); await runtime.connect();
  try {
    const starting = await history(owner); assert.equal(starting.length, baseline);
    if (baseline === 7) migrate(8);
    let old, oldHistory, noteId;
    if (baseline !== 9) {
      noteId = randomUUID();
      const requestId = (await owner.query('SELECT id FROM "Request" ORDER BY id LIMIT 1')).rows[0].id;
      const authorId = (await owner.query('SELECT id FROM "User" WHERE role=\'MANAGER\' ORDER BY id LIMIT 1')).rows[0].id;
      await owner.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)', [noteId, requestId, authorId, 'Synthetic immutable M18 upgrade note 🙂']);
      old = await snapshot(owner); oldHistory = await history(owner);
      migrate(9);
      const after = await snapshot(owner); delete after.RequestInternalNoteMention; delete after.RequestWatcher;
      assert.deepEqual(after, old, 'Existing rows including M18 notes must remain identical');
      assert.deepEqual((await history(owner)).slice(0, 8), oldHistory, 'Historical checksums unchanged');
    }
    assert.deepEqual((await history(owner)).map(row => row.migration_name), migrationNames);
    const beforeSeed = await snapshot(owner); await seed(); const afterSeed = await snapshot(owner);
    assert.deepEqual(Object.fromEntries(Object.entries(afterSeed).map(([key, rows]) => [key, rows.length])), Object.fromEntries(Object.entries(beforeSeed).map(([key, rows]) => [key, rows.length])));
    const privileges = {};
    for (const table of ['RequestInternalNote', 'RequestInternalNoteMention', 'RequestWatcher']) {
      const qualified = '"' + table + '"';
      privileges[table] = (await owner.query("SELECT has_table_privilege('mobiflow_app',$1,'SELECT') AS read,has_table_privilege('mobiflow_app',$1,'INSERT') AS insert,has_table_privilege('mobiflow_app',$1,'UPDATE') AS update,has_table_privilege('mobiflow_app',$1,'DELETE') AS delete,has_table_privilege('mobiflow_app',$1,'TRUNCATE') AS truncate", [qualified])).rows[0];
      assert.deepEqual(privileges[table], { read: true, insert: true, update: false, delete: table === 'RequestWatcher', truncate: false });
    }
    const requestId = (await owner.query('SELECT id FROM "Request" ORDER BY id LIMIT 1')).rows[0].id;
    const userId = (await owner.query('SELECT id FROM "User" WHERE role=\'MANAGER\' ORDER BY id LIMIT 1')).rows[0].id;
    if (!noteId) { noteId = randomUUID(); await runtime.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)', [noteId, requestId, userId, 'Synthetic DB constraint note']); }
    await runtime.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)', [noteId, userId]);
    await assert.rejects(runtime.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)', [noteId, userId]), error => error.code === '23505');
    await assert.rejects(runtime.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)', [randomUUID(), userId]), error => error.code === '23503');
    await assert.rejects(runtime.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)', [noteId, randomUUID()]), error => error.code === '23503');
    await runtime.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)', [requestId, userId]);
    await assert.rejects(runtime.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)', [requestId, userId]), error => error.code === '23505');
    for (const key of [[randomUUID(), userId], [requestId, randomUUID()]]) await assert.rejects(runtime.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)', key), error => error.code === '23503');
    for (const table of ['RequestInternalNote', 'RequestInternalNoteMention']) for (const sql of ['DELETE FROM "' + table + '"', 'UPDATE "' + table + '" SET "createdAt"=now()', 'TRUNCATE "' + table + '"']) await assert.rejects(runtime.query(sql), error => error.code === '42501');
    await runtime.query('DELETE FROM "RequestWatcher" WHERE "requestId"=$1 AND "userId"=$2', [requestId, userId]);
    for (const sql of ['UPDATE "RequestWatcher" SET "createdAt"=now()', 'TRUNCATE "RequestWatcher"']) await assert.rejects(runtime.query(sql), error => error.code === '42501');
    checks.push({ baseline, path: baseline === 9 ? 'fresh1→9' : baseline === 7 ? 'v1.2 7→8→9' : 'M18 8→9', result: 'PASS', migrations: 9, oldChecksums: 'unchanged', tablesPreserved: old ? Object.keys(old).length : null, rowsPreserved: old ? Object.values(old).reduce((sum, rows) => sum + rows.length, 0) : null, m18NotesPreserved: baseline !== 9, seedIdempotent: true, constraints: 'FK/unique PASS', privileges });
  } finally { await runtime.end(); await owner.end(); }
}, { baseline });
const developer = new Client({ connectionString: process.env.DATABASE_URL }); await developer.connect();
let developerMigrations;
try { developerMigrations = (await history(developer)).length; assert.equal(developerMigrations, 7); } finally { await developer.end(); }
await saveEvidence('docs/v1.3/evidence/M19_DATABASE.json', { checkedAt: new Date().toISOString(), result: 'PASS', synthetic: true, migration: m19Migration, migrationCount: 9, checks, developerMigrations, developerDatabaseModified: false });
console.log(JSON.stringify({ event: 'm19.database', result: 'PASS', checks, developerMigrations }));
