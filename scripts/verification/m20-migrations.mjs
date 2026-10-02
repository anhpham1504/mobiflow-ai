import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { withM20Database, migrationNames, m20Migration } from './m20-database.mjs';
import { saveEvidence } from './evidence.mjs';
const baselineSha = '35e4b1c41165fa04348871dee31bd20c28386b47';
for (const name of migrationNames.slice(0, 9)) {
  const path = 'apps/api/prisma/migrations/' + name + '/migration.sql';
  assert.equal(execFileSync('git', ['hash-object', path], { encoding: 'utf8', windowsHide: true }).trim(), execFileSync('git', ['rev-parse', baselineSha + ':' + path], { encoding: 'utf8', windowsHide: true }).trim());
}
assert.equal(migrationNames.length, 10); assert.equal(migrationNames[9], m20Migration);
const history = async client => (await client.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
async function snapshot(client) {
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename")).rows, data = {};
  for (const { tablename } of tables) { assert.match(tablename, /^[A-Za-z]+$/); data[tablename] = (await client.query('SELECT row_to_json(t) AS row FROM "' + tablename + '" t ORDER BY row_to_json(t)::text')).rows.map(result => result.row); }
  return data;
}
const developer = new Client({ connectionString: process.env.DATABASE_URL }); await developer.connect();
let developerBefore;
try { developerBefore = await history(developer); assert.equal(developerBefore.length, 7); } finally { await developer.end(); }
const checks = [];
for (const baseline of [10, 9, 8, 7]) await withM20Database(async ({ ownerUrl, databaseUrl, migrate }) => {
  const owner = new Client({ connectionString: ownerUrl }), runtime = new Client({ connectionString: databaseUrl }); await owner.connect(); await runtime.connect();
  try {
    assert.equal((await history(owner)).length, baseline);
    const requestId = (await owner.query('SELECT id FROM "Request" ORDER BY id LIMIT 1')).rows[0].id, userId = (await owner.query('SELECT id FROM "User" WHERE role=\'MANAGER\' ORDER BY id LIMIT 1')).rows[0].id;
    if (baseline === 7) migrate(8);
    const noteId = randomUUID(); await owner.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)', [noteId, requestId, userId, 'Synthetic preserved M18 note 🙂']);
    if (baseline === 7 || baseline === 8) migrate(9);
    await owner.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)', [noteId, userId]);
    await owner.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)', [requestId, userId]);
    const eventId = randomUUID();
    await owner.query('INSERT INTO "AuditLog"(id,"actorType","actorId",action,"resourceType","resourceId","requestCorrelationId",outcome) VALUES($1,\'MANAGER\',$2,\'INTERNAL_NOTE_CREATED\',\'RequestInternalNote\',$3,$4,\'SUCCEEDED\')', [eventId, userId, noteId, randomUUID()]);
    await owner.query('INSERT INTO "Notification"(id,"recipientId","requestId","eventId",type,"safeActorMetadataJson") VALUES($1,$2,$3,$4,\'INTERNAL_NOTE_MENTION\',$5)', [randomUUID(), userId, requestId, eventId, { actorType: 'MANAGER', noteId }]);
    const before = await snapshot(owner), oldHistory = await history(owner);
    if (baseline !== 10) {
      migrate(10); const after = await snapshot(owner);
      for (const table of Object.keys(before)) {
        if (table === 'Request') for (const row of after[table]) { assert.equal(row.manualDraftSourceTemplateRevisionId, null); delete row.manualDraftSourceTemplateRevisionId; }
        if (table === 'RequestMessage' || table === 'Checklist') for (const row of after[table]) { assert.equal(row.sourceTemplateRevisionId, null); delete row.sourceTemplateRevisionId; }
        assert.deepEqual(after[table], before[table], table + ' rows preserved');
      }
      assert.deepEqual((await history(owner)).slice(0, 9), oldHistory);
    }
    assert.deepEqual((await history(owner)).map(row => row.migration_name), migrationNames);
    const privileges = {};
    for (const table of ['OperationalTemplate', 'OperationalTemplateRevision', 'OperationalTemplateChecklistItemRevision']) {
      privileges[table] = (await owner.query("SELECT has_table_privilege('mobiflow_app',$1,'SELECT') AS read,has_table_privilege('mobiflow_app',$1,'INSERT') AS insert,has_table_privilege('mobiflow_app',$1,'UPDATE') AS update,has_table_privilege('mobiflow_app',$1,'DELETE') AS delete,has_table_privilege('mobiflow_app',$1,'TRUNCATE') AS truncate", ['"' + table + '"'])).rows[0];
      assert.deepEqual(privileges[table], { read: true, insert: true, update: false, delete: false, truncate: false });
      for (const sql of ['DELETE FROM "' + table + '"', 'TRUNCATE "' + table + '"']) await assert.rejects(runtime.query(sql), error => error.code === '42501');
    }
    for (const column of ['name','description','status','currentRevision','updatedAt','archivedAt']) assert.equal((await owner.query("SELECT has_column_privilege('mobiflow_app','\"OperationalTemplate\"',$1,'UPDATE') AS allowed", [column])).rows[0].allowed, true);
    for (const column of ['id','type','createdById','createdAt']) assert.equal((await owner.query("SELECT has_column_privilege('mobiflow_app','\"OperationalTemplate\"',$1,'UPDATE') AS allowed", [column])).rows[0].allowed, false);
    assert.equal((await owner.query("SELECT has_schema_privilege('mobiflow_app','public','CREATE') AS allowed")).rows[0].allowed, false);
    await assert.rejects(runtime.query('CREATE TABLE public.m20_forbidden_ddl (id integer)'), error => error.code === '42501');
    await assert.rejects(runtime.query('ALTER TABLE "OperationalTemplateRevision" ADD COLUMN m20_forbidden text'), error => error.code === '42501');
    await assert.rejects(runtime.query('DROP TABLE "OperationalTemplateChecklistItemRevision"'), error => error.code === '42501');
    const templateId = randomUUID(), revisionId = randomUUID();
    await runtime.query('BEGIN');
    await runtime.query('INSERT INTO "OperationalTemplate"(id,type,name,"createdById","updatedAt") VALUES($1,\'CHECKLIST\',\'Synthetic DB\',$2,now())', [templateId, userId]);
    await runtime.query('INSERT INTO "OperationalTemplateRevision"(id,"templateId",revision,name,"itemCount","createdById") VALUES($1,$2,1,\'Synthetic DB\',1,$3)', [revisionId, templateId, userId]);
    await runtime.query('INSERT INTO "OperationalTemplateChecklistItemRevision"("revisionId",position,text,required) VALUES($1,1,\'Verify APN\',true)', [revisionId]); await runtime.query('COMMIT');
    await assert.rejects(runtime.query('UPDATE "OperationalTemplateRevision" SET name=\'Changed\' WHERE id=$1', [revisionId]), error => error.code === '42501');
    await assert.rejects(owner.query('UPDATE "OperationalTemplateRevision" SET name=\'Changed\' WHERE id=$1', [revisionId]), error => error.code === '23514');
    await assert.rejects(owner.query('DELETE FROM "OperationalTemplateChecklistItemRevision" WHERE "revisionId"=$1', [revisionId]), error => error.code === '23514');
    await assert.rejects(runtime.query('INSERT INTO "OperationalTemplateChecklistItemRevision"("revisionId",position,text,required) VALUES($1,2,\'Historical append forbidden\',true)', [revisionId]), error => error.code === '23514');
    await assert.rejects(runtime.query('INSERT INTO "OperationalTemplateChecklistItemRevision"("revisionId",position,text,required) VALUES($1,1,\'Duplicate\',true)', [revisionId]), error => error.code === '23505');
    await assert.rejects(runtime.query('INSERT INTO "OperationalTemplateRevision"(id,"templateId",revision,name,"itemCount","createdById") VALUES($1,$2,1,\'Synthetic DB\',1,$3)', [randomUUID(), templateId, userId]), error => error.code === '23505');
    await assert.rejects(runtime.query('INSERT INTO "OperationalTemplateChecklistItemRevision"("revisionId",position,text,required) VALUES($1,1,\'Bad FK\',true)', [randomUUID()]), error => error.code === '23503');
    await assert.rejects(runtime.query('UPDATE "Request" SET "manualDraftSourceTemplateRevisionId"=$1 WHERE id=$2', [randomUUID(), requestId]), error => error.code === '23503');
    await assert.rejects(runtime.query('UPDATE "OperationalTemplate" SET "currentRevision"=2 WHERE id=$1', [templateId]), error => ['23503','23514'].includes(error.code));
    await assert.rejects(runtime.query('UPDATE "OperationalTemplate" SET name=\'No new revision\' WHERE id=$1', [templateId]), error => error.code === '23514');
    await runtime.query('UPDATE "Request" SET "manualDraftSourceTemplateRevisionId"=$1 WHERE id=$2', [revisionId, requestId]);
    await runtime.query('UPDATE "OperationalTemplate" SET status=\'ARCHIVED\',"archivedAt"=now(),"updatedAt"=now() WHERE id=$1', [templateId]);
    assert.equal((await runtime.query('SELECT "manualDraftSourceTemplateRevisionId" FROM "Request" WHERE id=$1', [requestId])).rows[0].manualDraftSourceTemplateRevisionId, revisionId);
    await assert.rejects(runtime.query('UPDATE "OperationalTemplate" SET status=\'ACTIVE\',"archivedAt"=NULL WHERE id=$1', [templateId]), error => error.code === '23514');
    const malicious = randomUUID();
    await runtime.query('BEGIN'); await runtime.query('INSERT INTO "OperationalTemplate"(id,type,name,"createdById","updatedAt") VALUES($1,\'CHECKLIST\',\'Invalid shape\',$2,now())', [malicious, userId]);
    await runtime.query('INSERT INTO "OperationalTemplateRevision"(id,"templateId",revision,name,"itemCount","createdById") VALUES($1,$2,1,\'Invalid shape\',0,$3)', [randomUUID(), malicious, userId]);
    await assert.rejects(runtime.query('COMMIT'), error => error.code === '23514'); await runtime.query('ROLLBACK');
    // Count alone cannot prove contiguity: {1,3,4} has three rows and a valid pointer to3.
    const gapTemplate = randomUUID();
    await runtime.query('BEGIN');
    await runtime.query('INSERT INTO "OperationalTemplate"(id,type,name,"currentRevision","createdById","updatedAt") VALUES($1,\'RESPONSE\',\'Invalid sequence\',3,$2,now())', [gapTemplate, userId]);
    for (const revision of [1,3,4]) await runtime.query('INSERT INTO "OperationalTemplateRevision"(id,"templateId",revision,name,body,"itemCount","createdById") VALUES($1,$2,$3,\'Invalid sequence\',\'Synthetic sequence probe\',0,$4)', [randomUUID(), gapTemplate, revision, userId]);
    await assert.rejects(runtime.query('COMMIT'), error => error.code === '23514'); await runtime.query('ROLLBACK');
    checks.push({ baseline, path: baseline === 10 ? 'fresh1→10' : baseline === 9 ? 'M19 9→10' : baseline === 8 ? 'M18 8→9→10' : 'V1.2 7→8→9→10', result: 'PASS', migrationCount: 10, historicalHashes: 'unchanged', tablesPreserved: Object.keys(before).length, rowsPreserved: Object.values(before).reduce((sum, rows) => sum + rows.length, 0), m18M19Preserved: true, privileges, runtimeDdlDenied: true, contiguousRevisionSequence: true, immutableIncludingHistoricalAppend: true, FKUniquePointerShape: 'PASS', archivedHistory: 'PASS' });
  } finally { await runtime.end(); await owner.end(); }
}, { baseline });
const finalDeveloper = new Client({ connectionString: process.env.DATABASE_URL }); await finalDeveloper.connect();
try { assert.deepEqual(await history(finalDeveloper), developerBefore); } finally { await finalDeveloper.end(); }
await saveEvidence('docs/v1.3/evidence/M20_DATABASE.json', { checkedAt: new Date().toISOString(), result: 'PASS', synthetic: true, migration: m20Migration, migrationCount: 10, checks, developerMigrations: 7, developerMetadataReadOnly: true, developerDatabaseModified: false });
console.log(JSON.stringify({ event: 'm20.database', result: 'PASS', checks, developerMigrations: 7, historicalSqlBytes: readFileSync('apps/api/prisma/migrations/' + m20Migration + '/migration.sql').length }));
