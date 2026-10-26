import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Client} from 'pg';
import {readFileSync} from 'node:fs';
import {withM24Database,migrationNames,m24Migration,v13Migration} from './m24-database.mjs';
import {saveEvidence} from './evidence.mjs';
import {createReleaseHarness} from '../../apps/api/test/helpers/release-hardening-fixture.mjs';
const baselineSha='4735afafe7cda4dbf98bdd387cc2fd49db22f764';
assert.equal(migrationNames.length,14);assert.equal(migrationNames[12],m24Migration);assert.equal(migrationNames[13],v13Migration);
for(const name of migrationNames){
  const path='apps/api/prisma/migrations/'+name+'/migration.sql',reference=name===v13Migration?'9e90c438e351d4a46eec4f717681a5c67a871722':baselineSha;assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8',windowsHide:true}).trim(),execFileSync('git',['rev-parse',reference+':'+path],{encoding:'utf8',windowsHide:true}).trim());
}
const history=async c=>(await c.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
async function snapshot(c){const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename")).rows,data={};for(const {tablename} of tables){assert.match(tablename,/^[A-Za-z]+$/);data[tablename]=(await c.query('SELECT row_to_json(t) AS row FROM "'+tablename+'" t ORDER BY row_to_json(t)::text')).rows.map(r=>r.row);}return data;}
function preserved(before,after){for(const [table,rows] of Object.entries(before)){assert.equal(after[table].length,rows.length,table);for(const row of rows){assert.ok(after[table].some(next=>Object.keys(row).every(key=>JSON.stringify(next[key])===JSON.stringify(row[key]))),table+' original values');for(const next of after[table])for(const key of Object.keys(next).filter(k=>!(k in row)))assert.equal(next[key],null);}}}
async function rejected(c,sql,params=[],codes=['23514']){await c.query('BEGIN');try{await assert.rejects(async()=>{await c.query(sql,params);await c.query('COMMIT');},e=>codes.includes(e.code));}finally{await c.query('ROLLBACK');}}
const devBefore=JSON.parse(readFileSync('artifacts/m24/runtime-baseline.json')).developerMigrations;assert.equal(devBefore.length,7);
const checks=[];
for(const baseline of [14,7])await withM24Database(async({ownerUrl,databaseUrl,migrate})=>{
  const owner=new Client({connectionString:ownerUrl}),runtime=new Client({connectionString:databaseUrl});await owner.connect();await runtime.connect();
  try{
    const requestId=(await owner.query('SELECT id FROM "Request" ORDER BY id LIMIT 1')).rows[0].id,managerId=(await owner.query('SELECT id FROM "User" WHERE role=\'MANAGER\' ORDER BY id LIMIT 1')).rows[0].id,teamId=(await owner.query('SELECT id FROM "Team" WHERE active ORDER BY id LIMIT 1')).rows[0].id;
    const upgrades=[];async function upgrade(count){const before=await snapshot(owner),old=await history(owner);migrate(count);preserved(before,await snapshot(owner));assert.deepEqual((await history(owner)).slice(0,old.length),old);upgrades.push({from:old.length,to:count,tables:Object.keys(before).length,rows:Object.values(before).reduce((n,r)=>n+r.length,0)});}
    if(baseline===7)await upgrade(8);
    const noteId=randomUUID();await owner.query('INSERT INTO "RequestInternalNote"(id,"requestId","authorId",body) VALUES($1,$2,$3,$4)',[noteId,requestId,managerId,'Synthetic M24 preserved private note 🙂']);
    if(baseline===7)await upgrade(9);
    await owner.query('INSERT INTO "RequestInternalNoteMention"("noteId","mentionedUserId") VALUES($1,$2)',[noteId,managerId]);await owner.query('INSERT INTO "RequestWatcher"("requestId","userId") VALUES($1,$2)',[requestId,managerId]);
    const eventId=randomUUID();await owner.query('INSERT INTO "AuditLog"(id,"actorType",action,"resourceType","resourceId","requestCorrelationId",outcome) VALUES($1,\'SYSTEM\',\'INTERNAL_NOTE_CREATED\',\'RequestInternalNote\',$2,$3,\'SUCCEEDED\')',[eventId,noteId,randomUUID()]);
    await owner.query('INSERT INTO "Notification"(id,"recipientId","requestId","eventId",type,"safeActorMetadataJson") VALUES($1,$2,$3,$4,\'INTERNAL_NOTE_MENTION\',$5)',[randomUUID(),managerId,requestId,eventId,{noteId}]);
    if(baseline===7)await upgrade(10);
    const templateId=randomUUID(),revisionId=randomUUID();await owner.query('BEGIN');await owner.query('INSERT INTO "OperationalTemplate"(id,type,name,"createdById","updatedAt") VALUES($1,\'RESPONSE\',\'Preserved template\',$2,now())',[templateId,managerId]);await owner.query('INSERT INTO "OperationalTemplateRevision"(id,"templateId",revision,name,"body","itemCount","createdById") VALUES($1,$2,1,\'Preserved template\',\'Synthetic preserved response\',0,$3)',[revisionId,templateId,managerId]);await owner.query('UPDATE "Request" SET "manualDraftSourceTemplateRevisionId"=$1 WHERE id=$2',[revisionId,requestId]);await owner.query('COMMIT');
    if(baseline===7)await upgrade(11);
    const ruleId=randomUUID();await owner.query('BEGIN');await owner.query('INSERT INTO "RoutingRule"(id,"createdById","updatedAt") VALUES($1,$2,now())',[ruleId,managerId]);await owner.query('INSERT INTO "RoutingRuleRevision"(id,"ruleId",revision,name,priority,"targetTeamId",conditions,"createdById") VALUES($1,$2,1,\'Preserved routing\',10,$3,$4,$5)',[randomUUID(),ruleId,teamId,JSON.stringify([{field:'priority',operator:'EQ',values:['HIGH']}]),managerId]);await owner.query('COMMIT');
    if(baseline===7)await upgrade(12);

    const sla=(await owner.query('SELECT id,"requestId" FROM "SlaInstance" ORDER BY id LIMIT 1')).rows[0];
    const alertId=randomUUID(),eventId2=randomUUID();
    await owner.query('INSERT INTO "AuditLog"(id,"actorType",action,"resourceType","resourceId","requestCorrelationId",outcome) VALUES($1,\'SYSTEM\',\'SLA_REMINDER_EMITTED\',\'SlaOperationalAlert\',$2,$1,\'SUCCEEDED\')',[eventId2,alertId]);
    await owner.query('INSERT INTO "SlaOperationalAlert"(id,"requestId","slaInstanceId",dimension,"eventType","thresholdKey","canonicalState","deadlineAt","elapsedSeconds","remainingSeconds","targetSeconds","observedAt","configIdentity","eventId") VALUES($1,$2,$3,\'RESOLUTION\',\'SLA_REMINDER\',\'EARLY_REMINDER_PRIMARY\',\'SAFE\',now(),50,50,100,now(),\'preserved-m22\',$4)',[alertId,sla.requestId,sla.id,eventId2]);
    if(baseline===7)await upgrade(13);
    if(baseline!==14)await upgrade(14);
    assert.deepEqual((await history(owner)).map(r=>r.migration_name),migrationNames);
    const id=randomUUID(),insert='INSERT INTO "SavedRequestView"(id,"ownerUserId",name,"normalizedName","schemaVersion",filters,version) VALUES($1,$2,$3,$4,$5,$6,$7)',params=[id,managerId,'Đã lưu','đã lưu','saved-request-view.v1',JSON.stringify({status:'IN_PROGRESS'}),1];
    const oldRequest=(await owner.query('SELECT row_to_json(r) AS row FROM "Request" r WHERE id=$1',[requestId])).rows[0].row;
    await runtime.query(insert,params);
    await rejected(runtime,insert,[randomUUID(),...params.slice(1)],['23505']);
    await rejected(runtime,insert,[randomUUID(),randomUUID(),'Foreign','foreign',params[4],'{}',1],['23503']);
    await rejected(runtime,insert,[randomUUID(),managerId,'Zero','zero',params[4],'{}',0]);
    await rejected(runtime,insert,[randomUUID(),managerId,'x'.repeat(81),'long',params[4],'{}',1]);
    await rejected(runtime,insert,[randomUUID(),managerId,'Array','array',params[4],'[]',1]);
    await rejected(runtime,insert,[randomUUID(),managerId,null,'null',params[4],'{}',1],['23502']);
    await rejected(runtime,'UPDATE "SavedRequestView" SET "ownerUserId"=$1 WHERE id=$2',[randomUUID(),id],['42501']);
    await rejected(runtime,'UPDATE "SavedRequestView" SET "createdAt"=now() WHERE id=$1',[id],['42501']);
    await rejected(runtime,'TRUNCATE "SavedRequestView"',[],['42501']);await rejected(runtime,'CREATE TABLE m24_forbidden(id int)',[],['42501']);
    const updated=await runtime.query('UPDATE "SavedRequestView" SET version=version+1,name=\'Updated\',"normalizedName"=\'updated\',"updatedAt"=now() WHERE id=$1 AND version=1 RETURNING version',[id]);assert.equal(updated.rows[0].version,2);
    assert.equal((await runtime.query('DELETE FROM "SavedRequestView" WHERE id=$1 AND version=1',[id])).rowCount,0);
    assert.equal((await runtime.query('DELETE FROM "SavedRequestView" WHERE id=$1 AND version=2',[id])).rowCount,1);
    assert.deepEqual((await owner.query('SELECT row_to_json(r) AS row FROM "Request" r WHERE id=$1',[requestId])).rows[0].row,oldRequest);
    const privileges=(await owner.query("SELECT has_table_privilege('mobiflow_app','\"SavedRequestView\"','SELECT') AS read,has_table_privilege('mobiflow_app','\"SavedRequestView\"','INSERT') AS insert,has_column_privilege('mobiflow_app','\"SavedRequestView\"','name','UPDATE') AS update_name,has_column_privilege('mobiflow_app','\"SavedRequestView\"','ownerUserId','UPDATE') AS update_owner,has_table_privilege('mobiflow_app','\"SavedRequestView\"','DELETE') AS delete")).rows[0];assert.deepEqual(privileges,{read:true,insert:true,update_name:true,update_owner:false,delete:true});
    const app=await createReleaseHarness(databaseUrl);try{for(const role of ['user','staff','manager'])assert.equal((await app.call(app[role].token,'/dashboard/'+role)).status,200);assert.equal((await app.call(app.manager.token,'/requests/'+requestId)).status,200);}finally{await app.close();}
    checks.push({baseline,result:'PASS',path:baseline===14?'fresh1→14':'V1.2 7→8→9→10→11→12→13→14',upgrades,privileges,constraints:'PK/NOT NULL/FK/normalized uniqueness/name/JSON/version PASS',runtimeDdlDenied:true,historicalMigrations:'all14 byte-identical to their authorized baselines',currentApplicationThreeRoleLoginDashboardAndPreservedRequest:'PASS'});
  }finally{await runtime.end();await owner.end();}
},{baseline});
await saveEvidence('docs/v1.3/evidence/M24_DATABASE.json',{checkedAt:new Date().toISOString(),result:'PASS',synthetic:true,migration:v13Migration,migrationCount:14,checks,developerMigrations:7,developerMetadata:'Host runtime-baseline snapshot; rechecked by final host gate',developerDatabaseModified:false,isolatedPort:55424});console.log(JSON.stringify({event:'m24.database',result:'PASS',checks}));
