import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Client} from 'pg';
import {readFileSync} from 'node:fs';
import {withM22Database,migrationNames,m22Migration} from './m22-database.mjs';
import {saveEvidence} from './evidence.mjs';
const baselineSha='758caf220fc0a672e5d9a9e5d6f47653e6478fa2';
assert.equal(migrationNames.length,12);assert.equal(migrationNames[11],m22Migration);
for(const name of migrationNames.slice(0,11)){
  const path='apps/api/prisma/migrations/'+name+'/migration.sql';assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8',windowsHide:true}).trim(),execFileSync('git',['rev-parse',baselineSha+':'+path],{encoding:'utf8',windowsHide:true}).trim());
}
const history=async c=>(await c.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
async function snapshot(c){const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename")).rows,data={};for(const {tablename} of tables){assert.match(tablename,/^[A-Za-z]+$/);data[tablename]=(await c.query('SELECT row_to_json(t) AS row FROM "'+tablename+'" t ORDER BY row_to_json(t)::text')).rows.map(r=>r.row);}return data;}
function preserved(before,after){for(const [table,rows] of Object.entries(before)){assert.equal(after[table].length,rows.length,table);for(const row of rows){assert.ok(after[table].some(next=>Object.keys(row).every(key=>JSON.stringify(next[key])===JSON.stringify(row[key]))),table+' original values');for(const next of after[table])for(const key of Object.keys(next).filter(k=>!(k in row)))assert.equal(next[key],null);}}}
async function rejected(c,sql,params=[],codes=['23514']){await c.query('BEGIN');try{await assert.rejects(async()=>{await c.query(sql,params);await c.query('COMMIT');},e=>codes.includes(e.code));}finally{await c.query('ROLLBACK');}}
const devBefore=JSON.parse(readFileSync('artifacts/m22/runtime-baseline.json')).developerMigrations;assert.equal(devBefore.length,7);
const checks=[];
for(const baseline of [12,11,7])await withM22Database(async({ownerUrl,databaseUrl,migrate})=>{
  const owner=new Client({connectionString:ownerUrl}),runtime=new Client({connectionString:databaseUrl});await owner.connect();await runtime.connect();
  try{
    const requestId=(await owner.query('SELECT id FROM "Request" ORDER BY id LIMIT 1')).rows[0].id,managerId=(await owner.query('SELECT id FROM "User" WHERE role=\'MANAGER\' ORDER BY id LIMIT 1')).rows[0].id,teamId=(await owner.query('SELECT id FROM "Team" WHERE active ORDER BY id LIMIT 1')).rows[0].id;
    const upgrades=[];async function upgrade(count){const before=await snapshot(owner),old=await history(owner);migrate(count);preserved(before,await snapshot(owner));assert.deepEqual((await history(owner)).slice(0,old.length),old);upgrades.push({from:old.length,to:count,tables:Object.keys(before).length,rows:Object.values(before).reduce((n,r)=>n+r.length,0)});}
    if(baseline===7)await upgrade(8);
    const noteId=randomUUID();await owner.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)',[noteId,requestId,managerId,'Synthetic M22 preserved private note 🙂']);
    if(baseline===7)await upgrade(9);
    await owner.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)',[noteId,managerId]);await owner.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)',[requestId,managerId]);
    const eventId=randomUUID();await owner.query('INSERT INTO "AuditLog"(id,"actorType",action,"resourceType","resourceId","requestCorrelationId",outcome) VALUES($1,\'SYSTEM\',\'INTERNAL_NOTE_CREATED\',\'RequestInternalNote\',$2,$3,\'SUCCEEDED\')',[eventId,noteId,randomUUID()]);
    await owner.query('INSERT INTO "Notification"(id,"recipientId","requestId","eventId",type,"safeActorMetadataJson") VALUES($1,$2,$3,$4,\'INTERNAL_NOTE_MENTION\',$5)',[randomUUID(),managerId,requestId,eventId,{noteId}]);
    if(baseline===7)await upgrade(10);
    const templateId=randomUUID(),revisionId=randomUUID();await owner.query('BEGIN');await owner.query('INSERT INTO "OperationalTemplate"(id,type,name,"createdById","updatedAt") VALUES($1,\'RESPONSE\',\'Preserved template\',$2,now())',[templateId,managerId]);await owner.query('INSERT INTO "OperationalTemplateRevision"(id,"templateId",revision,name,"body","itemCount","createdById") VALUES($1,$2,1,\'Preserved template\',\'Synthetic preserved response\',0,$3)',[revisionId,templateId,managerId]);await owner.query('UPDATE "Request" SET "manualDraftSourceTemplateRevisionId"=$1 WHERE id=$2',[revisionId,requestId]);await owner.query('COMMIT');
    if(baseline===7)await upgrade(11);
    const ruleId=randomUUID();await owner.query('BEGIN');await owner.query('INSERT INTO "RoutingRule"(id,"createdById","updatedAt") VALUES($1,$2,now())',[ruleId,managerId]);await owner.query('INSERT INTO "RoutingRuleRevision"(id,"ruleId",revision,name,priority,"targetTeamId",conditions,"createdById") VALUES($1,$2,1,\'Preserved routing\',10,$3,$4,$5)',[randomUUID(),ruleId,teamId,JSON.stringify([{field:'priority',operator:'EQ',values:['HIGH']}]),managerId]);await owner.query('COMMIT');
    if(baseline!==12)await upgrade(12);
    assert.deepEqual((await history(owner)).map(r=>r.migration_name),migrationNames);
    const sla=(await owner.query('SELECT id,"requestId" FROM "SlaInstance" ORDER BY id LIMIT 1')).rows[0];
    const alertId=randomUUID(),auditId=randomUUID();await runtime.query('INSERT INTO "AuditLog"(id,"actorType",action,"resourceType","resourceId","requestCorrelationId",outcome) VALUES($1,\'SYSTEM\',\'SLA_REMINDER_EMITTED\',\'SlaOperationalAlert\',$2,$1,\'SUCCEEDED\')',[auditId,alertId]);
    const insert='INSERT INTO "SlaOperationalAlert"(id,"requestId","slaInstanceId",dimension,"eventType","thresholdKey","canonicalState","deadlineAt","elapsedSeconds","remainingSeconds","targetSeconds","observedAt","configIdentity","eventId") VALUES($1,$2,$3,$4,\'SLA_REMINDER\',$5,\'SAFE\',now(),50,50,100,now(),\'synthetic-config\',$6)';
    const params=[alertId,sla.requestId,sla.id,'RESOLUTION','EARLY_REMINDER_PRIMARY',auditId];await runtime.query(insert,params);
    await rejected(runtime,insert,[randomUUID(),...params.slice(1)],['23505']);await rejected(runtime,insert,[randomUUID(),sla.requestId,sla.id,null,'EARLY_REMINDER_PRIMARY',randomUUID()],['23502']);
    await rejected(runtime,insert,[randomUUID(),sla.requestId,sla.id,'OTHER','EARLY_REMINDER_PRIMARY',randomUUID()]);await rejected(runtime,insert,[randomUUID(),requestId===sla.requestId?randomUUID():requestId,sla.id,'RESOLUTION','EARLY_REMINDER_PRIMARY',randomUUID()],['23503']);
    await rejected(runtime,'UPDATE "SlaOperationalAlert" SET "configIdentity"=\'changed\' WHERE id=$1',[alertId],['42501']);await rejected(owner,'UPDATE "SlaOperationalAlert" SET "configIdentity"=\'changed\' WHERE id=$1',[alertId]);await rejected(owner,'DELETE FROM "SlaOperationalAlert" WHERE id=$1',[alertId]);
    await rejected(runtime,'DELETE FROM "SlaOperationalAlert" WHERE id=$1',[alertId],['42501']);await rejected(runtime,'TRUNCATE "SlaOperationalAlert"',[],['42501']);await rejected(runtime,'CREATE TABLE m22_forbidden(id int)',[],['42501']);await rejected(runtime,'UPDATE "SlaAlertScanProgress" SET id=\'other\'',[],['42501']);
    const notice='INSERT INTO "Notification"(id,"recipientId","requestId","eventId",type,"safeActorMetadataJson","slaInstanceId","warningLevel","slaAlertId") VALUES($1,$2,$3,$4,\'SLA_REMINDER\',\'{"actorType":"SYSTEM"}\',$5,\'REMINDER\',$6)';
    await runtime.query(notice,[randomUUID(),managerId,sla.requestId,auditId,sla.id,alertId]);await rejected(runtime,notice,[randomUUID(),managerId,sla.requestId,auditId,sla.id,alertId],['23505']);await rejected(runtime,notice,[randomUUID(),managerId,requestId===sla.requestId?randomUUID():requestId,auditId,sla.id,alertId]);
    const privileges=(await owner.query("SELECT has_table_privilege('mobiflow_app','\"SlaOperationalAlert\"','SELECT') AS read,has_table_privilege('mobiflow_app','\"SlaOperationalAlert\"','INSERT') AS insert,has_table_privilege('mobiflow_app','\"SlaOperationalAlert\"','UPDATE') AS update,has_table_privilege('mobiflow_app','\"SlaOperationalAlert\"','DELETE') AS delete")).rows[0];assert.deepEqual(privileges,{read:true,insert:true,update:false,delete:false});
    checks.push({baseline,result:'PASS',path:baseline===12?'fresh1→12':baseline===11?'M21 11→12':'V1.2 7→8→9→10→11→12',upgrades,privileges,constraints:'NOT NULL/FK/cycle-level uniqueness/snapshot/type/delivery source/immutable PASS',runtimeDdlDenied:true,historicalMigrations:'byte-identical'});
  }finally{await runtime.end();await owner.end();}
},{baseline});
await saveEvidence('docs/v1.3/evidence/M22_DATABASE.json',{checkedAt:new Date().toISOString(),result:'PASS',synthetic:true,migration:m22Migration,migrationCount:12,checks,developerMigrations:7,developerMetadata:'Host runtime-baseline snapshot; rechecked by final host gate',developerDatabaseModified:false,isolatedPort:55422});console.log(JSON.stringify({event:'m22.database',result:'PASS',checks}));
