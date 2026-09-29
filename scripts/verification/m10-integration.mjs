import {spawnSync} from 'node:child_process';
import {Client} from 'pg';
import {safeDatabaseTarget,DEMO_MARKER_ACTION,DEMO_MARKER_ID} from '../demo/release-core.mjs';

const ownerUrl=process.env.MIGRATION_DATABASE_URL,appUrl=process.env.DATABASE_URL,testDatabase='mobiflow_m10_test';
if(!ownerUrl||!appUrl)throw new Error('Both migration and runtime database URLs are required.');
safeDatabaseTarget(new URL(`/mobiflow`,ownerUrl).toString(),{demoMode:'true'});
const ownerAdmin=new URL(ownerUrl);ownerAdmin.pathname='/postgres';const ownerTest=new URL(ownerUrl);ownerTest.pathname=`/${testDatabase}`;const appTest=new URL(appUrl);appTest.pathname=`/${testDatabase}`;
safeDatabaseTarget(ownerTest.toString(),{demoMode:'true'});safeDatabaseTarget(appTest.toString(),{demoMode:'true'});
const run=(args,env)=>{const result=spawnSync(process.execPath,args,{cwd:process.cwd(),env:{...process.env,...env},stdio:'inherit'});if(result.status!==0)throw new Error(`Command failed: node ${args.join(' ')}`);};
const admin=new Client({connectionString:ownerAdmin.toString()});await admin.connect();
try{
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${testDatabase}' AND pid<>pg_backend_pid()`);await admin.query(`DROP DATABASE IF EXISTS ${testDatabase}`);await admin.query(`CREATE DATABASE ${testDatabase}`);
  run(['scripts/dev/prisma.mjs','migrate','deploy'],{MIGRATION_DATABASE_URL:ownerTest.toString()});
  run(['scripts/dev/seed.mjs'],{DATABASE_URL:appTest.toString(),DEMO_MODE:'true'});run(['scripts/dev/seed.mjs'],{DATABASE_URL:appTest.toString(),DEMO_MODE:'true'});
  const owner=new Client({connectionString:ownerTest.toString()}),runtime=new Client({connectionString:appTest.toString()});await owner.connect();await runtime.connect();
  try{
    const result=(await owner.query('SELECT (SELECT count(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) migrations,(SELECT count(*)::int FROM "User") users,(SELECT count(*)::int FROM "Request" WHERE "publicCode" LIKE \'MF-DEMO-%\') requests,(SELECT count(*)::int FROM "RequestStatusHistory") histories,(SELECT count(*)::int FROM "Assignment") assignments,(SELECT count(*)::int FROM "RequestResolution") resolutions,(SELECT count(*)::int FROM "Feedback") feedback,(SELECT count(*)::int FROM "RequestEmbedding") embeddings,(SELECT count(*)::int FROM "AuditLog" WHERE id=$1::uuid AND action=$2) marker',[DEMO_MARKER_ID,DEMO_MARKER_ACTION])).rows[0];
    const expected={migrations:6,users:6,requests:8,marker:1,embeddings:0};for(const [key,value] of Object.entries(expected))if(Number(result[key])!==value)throw new Error(`M10 seed invariant failed: ${key}`);
    if(Number(result.histories)<8||Number(result.assignments)<5||Number(result.resolutions)<3||Number(result.feedback)!==2)throw new Error('M10 historical workflow invariants failed.');
    const coherence=(await owner.query(`SELECT
      (SELECT count(*)::int FROM "Notification") notifications,
      (SELECT count(*)::int FROM "Request" WHERE subcategory='IOT_CONNECTIVITY' AND "createdAt">now()-interval '30 minutes') recent_iot,
      (SELECT count(*)::int FROM "RequestStatusHistory" WHERE "createdAt">now()) future_history,
      (SELECT count(*)::int FROM "Request" r WHERE NOT EXISTS (SELECT 1 FROM "RequestStatusHistory" h WHERE h."requestId"=r.id AND h."requestVersion"=r.version AND h."toStatus"=r.status)) missing_final_history,
      (SELECT count(*)::int FROM "Request" r JOIN "SlaInstance" s ON s."requestId"=r.id WHERE r.status IN ('RESOLVED','CLOSED') AND (s.status<>'MET' OR s."resolvedHoldAt" IS DISTINCT FROM r."resolvedAt")) invalid_resolved_sla`)).rows[0];
    if(coherence.notifications!==8||coherence.recent_iot!==2||coherence.future_history!==0||coherence.missing_final_history!==0||coherence.invalid_resolved_sla!==0)throw new Error('M10 seed chronology, SLA, notification or recent similarity prerequisite failed.');
    let denied=false;try{await runtime.query('UPDATE "AuditLog" SET reason=reason WHERE id=$1::uuid',[DEMO_MARKER_ID]);}catch(error){denied=error.code==='42501';}if(!denied)throw new Error('Runtime principal unexpectedly updated append-only audit data.');
    console.log(JSON.stringify({event:'m10.integration.complete',database:testDatabase,counts:result,coherence,auditUpdateDenied:denied,seedIdempotent:true}));
  }finally{await runtime.end();await owner.end();}
  run(['--test','scripts/demo/release-core.test.mjs'],{});
}finally{
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${testDatabase}' AND pid<>pg_backend_pid()`);await admin.query(`DROP DATABASE IF EXISTS ${testDatabase}`);await admin.end();
}
