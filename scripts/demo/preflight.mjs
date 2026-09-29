import {existsSync,statfsSync} from 'node:fs';
import {Client} from 'pg';
import {check,command,evidencePath,finalStatus,jsonRequest,ollamaCapability,ollamaInventory,portOpen,printChecks,validateReleaseConfig,writeEvidence,DEMO_MARKER_ACTION,DEMO_MARKER_ID,REQUIRED_EMBEDDING,REQUIRED_LLM} from './release-core.mjs';

const checks=validateReleaseConfig(process.env),versions={};
const add=(section,name,ok,pass,fail)=>checks.push(check(section,name,ok?'PASS':'FAIL',ok?pass:fail));
const runVersion=(name,file,args,pattern)=>{
  const result=command(file,args,{timeout:10000}),version=(result.stdout||result.stderr).split(/\r?\n/)[0];versions[name]=version;
  add('Toolchain',name,result.ok&&pattern.test(version),version||'available','missing or unsupported');
};
runVersion('Node',process.execPath,['--version'],/^v24\./);
if(process.env.npm_execpath)runVersion('npm',process.execPath,[process.env.npm_execpath,'--version'],/^11\./);else add('Toolchain','npm',false,'','npm execution path unavailable; run through npm scripts');
runVersion('Docker','docker',['--version'],/Docker version/i);
runVersion('Compose','docker',['compose','version'],/Docker Compose version/i);
add('Generated client','Prisma client',existsSync('apps/api/src/generated/prisma/client.ts'),'generated client present','run npm run prisma:generate');
try{
  const disk=statfsSync(process.cwd()),freeBytes=disk.bavail*disk.bsize;
  add('Storage','workspace disk reserve',freeBytes>=64*1024*1024,`${Math.floor(freeBytes/1024/1024)} MiB available`,'less than 64 MiB available');
}catch{add('Storage','workspace disk reserve',false,'','disk capacity unavailable');}
const storage=command('docker',['compose','exec','-T','api','node','-e',"const fs=require('node:fs');fs.accessSync('/app/storage/knowledge',fs.constants.R_OK|fs.constants.W_OK);const s=fs.statfsSync('/app/storage/knowledge');process.exit(s.bavail*s.bsize>=67108864?0:1)"],{timeout:10000});
add('Storage','private Docker knowledge volume',storage.ok,'read/write access and 64 MiB reserve verified','volume unavailable, unwritable, or below reserve');

const compose=command('docker',['compose','ps','--format','json'],{timeout:15000});
if(compose.ok){
  const services=compose.stdout.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  for(const name of ['postgres','api','web']){
    const service=services.find(item=>item.Service===name),healthy=service?.State==='running'&&service?.Health==='healthy';
    add('Containers',name,healthy,`${name} running and healthy`,`${name} missing, stopped, or unhealthy`);
  }
}else for(const name of ['postgres','api','web'])add('Containers',name,false,'',`${name} status unavailable`);

