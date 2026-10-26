import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const project='mobiflow-m3-rehearsal';
const root='artifacts/m3';
const runtimeDirectory=root+'/runtime';
const manifestPath=root+'/runtime-private.json';
const envPath=root+'/runtime.env';
const compatibilityPath='artifacts/m24/runtime-private.json';
const compose=['compose','--env-file',envPath,'-p',project,'-f','docker-compose.yml','-f','scripts/verification/docker-compose.m3.yml'];
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,maxBuffer:20e6}).trim();
const sha=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('hex');
const action=process.argv[2];

function currentOfficial(){
  const ids=docker('ps','-q','--filter','name=mobiflow-ngrok-demo-20261010-').split(/\r?\n/u).filter(Boolean);
  return ids.map(id=>{const value=JSON.parse(docker('inspect',id))[0];return {id:value.Id,name:value.Name,image:value.Config.Image,startedAt:value.State.StartedAt,running:value.State.Running,ports:value.NetworkSettings.Ports};}).sort((a,b)=>a.name.localeCompare(b.name));
}
function readManifest(){const value=JSON.parse(readFileSync(manifestPath,'utf8'));assert.equal(value.project,project);return value;}
function runtimeEnvironment(){return Object.fromEntries(readFileSync(envPath,'utf8').split(/\r?\n/u).filter(Boolean).map(line=>{const split=line.indexOf('=');assert.ok(split>0);return [line.slice(0,split),line.slice(split+1)];}));}
function composeRun(extraEnv,...args){const child=spawnSync('docker',[...compose,...args],{cwd:process.cwd(),env:{...process.env,...runtimeEnvironment(),...extraEnv},stdio:'inherit',windowsHide:true});assert.equal(child.status,0,`docker compose ${args.join(' ')}`);}
async function waitUrl(url,expected=200){for(let attempt=0;attempt<90;attempt++){try{const response=await fetch(url,{signal:AbortSignal.timeout(3000)});if(response.status===expected)return;}catch(error){void error;}await delay(1000);}throw new Error(`Runtime readiness timed out: ${url}`);}

