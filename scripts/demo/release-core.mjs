import {mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {connect} from 'node:net';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import releaseMetadata from '../../packages/config/src/release-metadata.json' with {type:'json'};

export const REQUIRED_LLM=releaseMetadata.rollbackProfile.generationModel;
export const REQUIRED_EMBEDDING=releaseMetadata.rollbackProfile.embeddingModel;
export const DEMO_MARKER_ID='a0000000-0000-4000-8000-000000000010';
export const DEMO_MARKER_ACTION='DEMO_BASELINE_SEEDED';
export const DEMO_DATABASES=new Set(['mobiflow','mobiflow_m2_test','mobiflow_m10_test']);
export const LOOPBACK_HOSTS=new Set(['localhost','127.0.0.1','::1']);

export function check(section,name,status,message){return {section,name,status,message};}
export function finalStatus(checks){return checks.some(item=>item.status==='FAIL')?'BLOCKED':'PASS';}

export function safeDatabaseTarget(value,{demoMode,allowedDatabases=DEMO_DATABASES}={}){
  if(demoMode!=='true')throw new Error('DEMO_MODE must be true.');
  let url;
  try{url=new URL(value);}catch{throw new Error('Database URL is invalid.');}
  const database=url.pathname.slice(1);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!LOOPBACK_HOSTS.has(url.hostname)||!allowedDatabases.has(database))throw new Error('Database target is not an allowlisted loopback demo database.');
  return {host:url.hostname,port:Number(url.port||5432),database};
}

function validOrigin(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/';}catch{return false;}
}
function unsafeSecret(value){return typeof value!=='string'||value.length<32||/change[_-]?me|placeholder|example|demo.?secret|test.?secret/i.test(value)||new Set(value).size<8;}

export function validateReleaseConfig(env){
  const checks=[];
  const required=['DATABASE_URL','MIGRATION_DATABASE_URL','JWT_SECRET','REFRESH_TOKEN_SECRET','WEB_ORIGIN','NEXT_PUBLIC_API_BASE_URL','AI_GENERATION_PROVIDER','RAG_RETRIEVAL_MODE'];
  for(const name of required)checks.push(check('Environment',name,env[name]?'PASS':'FAIL',env[name]?'configured':'not configured'));
  checks.push(check('Environment','DEMO_MODE',env.DEMO_MODE==='true'?'PASS':'FAIL',env.DEMO_MODE==='true'?'explicit demo mode':'must be true'));
  for(const name of ['DATABASE_URL','MIGRATION_DATABASE_URL']){
    try{safeDatabaseTarget(env[name],{demoMode:env.DEMO_MODE});checks.push(check('Database',name,'PASS','allowlisted loopback demo target'));}catch{checks.push(check('Database',name,'FAIL','unsafe or invalid target'));}
  }
  checks.push(check('Security config','JWT_SECRET',unsafeSecret(env.JWT_SECRET)?'FAIL':'PASS',unsafeSecret(env.JWT_SECRET)?'missing, placeholder, or weak pattern':'configured and non-placeholder'));
  checks.push(check('Security config','REFRESH_TOKEN_SECRET',unsafeSecret(env.REFRESH_TOKEN_SECRET)?'FAIL':'PASS',unsafeSecret(env.REFRESH_TOKEN_SECRET)?'missing, placeholder, or weak pattern':'configured and non-placeholder'));
  checks.push(check('Security config','distinct auth secrets',env.JWT_SECRET&&env.REFRESH_TOKEN_SECRET&&env.JWT_SECRET!==env.REFRESH_TOKEN_SECRET?'PASS':'FAIL','secret values are never printed'));
  const originOk=validOrigin(env.WEB_ORIGIN)&&!env.WEB_ORIGIN.includes('*');
  checks.push(check('Security config','WEB_ORIGIN',originOk?'PASS':'FAIL',originOk?'single explicit origin':'invalid or wildcard origin'));
  let cookieOk=false;
  try{const origin=new URL(env.WEB_ORIGIN);cookieOk=env.AUTH_COOKIE_SECURE==='true'||(origin.protocol==='http:'&&LOOPBACK_HOSTS.has(origin.hostname));}catch{cookieOk=false;}
  checks.push(check('Security config','auth cookie',cookieOk?'PASS':'FAIL',cookieOk?'secure or explicit loopback HTTP demo':'unsafe cookie/origin combination'));
  const deepseek=env.AI_GENERATION_PROVIDER==='deepseek'&&env.RAG_RETRIEVAL_MODE==='lexical',legacy=env.AI_GENERATION_PROVIDER==='ollama'&&env.RAG_RETRIEVAL_MODE==='vector';
  checks.push(check('AI','compatible provider/retrieval profile',deepseek||legacy?'PASS':'FAIL',deepseek?'DeepSeek generation with PostgreSQL lexical retrieval':legacy?'Ollama rollback with vector retrieval':'unsupported mixed profile'));
  if(deepseek){
    let origin=false;try{const url=new URL(env.DEEPSEEK_BASE_URL);origin=url.protocol==='https:'&&url.hostname==='api.deepseek.com'&&url.pathname==='/'&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{origin=false;}
    checks.push(check('AI','DeepSeek egress origin',origin?'PASS':'FAIL',origin?'official HTTPS origin allowlisted':'invalid or non-official DeepSeek origin'));
    checks.push(check('AI','billable-call gate',['true','false'].includes(env.AI_LIVE_CALLS_ENABLED)?'PASS':'FAIL',env.AI_LIVE_CALLS_ENABLED==='true'?'live calls explicitly enabled':'live calls disabled; owner approval pending'));
    checks.push(check('AI','backend key',env.AI_LIVE_CALLS_ENABLED==='true'?(env.DEEPSEEK_API_KEY?'PASS':'FAIL'):'PASS',env.AI_LIVE_CALLS_ENABLED==='true'?(env.DEEPSEEK_API_KEY?'configured without disclosure':'missing for enabled live calls'):'not required while live calls are disabled'));
  }else if(legacy){
    checks.push(check('LLM','configured rollback model',env.OLLAMA_MODEL===REQUIRED_LLM?'PASS':'FAIL',env.OLLAMA_MODEL===REQUIRED_LLM?'expected rollback tag':'unexpected tag'));
    checks.push(check('Embedding','configured rollback model',env.OLLAMA_EMBEDDING_MODEL===REQUIRED_EMBEDDING?'PASS':'FAIL',env.OLLAMA_EMBEDDING_MODEL===REQUIRED_EMBEDDING?'expected rollback tag':'unexpected tag'));
  }
  checks.push(check('Security config','RAG mode',env.AI_RAG_ENABLED==='true'?'PASS':'FAIL',env.AI_RAG_ENABLED==='true'?'enabled for grounded demo':'must be true for the competition flow'));
  return checks;
}

export function command(file,args,{timeout=10000,env=process.env}={}){
  const result=spawnSync(file,args,{cwd:process.cwd(),env,encoding:'utf8',timeout,windowsHide:true});
  return {ok:result.status===0,status:result.status,stdout:(result.stdout??'').trim(),stderr:(result.stderr??'').trim(),error:result.error?.code};
}

export async function portOpen(host,port,timeout=1500){
  return new Promise(resolve=>{
    const socket=connect({host,port});let settled=false;
    const finish=value=>{if(settled)return;settled=true;socket.destroy();resolve(value);};
    socket.setTimeout(timeout);socket.once('connect',()=>finish(true));socket.once('timeout',()=>finish(false));socket.once('error',()=>finish(false));
  });
}

export async function jsonRequest(url,{timeout=5000,...options}={}){
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(timeout),...options});
  const text=await response.text();let body;
  try{body=JSON.parse(text);}catch{throw new Error('INVALID_JSON_RESPONSE');}
  if(!response.ok)throw new Error(`HTTP_${response.status}`);
  return {response,body};
}

