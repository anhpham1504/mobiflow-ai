import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { withM21Database, migrationNames, m21Migration } from './m21-database.mjs';
import { saveEvidence } from './evidence.mjs';

const baselineSha = 'b75d15acc2dbbb16d00ce47db8ed891af210a48d';
for (const name of migrationNames.slice(0, 10)) {
  const path = 'apps/api/prisma/migrations/' + name + '/migration.sql';
  assert.equal(execFileSync('git', ['hash-object', path], { encoding: 'utf8', windowsHide: true }).trim(), execFileSync('git', ['rev-parse', baselineSha + ':' + path], { encoding: 'utf8', windowsHide: true }).trim());
}
assert.equal(migrationNames.length, 11); assert.equal(migrationNames[10], m21Migration);
const history = async client => (await client.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
async function snapshot(client) {
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename")).rows, data = {};
  for (const { tablename } of tables) { assert.match(tablename, /^[A-Za-z]+$/); data[tablename] = (await client.query('SELECT row_to_json(t) AS row FROM "' + tablename + '" t ORDER BY row_to_json(t)::text')).rows.map(result => result.row); }
  return data;
}
function preserved(before, after) {
  for (const [table, rows] of Object.entries(before)) {
    assert.equal(after[table].length, rows.length, table + ' row count');
    const byId = new Map(after[table].map(row => [JSON.stringify(Object.fromEntries(Object.keys(rows[0] ?? {}).map(key => [key, row[key]]))), row]));
    for (const row of rows) { const found = byId.get(JSON.stringify(row)); assert.ok(found, table + ' original row preserved'); for (const key of Object.keys(found).filter(key => !(key in row))) assert.equal(found[key], null, 'New legacy column must be null'); }
  }
}
async function rejected(client, sql, params = [], codes = ['23514']) {
  await client.query('BEGIN');
  try { await assert.rejects(async () => { await client.query(sql, params); await client.query('COMMIT'); }, error => codes.includes(error.code)); }
  finally { await client.query('ROLLBACK'); }
}
const developer = new Client({ connectionString: process.env.DATABASE_URL }); await developer.connect();
let developerBefore;
try { developerBefore = await history(developer); assert.equal(developerBefore.length, 7); } finally { await developer.end(); }
const checks = [];
for (const baseline of [11, 10, 9, 7]) await withM21Database(async ({ ownerUrl, databaseUrl, migrate }) => {
  const owner = new Client({ connectionString: ownerUrl }), runtime = new Client({ connectionString: databaseUrl }); await owner.connect(); await runtime.connect();
  try {
    assert.equal((await history(owner)).length, baseline);
    const requestId = (await owner.query('SELECT id FROM "Request" ORDER BY id LIMIT 1')).rows[0].id;
    const userId = (await owner.query('SELECT id FROM "User" WHERE role=\'MANAGER\' ORDER BY id LIMIT 1')).rows[0].id;
    const teamId = (await owner.query('SELECT id FROM "Team" WHERE active ORDER BY id LIMIT 1')).rows[0].id;
    const upgrades = [];
    async function upgrade(count) { const before = await snapshot(owner), old = await history(owner); migrate(count); const after = await snapshot(owner); preserved(before, after); assert.deepEqual((await history(owner)).slice(0, old.length), old); upgrades.push({ from: old.length, to: count, tables: Object.keys(before).length, rows: Object.values(before).reduce((n, rows) => n + rows.length, 0) }); }
    if (baseline === 7) await upgrade(8);
    const noteId = randomUUID(); await owner.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)', [noteId, requestId, userId, 'Synthetic preserved note 🙂']);
    if (baseline === 7) await upgrade(9);
    await owner.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)', [noteId, userId]);
    await owner.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)', [requestId, userId]);
    const eventId = randomUUID(); await owner.query('INSERT INTO "AuditLog"(id,"actorType","actorId",action,"resourceType","resourceId","requestCorrelationId",outcome) VALUES($1,\'MANAGER\',$2,\'INTERNAL_NOTE_CREATED\',\'RequestInternalNote\',$3,$4,\'SUCCEEDED\')', [eventId, userId, noteId, randomUUID()]);
    await owner.query('INSERT INTO "Notification"(id,"recipientId","requestId","eventId",type,"safeActorMetadataJson") VALUES($1,$2,$3,$4,\'INTERNAL_NOTE_MENTION\',$5)', [randomUUID(), userId, requestId, eventId, { actorType: 'MANAGER', noteId }]);
    if (baseline <= 9) await upgrade(10);
    const templateId = randomUUID(), templateRevisionId = randomUUID();
    await owner.query('BEGIN');
    await owner.query('INSERT INTO "OperationalTemplate"(id,type,name,"createdById","updatedAt") VALUES($1,\'CHECKLIST\',\'Preserved template\',$2,now())', [templateId, userId]);
    await owner.query('INSERT INTO "OperationalTemplateRevision"(id,"templateId",revision,name,"itemCount","createdById") VALUES($1,$2,1,\'Preserved template\',1,$3)', [templateRevisionId, templateId, userId]);
    await owner.query('INSERT INTO "OperationalTemplateChecklistItemRevision"("revisionId",position,text,required) VALUES($1,1,\'Synthetic preserved item\',true)', [templateRevisionId]);
    await owner.query('UPDATE "Request" SET "manualDraftSourceTemplateRevisionId"=$1 WHERE id=$2', [templateRevisionId, requestId]);
    await owner.query('UPDATE "Checklist" SET "sourceTemplateRevisionId"=$1 WHERE id=(SELECT id FROM "Checklist" ORDER BY id LIMIT 1)', [templateRevisionId]);
    await owner.query('UPDATE "RequestMessage" SET "sourceTemplateRevisionId"=$1 WHERE id=(SELECT id FROM "RequestMessage" ORDER BY id LIMIT 1)', [templateRevisionId]);
    await owner.query('COMMIT');
    if (baseline !== 11) await upgrade(11);
    assert.deepEqual((await history(owner)).map(row => row.migration_name), migrationNames);
    const privileges = {};
    for (const table of ['RoutingRule', 'RoutingRuleRevision']) {
      privileges[table] = (await owner.query("SELECT has_table_privilege('mobiflow_app',$1,'SELECT') AS read,has_table_privilege('mobiflow_app',$1,'INSERT') AS insert,has_table_privilege('mobiflow_app',$1,'UPDATE') AS update,has_table_privilege('mobiflow_app',$1,'DELETE') AS delete,has_table_privilege('mobiflow_app',$1,'TRUNCATE') AS truncate", ['"' + table + '"'])).rows[0];
      assert.deepEqual(privileges[table], { read: true, insert: true, update: false, delete: false, truncate: false });
    }
    const ruleId = randomUUID(), revisionId = randomUUID(), conditions = JSON.stringify([{ field: 'priority', operator: 'EQ', values: ['HIGH'] }]);
    const parentSql = 'INSERT INTO "RoutingRule"(id,"createdById","updatedAt") VALUES($1,$2,now())';
    const revisionSql = 'INSERT INTO "RoutingRuleRevision"(id,"ruleId",revision,name,priority,"targetTeamId",conditions,"createdById") VALUES($1,$2,$3,\'Synthetic rule\',$4,$5,$6,$7)';
    await runtime.query('BEGIN'); await runtime.query(parentSql, [ruleId, userId]); await runtime.query(revisionSql, [revisionId, ruleId, 1, 10, teamId, conditions, userId]); await runtime.query('COMMIT');
    await rejected(runtime, revisionSql, [randomUUID(), ruleId, 1, 10, teamId, conditions, userId], ['23505']);
    await rejected(runtime, revisionSql, [randomUUID(), ruleId, 2, 10, randomUUID(), conditions, userId], ['23503']);
    await rejected(runtime, revisionSql, [randomUUID(), ruleId, 2, 0, teamId, conditions, userId]);
    for (const invalid of [[], [{ field: '__proto__', operator: 'EQ', values: ['HIGH'] }], [{ field: 'priority', operator: 'SQL', values: ['HIGH'] }], [{ field: 'priority', operator: 'EQ', values: ['HIGH','LOW'] }], [{ field: 'priority', operator: 'EQ', values: ['DROP TABLE'] }], null]) await rejected(runtime, revisionSql, [randomUUID(), ruleId, 2, 10, teamId, JSON.stringify(invalid), userId]);
    await rejected(runtime, revisionSql, [randomUUID(), ruleId, 2, 10, teamId, conditions, userId]); // Cannot append without advancing current pointer.
    await rejected(runtime, 'UPDATE "RoutingRuleRevision" SET name=\'Changed\' WHERE id=$1', [revisionId], ['42501']);
    await rejected(owner, 'UPDATE "RoutingRuleRevision" SET name=\'Changed\' WHERE id=$1', [revisionId]);
    await rejected(owner, 'DELETE FROM "RoutingRuleRevision" WHERE id=$1', [revisionId]);
    await rejected(runtime, 'DELETE FROM "RoutingRule" WHERE id=$1', [ruleId], ['42501']);
    await rejected(runtime, 'TRUNCATE "RoutingRuleRevision"', [], ['42501']);
    await rejected(runtime, 'CREATE TABLE m21_forbidden(id int)', [], ['42501']);
    await rejected(runtime, 'UPDATE "RoutingRule" SET "createdById"=$1 WHERE id=$2', [userId, ruleId], ['42501']);
    await rejected(runtime, 'UPDATE "RoutingRule" SET status=\'DELETED\',version=version+1 WHERE id=$1', [ruleId], ['22P02']);
    await rejected(runtime, 'UPDATE "RoutingRule" SET "currentRevision"=3,version=version+1 WHERE id=$1', [ruleId]);
    const gap = randomUUID(); await runtime.query('BEGIN');
    await runtime.query('INSERT INTO "RoutingRule"(id,"currentRevision","createdById","updatedAt") VALUES($1,3,$2,now())', [gap, userId]);
    for (const n of [1,3,4]) await runtime.query(revisionSql, [randomUUID(), gap, n, 10, teamId, conditions, userId]);
    await assert.rejects(runtime.query('COMMIT'), error => error.code === '23514'); await runtime.query('ROLLBACK');
    await runtime.query('UPDATE "RoutingRule" SET status=\'ARCHIVED\',"archivedAt"=now(),version=version+1 WHERE id=$1', [ruleId]);
    await rejected(runtime, 'UPDATE "RoutingRule" SET status=\'ACTIVE\',"archivedAt"=NULL,version=version+1 WHERE id=$1', [ruleId]);
    assert.equal((await runtime.query('SELECT count(*) FROM "RoutingRuleRevision" WHERE "ruleId"=$1', [ruleId])).rows[0].count, '1');
    checks.push({ baseline, result: 'PASS', path: baseline === 11 ? 'fresh1→11' : baseline === 10 ? 'M20 10→11' : baseline === 9 ? 'M19 9→10→11' : 'V1.2 7→8→9→10→11', upgrades, privileges, constraints: 'FK/unique/typed JSON/priority/status/contiguity/immutable/lifecycle PASS', runtimeDdlDenied: true, fallback: 'NOT IMPLEMENTED — optional', historicalMigrations: 'byte-identical' });
  } finally { await runtime.end(); await owner.end(); }
}, { baseline });
const finalDeveloper = new Client({ connectionString: process.env.DATABASE_URL }); await finalDeveloper.connect();
try { assert.deepEqual(await history(finalDeveloper), developerBefore); } finally { await finalDeveloper.end(); }
await saveEvidence('docs/v1.3/evidence/M21_DATABASE.json', { checkedAt: new Date().toISOString(), result: 'PASS', synthetic: true, migration: m21Migration, migrationCount: 11, checks, developerMigrations: 7, developerMetadataReadOnly: true, developerDatabaseModified: false });
console.log(JSON.stringify({ event: 'm21.database', result: 'PASS', checks, developerMigrations: 7 }));