const databaseUrl=process.env.MIGRATION_DATABASE_URL??process.env.DATABASE_URL;
if(databaseUrl){
  const database=new Client({connectionString:databaseUrl,connectionTimeoutMillis:5000});
  try{
    await database.connect();add('Database','connectivity',true,'connection accepted','');
    const vector=(await database.query("SELECT extversion FROM pg_extension WHERE extname='vector'"));
    add('Database','pgvector',vector.rowCount===1,`extension ${vector.rows[0]?.extversion??'present'}`,'extension absent');
    const migrations=await database.query('SELECT migration_name,finished_at,rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name');
    const disk=command('powershell',['-NoProfile','-Command','Get-ChildItem apps/api/prisma/migrations -Directory | Sort-Object Name | Select-Object -ExpandProperty Name'],{timeout:5000}).stdout.split(/\r?\n/).filter(Boolean);
    const completed=migrations.rows.filter(row=>row.finished_at&&!row.rolled_back_at).map(row=>row.migration_name);
    add('Database','migration history',completed.length===6&&JSON.stringify(completed)===JSON.stringify(disk)&&migrations.rows.length===completed.length,'exactly six completed migrations match disk','missing, failed, rolled back, or unexpected migrations');
    const marker=await database.query('SELECT 1 FROM "AuditLog" WHERE id=$1::uuid AND action=$2 LIMIT 1',[DEMO_MARKER_ID,DEMO_MARKER_ACTION]);
    add('Demo data','synthetic marker',marker.rowCount===1,'exact reset marker present','marker absent; reset is not authorized');
    const counts=(await database.query('SELECT (SELECT count(*)::int FROM "User") users,(SELECT count(*)::int FROM "Request") requests,(SELECT count(*)::int FROM "RequestStatusHistory") histories,(SELECT count(*)::int FROM "RequestEmbedding") request_embeddings,(SELECT count(*)::int FROM "KnowledgeDocument" WHERE status=\'READY\') ready_documents,(SELECT count(*)::int FROM "KnowledgeChunk" kc JOIN "KnowledgeDocument" kd ON kd.id=kc."documentId" WHERE kd.status=\'READY\' AND kc.embedding IS NOT NULL) embedded_chunks')).rows[0];
    add('Demo data','accounts and history',counts.users>=6&&counts.requests>=8&&counts.histories>=8,`${counts.users} accounts, ${counts.requests} requests, ${counts.histories} history rows`,'seeded accounts or workflow history incomplete');
    add('Demo data','request similarity index',counts.request_embeddings>=8,`${counts.request_embeddings} real request embeddings`,'historical request embeddings incomplete');
    add('RAG','ready corpus',counts.ready_documents>0&&counts.embedded_chunks>0,`${counts.ready_documents} ready documents, ${counts.embedded_chunks} embedded chunks`,'run npm run knowledge:ingest');
  }catch{add('Database','connectivity',false,'','connection or verification failed');}finally{await database.end().catch(()=>{});}
}else add('Database','connectivity',false,'','database URL not configured');

for(const [name,host,port] of [['PostgreSQL','127.0.0.1',5432],['API','127.0.0.1',Number(process.env.API_PORT??3001)],['Web','127.0.0.1',3000]])add('Ports',name,await portOpen(host,port),`${host}:${port} reachable`,`${host}:${port} unavailable`);
try{
  const {response,body}=await jsonRequest(`http://127.0.0.1:${process.env.API_PORT??3001}/health/ready`,{timeout:10000});
  add('Runtime','API core readiness',body.data?.coreReady===true&&response.status===200,'database-backed API core ready','API core not ready');
  add('Runtime','AI readiness',body.data?.aiReady===true,'LLM and embedding components ready','AI dependencies degraded');
  add('RAG','API RAG health',body.data?.rag?.status==='READY','retrieval health ready',`retrieval health ${body.data?.rag?.status??'unknown'}`);
}catch{add('Runtime','API health contract',false,'','health endpoint unavailable or invalid');}
try{
  const web=await fetch('http://127.0.0.1:3000',{redirect:'error',signal:AbortSignal.timeout(5000)}),csp=web.headers.get('content-security-policy'),frame=web.headers.get('x-frame-options');
  add('Runtime','web reachability',web.ok,`HTTP ${web.status}`,`HTTP ${web.status}`);
  add('Security headers','web baseline',Boolean(csp)&&frame==='DENY'&&web.headers.get('x-content-type-options')==='nosniff','CSP, frame, and MIME protections present','required browser headers missing');
}catch{add('Runtime','web reachability',false,'','web endpoint unavailable');}
try{
  const inventory=await ollamaInventory(process.env.OLLAMA_BASE_URL,{timeout:10000});
  add('LLM','installed exact tag',inventory.has(REQUIRED_LLM),'exact model installed','exact model unavailable');
  add('Embedding','installed exact tag',inventory.has(REQUIRED_EMBEDDING),'exact model installed','exact model unavailable');
  add('LLM','completion capability',await ollamaCapability(process.env.OLLAMA_BASE_URL,REQUIRED_LLM,'completion',{timeout:10000}),'completion capability advertised','completion capability missing');
  add('Embedding','embedding capability',await ollamaCapability(process.env.EMBEDDING_BASE_URL??process.env.OLLAMA_BASE_URL,REQUIRED_EMBEDDING,'embedding',{timeout:10000}),'embedding capability advertised','embedding capability missing');
}catch{add('LLM','Ollama service',false,'','inventory or capability probe failed');}

const status=finalStatus(checks),evidence={schemaVersion:'m10.preflight.v1',generatedAt:new Date().toISOString(),status,versions,checks};
writeEvidence(evidencePath('M10_PREFLIGHT.json'),evidence);printChecks('MobiFlow AI M10 preflight',checks);console.log(`FINAL ${status}`);
if(status!=='PASS')process.exitCode=1;
