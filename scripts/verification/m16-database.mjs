import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Client} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../apps/api/dist/generated/prisma/client.js';
import {seedDemo,DEMO_USER_ID} from '../demo/seed-data.mjs';
import {expectedMigrationNames} from '../demo/release-core.mjs';
import {mkdirSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';

const ownerUrl=new URL(process.env.MIGRATION_DATABASE_URL),runtimeUrl=new URL(process.env.DATABASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(ownerUrl.hostname)&&ownerUrl.port==='54616'&&ownerUrl.pathname==='/mobiflow','M16 requires its isolated PostgreSQL port/database');
assert.equal(runtimeUrl.port,ownerUrl.port);assert.equal(process.env.DEMO_MODE,'true');
const client=new Client({connectionString:ownerUrl.toString()}),prisma=new PrismaClient({adapter:new PrismaPg({connectionString:runtimeUrl.toString()})}),checks=[];
const check=(name,detail={})=>{checks.push({name,status:'PASS',...detail});console.log('PASS '+name);};
await client.connect();
const names=expectedMigrationNames();assert.equal(names.length,7);
const snapshot=async()=>({requests:await prisma.request.findMany({orderBy:{id:'asc'}}),counts:await client.query('SELECT (SELECT count(*)::int FROM "AuditLog") audits,(SELECT count(*)::int FROM "Assignment") assignments,(SELECT count(*)::int FROM "RequestStatusHistory") histories,(SELECT count(*)::int FROM "Feedback") feedback'),users:await prisma.user.findMany({orderBy:{id:'asc'},select:{id:true,passwordHash:true}})});
const normalize=x=>({requests:x.requests,counts:x.counts.rows,users:x.users.map(user=>({id:user.id,credentialFingerprint:createHash('sha256').update(user.passwordHash).digest('hex')}))});
const secondary='mobiflow_m16_migration_test';let created=false,auxiliary;
try{
  const vector=await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'");assert.equal(vector.rowCount,1);check('pgvector available',{version:vector.rows[0].extversion});
  const history=await client.query('SELECT migration_name,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name');
  assert.equal(history.rows.length,7);assert.deepEqual(history.rows.filter(r=>r.finished_at&&!r.rolled_back_at).map(r=>r.migration_name),names);check('empty database migrated 1 through 7',{migrations:names});
  const before=normalize(await snapshot());await seedDemo(prisma,{databaseUrl:runtimeUrl.toString(),now:new Date('2026-10-01T00:00:00Z')});assert.deepEqual(normalize(await snapshot()),before);check('repeat seed preserves requests histories feedback and password hashes');
  const result=spawnSync(process.execPath,['scripts/dev/prisma.mjs','migrate','deploy'],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0);assert.deepEqual(normalize(await snapshot()),before);check('repeated migration startup preserves business rows');
  const permission=await client.query("SELECT has_table_privilege('mobiflow_app','\"Request\"','SELECT') readable,has_database_privilege('mobiflow_app','mobiflow','CREATE') can_create");assert.equal(permission.rows[0].readable,true);assert.equal(permission.rows[0].can_create,false);check('runtime role reads business data without database CREATE');
  assert.equal((await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[secondary])).rowCount,0,'Refuse an existing migration fixture');
  await client.query('CREATE DATABASE mobiflow_m16_migration_test');created=true;
  const url=new URL(ownerUrl);url.pathname='/'+secondary;auxiliary=new Client({connectionString:url.toString()});await auxiliary.connect();
  for(const name of names.slice(0,-1))await auxiliary.query(readFileSync('apps/api/prisma/migrations/'+name+'/migration.sql','utf8'));
  const old=new PrismaClient({adapter:new PrismaPg({connectionString:url.toString()})});
  try{
    const source=await prisma.user.findUniqueOrThrow({where:{id:DEMO_USER_ID}}),requestId=randomUUID(),runId=randomUUID(),recommendationId=randomUUID();
    await old.user.create({data:{id:source.id,email:source.email,displayName:'Synthetic V1 migration fixture',passwordHash:source.passwordHash,role:'USER'}});
    await old.request.create({data:{id:requestId,publicCode:'MF-M16-LEGACY',createdById:source.id,title:'Synthetic V1 compatibility',description:'Synthetic persisted V1 request read after upgrade.'}});
    await old.aiRun.create({data:{id:runId,requestId,purpose:'RECOMMENDATION',contextVersion:1,provider:'ollama',promptVersion:'synthetic.v1',schemaVersion:'recommendation.v1',status:'SUCCEEDED'}});
    await old.aiRecommendation.create({data:{id:recommendationId,requestId,aiRunId:runId,suggestedPriority:'MEDIUM',procedureRefsJson:[],actionsJson:[],similarCaseAlertJson:{detected:false,count:0},evidenceStatus:'INSUFFICIENT_EVIDENCE',reasonSummary:'Synthetic V1 persisted fixture; database compatibility only.',confidence:0.625}});
    assert.equal((await auxiliary.query("SELECT is_nullable FROM information_schema.columns WHERE table_name='AiRecommendation' AND column_name='confidence'")).rows[0].is_nullable,'NO');
    await auxiliary.query(readFileSync('apps/api/prisma/migrations/'+names.at(-1)+'/migration.sql','utf8'));
    const preserved=await old.aiRecommendation.findUniqueOrThrow({where:{id:recommendationId}});assert.equal(preserved.confidence.toString(),'0.625');assert.equal((await old.request.findUniqueOrThrow({where:{id:requestId}})).description,'Synthetic persisted V1 request read after upgrade.');
    await old.aiRecommendation.update({where:{id:recommendationId},data:{confidence:null}});assert.equal((await old.aiRecommendation.findUniqueOrThrow({where:{id:recommendationId}})).confidence,null);
    check('M14 upgrade preserves V1 confidence and permits V2 null',{scope:'real PostgreSQL record/schema compatibility; no new V1 AI-quality evaluation'});
  }finally{await old.$disconnect();}
  // A failed migration belongs only to a temporary schema on the auxiliary synthetic DB.
  mkdirSync('artifacts/m16/migration-fault/migrations/20261001000000_injected_failure',{recursive:true});mkdirSync('artifacts/m16/migration-fault/migrations/20261001000100_must_not_run',{recursive:true});
  cpSync('apps/api/prisma/migrations/migration_lock.toml','artifacts/m16/migration-fault/migrations/migration_lock.toml');
  writeFileSync('artifacts/m16/migration-fault/migrations/20261001000000_injected_failure/migration.sql','SELECT * FROM m16_intentionally_absent_table;\n');writeFileSync('artifacts/m16/migration-fault/migrations/20261001000100_must_not_run/migration.sql','CREATE TABLE m16_must_not_exist(id integer);\n');
  writeFileSync('artifacts/m16/migration-fault/prisma.config.ts',"import {defineConfig,env} from 'prisma/config'; export default defineConfig({schema:'../../../apps/api/prisma/schema.prisma',migrations:{path:'migrations'},datasource:{url:env('MIGRATION_DATABASE_URL')}});\n");
  url.searchParams.set('schema','m16_failure');
  const fault=spawnSync(process.execPath,['scripts/dev/prisma.mjs','migrate','deploy','--config','artifacts/m16/migration-fault/prisma.config.ts'],{env:{...process.env,MIGRATION_DATABASE_URL:url.toString()},encoding:'utf8',windowsHide:true});
  assert.notEqual(fault.status,0);assert.equal((await auxiliary.query("SELECT to_regclass('m16_failure.m16_must_not_exist') present")).rows[0].present,null);assert.equal((await auxiliary.query('SELECT finished_at FROM m16_failure."_prisma_migrations"')).rows[0].finished_at,null);
  check('Prisma migration failure exits nonzero and later migration does not execute',{exitCode:fault.status});
  assert.deepEqual(normalize(await snapshot()),before);check('migration fault cannot affect the isolated demo business DB');
}finally{
  await prisma.$disconnect();if(auxiliary)await auxiliary.end();
  // This name is fixed; creation was verified above in the M16-only PostgreSQL cluster.
  if(created)await client.query('DROP DATABASE mobiflow_m16_migration_test');await client.end();
  mkdirSync('artifacts/m16/reports',{recursive:true});writeFileSync('artifacts/m16/reports/DATABASE.json',JSON.stringify({checkedAt:new Date().toISOString(),result:checks.length===8?'PASS':'FAIL',synthetic:true,migrationCount:7,schemaChanged:false,migrationAdded:false,checks},null,2)+'\n');
}
