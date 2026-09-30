import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {DEMO_PASSWORD,demoRequestIds,users} from '../demo/seed-data.mjs';
import {DEMO_MARKER_ID,DEMO_MARKER_ACTION,jsonRequest,portOpen,safeDatabaseTarget} from '../demo/release-core.mjs';
import {git,saveNew} from '../evaluation/capture-release-environment.mjs';

const mode=process.argv[2];assert.ok(['pre-reset','final'].includes(mode));
const owner=safeDatabaseTarget(process.env.MIGRATION_DATABASE_URL,{demoMode:process.env.DEMO_MODE});
const runtime=safeDatabaseTarget(process.env.DATABASE_URL,{demoMode:process.env.DEMO_MODE});assert.deepEqual(owner,runtime);
const client=new Client({connectionString:process.env.MIGRATION_DATABASE_URL});await client.connect();
let counts,migrations;
try{
  const marker=await client.query('SELECT count(*)::int n FROM "AuditLog" WHERE id=$1::uuid AND action=$2',[DEMO_MARKER_ID,DEMO_MARKER_ACTION]);assert.equal(marker.rows[0].n,1);
  const requestIds=(await client.query('SELECT id FROM "Request" ORDER BY id')).rows.map(r=>r.id);
  assert.deepEqual(requestIds,demoRequestIds().sort(),'Unknown request outside the declared demo set');
  const actualUsers=(await client.query('SELECT id,email FROM "User" ORDER BY id')).rows;
  assert.deepEqual(actualUsers,users.map(u=>({id:u[0],email:u[1]})).sort((a,b)=>a.id.localeCompare(b.id)),'Unknown user outside the synthetic demo set');
  counts=(await client.query(`SELECT
    (SELECT count(*)::int FROM "User") users,(SELECT count(*)::int FROM "Request") requests,
    (SELECT count(*)::int FROM "RequestStatusHistory") histories,(SELECT count(*)::int FROM "Assignment") assignments,
    (SELECT count(*)::int FROM "RequestResolution") resolutions,(SELECT count(*)::int FROM "Feedback") feedback,
    (SELECT count(*)::int FROM "Notification") notifications,(SELECT count(*)::int FROM "AiRun") ai_runs,
    (SELECT count(*)::int FROM "RequestEmbedding" WHERE embedding IS NOT NULL) request_embeddings,
    (SELECT count(*)::int FROM "KnowledgeDocument" WHERE status='READY') ready_documents,
    (SELECT count(*)::int FROM "KnowledgeDocument" WHERE status<>'READY') non_ready_documents,
    (SELECT count(*)::int FROM "KnowledgeChunk" WHERE embedding IS NOT NULL) embedded_chunks`)).rows[0];
  migrations=(await client.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows.map(r=>r.migration_name);
  assert.equal(migrations.length,6);
}finally{await client.end();}
if(mode==='pre-reset'){
  assert.equal(await portOpen('127.0.0.1',3001,500),false,'Stop API before reset');
  const result={at:new Date().toISOString(),target:owner,explicitDemoMode:true,knownSyntheticUsersOnly:true,knownSyntheticRequestsOnly:true,markerVerified:true,apiStopped:true,counts,migrations,storageDeletion:false};
  saveNew('docs/verification/evidence/V1_RESET_TARGET.json',result);console.log(JSON.stringify(result));
}else{
  for(const [key,value] of Object.entries({users:6,requests:8,histories:39,assignments:6,resolutions:3,feedback:2,notifications:8,ai_runs:0,request_embeddings:8,non_ready_documents:0}))assert.equal(counts[key],value,key);
  assert.ok(counts.ready_documents>=9);assert.ok(counts.embedded_chunks>=12);
  const compose=execFileSync('docker',['compose','ps','--format','json'],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).map(line=>JSON.parse(line));
  const services=Object.fromEntries(['postgres','api','web'].map(name=>{const row=compose.find(r=>r.Service===name);assert.equal(row?.Health,'healthy',name);return [name,{state:row.State,health:row.Health,image:row.Image}];}));
  const health=await jsonRequest('http://localhost:3001/health/ready',{timeout:15000});assert.equal(health.response.status,200);assert.equal(health.body.data.coreReady,true);assert.equal(health.body.data.aiReady,true);assert.equal(health.body.data.rag.status,'READY');
  const web=await fetch('http://localhost:3000',{signal:AbortSignal.timeout(10000)});assert.equal(web.status,200);
  const login=await jsonRequest('http://localhost:3001/api/v1/auth/login',{timeout:10000,method:'POST',headers:{Origin:'http://localhost:3000','X-CSRF-Protection':'1','Content-Type':'application/json'},body:JSON.stringify({email:'manager@mobiflow.local',password:DEMO_PASSWORD})});
  const dashboard=await jsonRequest('http://localhost:3001/api/v1/analytics?windowDays=30',{timeout:10000,headers:{Authorization:'Bearer '+login.body.data.accessToken}});
  const latest=JSON.parse(readFileSync('docs/verification/evidence/V1_AI_EVALUATION.json','utf8')).snapshot;
  assert.equal(dashboard.body.data.evaluations[0].runId,latest.runId,'Docker evaluation snapshot is obsolete');
  const result={at:new Date().toISOString(),runtimeStatus:'PASS',releaseGate:'AWAITING_FINAL_REVIEW',services,apiHttp:200,webHttp:200,coreReady:true,aiReady:true,ragStatus:'READY',counts,migrations,dashboardSnapshot:{runId:latest.runId,finishedAt:latest.finishedAt,passed:latest.passed.count},git:{head:git('rev-parse','HEAD'),branch:git('branch','--show-current')}};
  saveNew('docs/verification/evidence/V1_DOCKER.json',result);console.log(JSON.stringify(result));
}