export async function ollamaInventory(origin,{timeout=5000}={}){
  const base=new URL(origin);const {body}=await jsonRequest(new URL('/api/tags',base),{timeout});
  if(!Array.isArray(body.models))throw new Error('INVALID_OLLAMA_INVENTORY');
  return new Map(body.models.filter(model=>model&&typeof model.name==='string').map(model=>[model.name,{digest:typeof model.digest==='string'?model.digest:null}]));
}

export async function ollamaCapability(origin,model,capability,{timeout=5000}={}){
  const {body}=await jsonRequest(new URL('/api/show',new URL(origin)),{timeout,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model})});
  return Array.isArray(body.capabilities)&&body.capabilities.includes(capability);
}

export function evidencePath(name){return resolve(process.cwd(),process.env.DEMO_EVIDENCE_ROOT??'docs/verification/evidence',name);}
export function expectedMigrationNames(){return readdirSync(new URL('../../apps/api/prisma/migrations/',import.meta.url),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();}
export function writeEvidence(path,data){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(data,null,2)+'\n','utf8');}

export function printChecks(title,checks){
  console.log(title);
  for(const item of checks)console.log(`${item.status.padEnd(4)} ${item.section} / ${item.name}: ${item.message}`);
}

export function redactText(value,secrets=[]){let text=String(value??'');for(const secret of secrets)if(secret)text=text.split(secret).join('[REDACTED]');return text;}

export async function businessCounts(pool){
  const {rows}=await pool.query(`SELECT
    (SELECT count(*)::int FROM "Request") AS requests,
    (SELECT count(*)::int FROM "AiRun") AS ai_runs,
    (SELECT count(*)::int FROM "AuditLog") AS audits,
    (SELECT count(*)::int FROM "Assignment") AS assignments,
    (SELECT count(*)::int FROM "KnowledgeDocument") AS documents`);
  return rows[0];
}

export function countsEqual(before,after){return JSON.stringify(before)===JSON.stringify(after);}

export function assertResetAuthorization({apiActive,markerCount,completedMigrationNames,totalMigrations}){
  if(apiActive)throw new Error('Refusing reset while the API port is active. Stop API and web services first.');
  if(markerCount!==1)throw new Error('Refusing reset: the exact synthetic demo marker is absent.');
  const expected=expectedMigrationNames();
  if(expected.length===0||!Array.isArray(completedMigrationNames)||totalMigrations!==expected.length||JSON.stringify(completedMigrationNames)!==JSON.stringify(expected))throw new Error('Refusing reset: completed migration names must exactly match repository migrations with no failed or unexpected migration.');
}
