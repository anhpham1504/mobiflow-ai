import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {spawnSync} from 'node:child_process';
import {Client,Pool} from 'pg';
import {parseApiEnvironment} from '@mobiflow/config';
import {createApplication} from '../../apps/api/dist/app.js';
import {AnalysisWorker} from '../../apps/api/dist/ai/analysis-worker.js';
import {RagHealth} from '../../apps/api/dist/knowledge/rag-health.js';

const env=parseApiEnvironment(process.env),base=process.env.VERIFY_API_URL??'http://localhost:3001',target=process.env.M5_RUNTIME_TARGET??'native';
const evidence={checkedAt:new Date().toISOString(),target,result:'FAIL',checks:[],ragRun:null,offline:null,nonRag:null};
let isolatedDatabaseUrl=null,isolatedAdmin=null;
const record=(name,details)=>{evidence.checks.push({name,result:'PASS',details});console.log('PASS '+name);};
async function callAt(origin,token,path,body,expected=body===undefined?200:201){
  const response=await fetch(origin+'/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{Origin:env.WEB_ORIGIN,'X-CSRF-Protection':'1','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();assert.equal(response.status,expected,path+' '+JSON.stringify(result));return result.data;
}
const login=(origin,email)=>callAt(origin,null,'/auth/login',{email,password:'MobiFlowDemo!2026'},200).then(r=>r.accessToken);
async function terminal(origin,manager,requestId){
  const until=Date.now()+310000;while(Date.now()<until){const result=await callAt(origin,manager,'/requests/'+requestId+'/ai/explanation');if(result.job&&['SUCCEEDED','FAILED','CANCELED'].includes(result.job.status))return result;await delay(1000);}throw Error('M5 analysis deadline exceeded');
}
async function prepareIsolatedDatabase(){
  if(isolatedDatabaseUrl)return isolatedDatabaseUrl;
  assert.ok(process.env.MIGRATION_DATABASE_URL,'MIGRATION_DATABASE_URL is required');const owner=new URL(process.env.MIGRATION_DATABASE_URL),app=new URL(env.DATABASE_URL),name='mobiflow_m2_test';
  assert.ok(['localhost','127.0.0.1'].includes(owner.hostname)&&['localhost','127.0.0.1'].includes(app.hostname),'Runtime test database must be loopback local');
  const adminUrl=new URL(owner);adminUrl.pathname='/postgres';const ownerTest=new URL(owner);ownerTest.pathname='/'+name;const appTest=new URL(app);appTest.pathname='/'+name;
  isolatedAdmin=new Client({connectionString:adminUrl.toString()});await isolatedAdmin.connect();
  await isolatedAdmin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${name}' AND pid<>pg_backend_pid()`);await isolatedAdmin.query(`DROP DATABASE IF EXISTS ${name}`);await isolatedAdmin.query(`CREATE DATABASE ${name}`);
  const run=(args,extra)=>{const result=spawnSync(process.execPath,args,{cwd:process.cwd(),env:{...process.env,...extra},stdio:'pipe',encoding:'utf8'});if(result.status!==0)throw Error('Isolated database setup failed: '+result.stderr.slice(-1000));};
  run(['scripts/dev/prisma.mjs','migrate','deploy'],{MIGRATION_DATABASE_URL:ownerTest.toString()});run(['scripts/dev/seed.mjs'],{DATABASE_URL:appTest.toString(),DEMO_MODE:'true'});
  isolatedDatabaseUrl=appTest.toString();return isolatedDatabaseUrl;
}
async function isolated(mode){
  const localEnv=parseApiEnvironment({...process.env,NODE_ENV:'test',DATABASE_URL:await prepareIsolatedDatabase(),AI_AUTO_ANALYZE:'false',AI_RAG_ENABLED:String(mode==='offline'),...(mode==='offline'?{EMBEDDING_BASE_URL:'http://127.0.0.1:1',EMBEDDING_TIMEOUT_MS:'250'}:{})});
  const service=await createApplication(localEnv,{quiet:true,log:()=>{},aiWorker:false,knowledgeWorker:false});
  try{
    await service.app.listen(0,'127.0.0.1');const origin=await service.app.getUrl(),[user,manager]=await Promise.all([login(origin,'user@mobiflow.local'),login(origin,'manager@mobiflow.local')]);
    const request=await callAt(origin,user,'/requests',{title:'M5 '+mode+' runtime '+Date.now(),description:'17 SIM IoT tại KCN Amata mất kết nối từ 8 giờ.'});
    const job=await callAt(origin,manager,'/requests/'+request.id+'/ai/analyze',{expectedVersion:request.version},202);
    for(let i=0;i<4;i++){await service.app.get(AnalysisWorker).tick();const current=await service.prisma.aiRun.findUnique({where:{id:job.aiRunId}});if(current&&['SUCCEEDED','FAILED','CANCELED'].includes(current.status))break;}
    const result=await terminal(origin,manager,request.id),detail=await callAt(origin,manager,'/requests/'+request.id);
    if(mode==='offline'){
      await service.app.get(RagHealth).refresh();const ready=await(await fetch(origin+'/health/ready')).json();
      assert.equal(result.job.status,'FAILED');assert.equal(result.job.errorCode,'EMBEDDING_UNAVAILABLE');assert.equal(detail.status,'NEW');assert.equal(ready.data.coreReady,true);assert.equal(ready.data.components.OLLAMA_SERVER.status,'UP');assert.equal(ready.data.components.OLLAMA_EMBEDDING_MODEL.status,'DOWN');assert.equal(ready.data.rag.status,'NOT_READY');
      const messaged=await callAt(origin,user,'/requests/'+request.id+'/messages',{expectedVersion:detail.version,body:'Tiếp tục xử lý thủ công khi embedding không khả dụng.'});assert.equal(messaged.version,detail.version+1);
      return {runId:job.aiRunId,errorCode:result.job.errorCode,requestStatus:detail.status,manualMessageVersion:messaged.version,readiness:ready.data};
    }
    assert.equal(result.job.status,'SUCCEEDED',result.job.errorCode);assert.equal(result.grounding.mode,'NON_RAG');assert.equal(result.grounding.evidenceStatus,'NOT_REQUESTED');assert.deepEqual(result.grounding.citations,[]);
    return {runId:job.aiRunId,status:result.job.status,grounding:result.grounding};
  }finally{await service.app.close();await service.database.close();await service.prisma.$disconnect();}
}

const pool=new Pool({connectionString:env.DATABASE_URL});
try{
  const readyResponse=await fetch(base+'/api/v1/health/ready',{signal:AbortSignal.timeout(10000)});assert.equal(readyResponse.status,200);const ready=(await readyResponse.json()).data;
  assert.equal(ready.coreReady,true);assert.equal(ready.components.OLLAMA_EMBEDDING_MODEL.status,'UP');assert.equal(ready.rag.enabled,true);assert.equal(ready.rag.status,'READY');record('truthful live RAG readiness',ready);
  const counts=(await pool.query(`SELECT (SELECT count(*)::int FROM "KnowledgeDocument" WHERE status='READY') documents,(SELECT count(*)::int FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d.id=c."documentId" WHERE d.status='READY' AND d."activeGeneration"=c.generation) chunks,(SELECT count(DISTINCT d."activeGeneration")::int FROM "KnowledgeDocument" d WHERE d.status='READY') active_versions`)).rows[0];assert.ok(counts.documents>=9);assert.ok(counts.chunks>=12);record('active synthetic corpus persisted',counts);
  const openapi=await(await fetch(base+'/api/docs-json')).json();for(const path of ['/api/v1/knowledge/documents','/api/v1/knowledge/documents/{id}','/api/v1/knowledge/documents/{id}/content','/api/v1/knowledge/documents/{id}/reindex','/api/v1/knowledge/documents/{id}/disable','/api/v1/knowledge/sources/{id}'])assert.ok(openapi.paths[path]);record('knowledge routes published in OpenAPI',{routes:6,version:openapi.info.version});
  const [user,manager,staff]=await Promise.all([login(base,'user@mobiflow.local'),login(base,'manager@mobiflow.local'),login(base,'staff.iot@mobiflow.local')]);
  const forbidden=await fetch(base+'/api/v1/knowledge/documents',{headers:{Authorization:'Bearer '+user},signal:AbortSignal.timeout(10000)});assert.equal(forbidden.status,403);
  const documents=await callAt(base,manager,'/knowledge/documents?limit=100');const first=documents.find(document=>document.status==='READY');assert.ok(first?.sources===undefined);const detail=await callAt(base,manager,'/knowledge/documents/'+first.id);assert.ok(detail.sources.length);const sourceId=detail.sources[0].sourceId;assert.equal((await fetch(base+'/api/v1/knowledge/sources/'+sourceId,{headers:{Authorization:'Bearer '+staff}})).status,200);record('knowledge RBAC and bounded metadata projection',{userList:403,staffSource:200,sourceId});
  const request=await callAt(base,user,'/requests',{title:'M5 runtime '+target+' '+Date.now(),description:'17 SIM IoT tại KCN Amata mất kết nối từ 8 giờ.'});let explanation=await callAt(base,manager,'/requests/'+request.id+'/ai/explanation');if(!explanation.job)await callAt(base,manager,'/requests/'+request.id+'/ai/analyze',{expectedVersion:request.version},202);explanation=await terminal(base,manager,request.id);
  assert.equal(explanation.job.status,'SUCCEEDED',explanation.job.errorCode);assert.equal(explanation.grounding.mode,'RAG');assert.ok(explanation.grounding.citations.length>0);for(const citation of explanation.grounding.citations){assert.equal((await fetch(base+'/api/v1/knowledge/sources/'+encodeURIComponent(citation.sourceId),{headers:{Authorization:'Bearer '+manager}})).status,200);}
  const owner=await callAt(base,user,'/requests/'+request.id+'/ai/explanation');assert.equal('grounding' in owner,false);const run=(await pool.query('SELECT "retrievalSnapshotJson","safeResultJson","latencyMs","promptVersion" FROM "AiRun" WHERE id=$1',[explanation.job.aiRunId])).rows[0];assert.ok(run.retrievalSnapshotJson.sources.length);evidence.ragRun={requestId:request.id,runId:explanation.job.aiRunId,sourceIds:run.retrievalSnapshotJson.sources.map(s=>s.sourceId),citations:run.safeResultJson.citations,latencyMs:run.latencyMs,promptVersion:run.promptVersion};record('real persisted RAG with authorized citations',evidence.ragRun);
  const retrieval=JSON.parse(readFileSync('docs/verification/evidence/M5_RETRIEVAL_EVAL.json','utf8'));assert.equal(retrieval.metrics.noAnswer,retrieval.metrics.negative);record('no-match queries return no invented source',{negativeCases:retrieval.metrics.negative,noAnswer:retrieval.metrics.noAnswer});
  evidence.nonRag=await isolated('non-rag');record('M4 non-RAG path remains explicit and successful',evidence.nonRag);
  evidence.offline=await isolated('offline');record('embedding outage fails RAG closed while manual workflow and core stay live',evidence.offline);
  evidence.result='PASS';
}finally{
  await pool.end();
  if(isolatedAdmin){const name='mobiflow_m2_test';await isolatedAdmin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${name}' AND pid<>pg_backend_pid()`);await isolatedAdmin.query(`DROP DATABASE IF EXISTS ${name}`);await isolatedAdmin.end();}
  mkdirSync('docs/verification/evidence',{recursive:true});writeFileSync('docs/verification/evidence/M5_RUNTIME_'+target.toUpperCase()+'.json',JSON.stringify(evidence,null,2)+'\n');
}
