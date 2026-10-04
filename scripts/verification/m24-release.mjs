import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {saveEvidence} from './evidence.mjs';
import {sourceInventory} from './m24-source.mjs';
const project='mobiflow-m24-release',manifest='artifacts/m24/release-private.json',action=process.argv[2];
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,maxBuffer:20e6}).trim();
if(action==='prepare'){
 assert.ok(!existsSync(manifest));assert.equal(docker('ps','-aq','--filter','label=com.docker.compose.project='+project),'');
 const secret=()=>randomBytes(32).toString('hex');const owner=secret(),app=secret();
 const env={COMPOSE_PROJECT_NAME:project,POSTGRES_PASSWORD:owner,POSTGRES_APP_PASSWORD:app,JWT_SECRET:secret(),REFRESH_TOKEN_SECRET:secret(),POSTGRES_PORT:'55425',API_PORT:'33601',WEB_PORT:'33600',WEB_ORIGIN:'http://localhost:33600',NEXT_PUBLIC_API_BASE_URL:'http://localhost:33601/api/v1',OLLAMA_MODEL:'unconfigured',OLLAMA_EMBEDDING_MODEL:'unconfigured',AI_RAG_ENABLED:'false',AI_AUTO_ANALYZE:'false',AUTH_COOKIE_SECURE:'false',SLA_ALERT_ENABLED:'true',SLA_ALERT_INTERVAL_SECONDS:'30',SLA_ALERT_BATCH_SIZE:'2'};
 mkdirSync('artifacts/m24',{recursive:true});writeFileSync(manifest,JSON.stringify({project,env}));
 writeFileSync('artifacts/m24/release.env',Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n');
 writeFileSync('artifacts/m24/release-seed.env',Object.entries({NODE_ENV:'test',DEMO_MODE:'true',DATABASE_URL:`postgresql://mobiflow_app:${app}@127.0.0.1:5432/mobiflow`,MIGRATION_DATABASE_URL:`postgresql://mobiflow_owner:${owner}@127.0.0.1:5432/mobiflow`,DEMO_SEED_REFERENCE_TIME:'2026-10-04T00:00:00.000Z'}).map(([k,v])=>k+'='+v).join('\n')+'\n');
 console.log(JSON.stringify({event:'m24.release-prepare',result:'PASS',project,ports:[55425,33601,33600]}));
}else{
 const {env,project:owner}=JSON.parse(readFileSync(manifest));assert.equal(owner,project);
 const args=['compose','--env-file','artifacts/m24/release.env','-p',project,'-f','docker-compose.yml','-f','scripts/verification/docker-compose.m24-release.yml'];
 async function compose(label,...command){
   const log='artifacts/m24/'+label+'-'+Date.now()+'.log',fd=openSync(log,'w');
   const c=spawn('docker',[...args,...command],{env:{...process.env,...env},stdio:['ignore',fd,fd],windowsHide:true});
   const code=await new Promise((r,j)=>{c.on('error',j);c.on('exit',r);});closeSync(fd);
   console.log(JSON.stringify({command:'docker '+[...args,...command].join(' '),exitCode:code,log}));assert.equal(code,0,label);
 }
 if(action==='build'){await compose('compose-config','config','--quiet');await compose('compose-build','build','api','web');}
 else if(action==='database'){
   await compose('release-postgres','up','-d','--wait','postgres');
   execFileSync('docker',['run','--rm','--name',project+'-seed','--label','mobiflow.milestone=M24','--network','container:'+project+'-postgres-1','--env-file','artifacts/m24/release-seed.env','--mount','type=volume,source=mobiflow-m24-verification-work,target=/work','--mount','type=bind,source='+resolve('artifacts/m24')+',target=/evidence','-w','/work','node:24.19.0-bookworm-slim','node','scripts/verification/m24-release-seed.mjs'],{stdio:'inherit',windowsHide:true});
 }
 else if(action==='start'){
   await compose('release-start','up','-d','--wait','api','web');
   const ready=await fetch('http://localhost:33601/health/ready');assert.equal(ready.status,200);const health=await ready.json();
   await saveEvidence('docs/v1.3/evidence/M24_RUNTIME.json',{checkedAt:new Date().toISOString(),result:'PASS',project,production:true,source:sourceInventory(),health});console.log(JSON.stringify({event:'m24.production-start',health}));
 }
 else if(action==='stop'){
   for(const service of ['postgres','api','web'])assert.equal(docker('inspect','--format','{{ index .Config.Labels "com.docker.compose.project" }}',project+'-'+service+'-1'),project);
   await compose('release-cleanup','down','--volumes');assert.equal(docker('ps','-aq','--filter','label=com.docker.compose.project='+project),'');assert.equal(docker('volume','ls','-q','--filter','label=com.docker.compose.project='+project),'');
 }else throw new Error('Expected prepare/build/database/start/stop');
}
