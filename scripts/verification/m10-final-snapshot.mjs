import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {saveEvidence} from './evidence.mjs';
import {DEMO_PASSWORD} from '../demo/seed-data.mjs';
import {jsonRequest,ollamaInventory,REQUIRED_LLM,REQUIRED_EMBEDDING} from '../demo/release-core.mjs';

const compose=execFileSync('docker',['compose','ps','--format','json'],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).map(line=>JSON.parse(line));
const services=Object.fromEntries(['postgres','api','web'].map(name=>{const row=compose.find(item=>item.Service===name);assert.equal(row?.Health,'healthy',name);return [name,{state:row.State,health:row.Health,image:row.Image}];}));
const health=await jsonRequest('http://localhost:3001/health/ready',{timeout:15000});assert.equal(health.response.status,200);assert.equal(health.body.data.coreReady,true);assert.equal(health.body.data.aiReady,true);assert.equal(health.body.data.rag.status,'READY');
const web=await fetch('http://localhost:3000',{signal:AbortSignal.timeout(10000)});assert.equal(web.status,200);
const inventory=await ollamaInventory(process.env.OLLAMA_BASE_URL);assert.ok(inventory.has(REQUIRED_LLM));assert.ok(inventory.has(REQUIRED_EMBEDDING));
const client=new Client({connectionString:process.env.MIGRATION_DATABASE_URL});await client.connect();let counts,migrations;
try{
  counts=(await client.query(`SELECT
    (SELECT count(*)::int FROM "User") users,(SELECT count(*)::int FROM "Request") requests,
    (SELECT count(*)::int FROM "RequestStatusHistory") histories,(SELECT count(*)::int FROM "Assignment") assignments,
    (SELECT count(*)::int FROM "RequestResolution") resolutions,(SELECT count(*)::int FROM "Feedback") feedback,
    (SELECT count(*)::int FROM "Notification") notifications,(SELECT count(*)::int FROM "AiRun") ai_runs,
    (SELECT count(*)::int FROM "RequestEmbedding") request_embeddings,
    (SELECT count(*)::int FROM "KnowledgeDocument" WHERE status='READY') ready_documents,
    (SELECT count(*)::int FROM "KnowledgeChunk") chunks`)).rows[0];
  for(const [name,value] of Object.entries({users:6,requests:8,histories:39,assignments:6,resolutions:3,feedback:2,request_embeddings:8,ai_runs:0}))assert.equal(counts[name],value,name);
  assert.ok(counts.notifications>=8);assert.ok(counts.ready_documents>=9);assert.ok(counts.chunks>=12);
  migrations=(await client.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows.map(row=>row.migration_name);assert.equal(migrations.length,6);
}finally{await client.end();}
const login=await jsonRequest('http://localhost:3001/api/v1/auth/login',{timeout:10000,method:'POST',headers:{Origin:'http://localhost:3000','X-CSRF-Protection':'1','Content-Type':'application/json'},body:JSON.stringify({email:'manager@mobiflow.local',password:DEMO_PASSWORD})});
const dashboard=await jsonRequest('http://localhost:3001/api/v1/analytics?windowDays=30',{timeout:10000,headers:{Authorization:'Bearer '+login.body.data.accessToken}});
const latest=JSON.parse(readFileSync('docs/evaluation/results/m9-2026-09-29T16-42-23-764Z.json','utf8')).snapshot;
assert.equal(dashboard.body.data.evaluations[0].runId,latest.runId,'Docker evaluation snapshot is obsolete');
const evidence={at:new Date().toISOString(),runtimeStatus:'PASS',releaseGate:'BLOCKED',releaseBlocker:'M10 live evaluation comparison remains RED; see M10_EVAL_REGRESSION.json',services,apiHttp:health.response.status,webHttp:web.status,coreReady:true,aiReady:true,ragStatus:health.body.data.rag.status,counts,migrations,models:{llm:{name:REQUIRED_LLM,...inventory.get(REQUIRED_LLM)},embedding:{name:REQUIRED_EMBEDDING,...inventory.get(REQUIRED_EMBEDDING),dimension:1024}},dashboardSnapshot:{runId:latest.runId,finishedAt:latest.finishedAt,passed:latest.passed.count},git:{branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),committed:false,pushed:false,tagged:false}};
await saveEvidence('docs/verification/evidence/M10_DOCKER.json',evidence);
console.log(JSON.stringify(evidence));