if(action==='prepare'){
  assert.ok(!existsSync(manifestPath),'M3 runtime manifest already exists; inspect instead of overwriting');
  assert.ok(!existsSync(compatibilityPath),'M24 compatibility manifest already exists; inspect instead of overwriting');
  assert.equal(docker('ps','-aq','--filter',`label=com.docker.compose.project=${project}`),'','M3 project already exists');
  const official=currentOfficial();assert.equal(official.length,4,'Expected four official demo containers before M3 isolation');
  const owner=secret(),app=secret();
  const env={COMPOSE_PROJECT_NAME:project,POSTGRES_PASSWORD:owner,POSTGRES_APP_PASSWORD:app,POSTGRES_PORT:'55449',API_PORT:'35411',WEB_PORT:'35410',WEB_ORIGIN:'http://127.0.0.1:35410',NEXT_PUBLIC_API_BASE_URL:'http://127.0.0.1:35411/api/v1',JWT_SECRET:secret(),REFRESH_TOKEN_SECRET:secret(),AUTH_COOKIE_SECURE:'false',AI_GENERATION_PROVIDER:'deepseek',AI_PROVIDER:'deepseek',RAG_RETRIEVAL_MODE:'lexical',AI_LIVE_CALLS_ENABLED:'false',DEEPSEEK_CANARY_GUARD_ENABLED:'false',DEEPSEEK_BUDGET_USD:'0.50',DEEPSEEK_MAX_CALLS_PER_PROCESS:'20',DEEPSEEK_MAX_REQUESTS_PER_MINUTE:'10',DEEPSEEK_MAX_CONCURRENT_REQUESTS:'1',DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_BASE_URL:'https://api.deepseek.com/',DEEPSEEK_PRICE_CACHE_HIT_INPUT_PER_MILLION_USD:'0.006',DEEPSEEK_PRICE_CACHE_MISS_INPUT_PER_MILLION_USD:'0.30',DEEPSEEK_PRICE_OUTPUT_PER_MILLION_USD:'1.20',DEEPSEEK_PRICING_EFFECTIVE_DATE:'2026-10-24',AI_GENERATION_MAX_ATTEMPTS:'1',AI_AUTO_ANALYZE:'true',AI_RAG_ENABLED:'true',DEMO_MODE:'true'};
  mkdirSync(runtimeDirectory,{recursive:true});mkdirSync('artifacts/m24',{recursive:true});
  writeFileSync(envPath,Object.entries(env).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600});
  const database=`postgresql://mobiflow_app:${app}@127.0.0.1:55449/mobiflow`,migration=`postgresql://mobiflow_owner:${owner}@127.0.0.1:55449/mobiflow`;
  const manifest={project,preparedAt:new Date().toISOString(),ports:{postgres:55449,api:35411,web:35410},DATABASE_URL:database,MIGRATION_DATABASE_URL:migration,officialBaseline:official,envSha256:sha(readFileSync(envPath)),keyConfigured:Boolean(process.env.DEEPSEEK_API_KEY),keyValueStored:false};
  writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  writeFileSync(compatibilityPath,JSON.stringify({project,DATABASE_URL:database,MIGRATION_DATABASE_URL:migration},null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({event:'m3.prepare',result:'PASS',project,ports:manifest.ports,officialContainers:official.length,keyConfigured:manifest.keyConfigured,keyValueStored:false}));
}else if(action==='build'){
  readManifest();composeRun({},'config','--quiet');composeRun({},'build','api','web');
  console.log(JSON.stringify({event:'m3.build',result:'PASS',project}));
}else if(action==='database'){
  const manifest=readManifest();composeRun({},'up','-d','--wait','postgres');
  const childEnv={...process.env,DATABASE_URL:manifest.DATABASE_URL,MIGRATION_DATABASE_URL:manifest.MIGRATION_DATABASE_URL,DEMO_MODE:'true',NODE_ENV:'test'};
  for(const args of [['run','db:migrate'],['run','demo:seed']]){const child=spawnSync('npm',args,{cwd:process.cwd(),env:childEnv,stdio:'inherit',shell:true,windowsHide:true});assert.equal(child.status,0,`npm ${args.join(' ')}`);}
  console.log(JSON.stringify({event:'m3.database',result:'PASS',project}));
}else if(action==='start-offline'){
  readManifest();composeRun({AI_LIVE_CALLS_ENABLED:'false',DEEPSEEK_CANARY_GUARD_ENABLED:'false'},'up','-d','--wait','api','web');await waitUrl('http://127.0.0.1:35411/health/ready');await waitUrl('http://127.0.0.1:35410');
  console.log(JSON.stringify({event:'m3.start-offline',result:'PASS',project}));
}else if(action==='start-live'){
  const manifest=readManifest();assert.equal(manifest.keyConfigured,true,'M3 key was not safely present at preparation');assert.ok(process.env.DEEPSEEK_API_KEY,'DeepSeek key missing from current secret environment');assert.ok(existsSync(runtimeDirectory+'/ledger.json'),'First live canary ledger is required before application live mode');
  composeRun({AI_LIVE_CALLS_ENABLED:'true',DEEPSEEK_CANARY_GUARD_ENABLED:'true'},'up','-d','--force-recreate','api');await waitUrl('http://127.0.0.1:35411/health/ready');
  console.log(JSON.stringify({event:'m3.start-live',result:'PASS',project,ledgerPreserved:true}));
}else if(action==='verify-official'){
  const manifest=readManifest();assert.deepEqual(currentOfficial(),manifest.officialBaseline);console.log(JSON.stringify({event:'m3.official-unchanged',result:'PASS',containers:manifest.officialBaseline.length}));
}else if(action==='stop'){
  const manifest=readManifest();for(const name of ['postgres','api','web']){const id=docker('ps','-aq','--filter',`name=^/${project}-${name}-1$`);if(id)assert.equal(docker('inspect','--format','{{ index .Config.Labels "com.docker.compose.project" }}',id),project);}
  composeRun({},'down','--volumes');assert.equal(docker('ps','-aq','--filter',`label=com.docker.compose.project=${project}`),'');assert.deepEqual(currentOfficial(),manifest.officialBaseline);
  rmSync(compatibilityPath,{force:true});console.log(JSON.stringify({event:'m3.stop',result:'PASS',project,officialUnchanged:true}));
}else throw new Error('Expected prepare, build, database, start-offline, start-live, verify-official, or stop');
