import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
const runner='mobiflow-m23-verification-runner',volume='mobiflow-m23-verification-work',pg='mobiflow-m23-verification-postgres';
const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
const [action,...args]=process.argv.slice(2);
if(action==='prepare'){
  assert.equal(docker(['ps','-aq','--filter','name=^/'+runner+'$']).trim(),'');assert.equal(docker(['volume','ls','-q','--filter','name=^'+volume+'$']).trim(),'');
  mkdirSync('artifacts/m23',{recursive:true});
  const privateRuntime=JSON.parse(readFileSync('artifacts/m23/runtime-private.json')),owner=new URL(privateRuntime.MIGRATION_DATABASE_URL),app=new URL(privateRuntime.DATABASE_URL);owner.port='5432';app.port='5432';
  writeFileSync('artifacts/m23/linux.env',Object.entries({NODE_ENV:'test',M23_LINUX_RUNTIME:'true',DEMO_MODE:'true',DATABASE_URL:app.toString(),MIGRATION_DATABASE_URL:owner.toString(),JWT_SECRET:randomBytes(32).toString('hex'),REFRESH_TOKEN_SECRET:randomBytes(32).toString('hex'),OLLAMA_BASE_URL:'http://127.0.0.1:9',OLLAMA_MODEL:'unconfigured',OLLAMA_EMBEDDING_MODEL:'unconfigured',AUTH_COOKIE_SECURE:'false',WEB_ORIGIN:'http://localhost:33500',NEXT_TELEMETRY_DISABLED:'1'}).map(([k,v])=>k+'='+v).join('\n'));
  docker(['volume','create','--label','mobiflow.milestone=M23',volume]);
  docker(['run','-d','--name',runner,'--label','mobiflow.milestone=M23','--network','container:'+pg,'--env-file','artifacts/m23/linux.env','--mount','type=bind,source='+process.cwd()+',target=/source,readonly','--mount','type=volume,source='+volume+',target=/work','-w','/work','node:24.19.0-bookworm-slim','sleep','infinity']);
  console.log(JSON.stringify({event:'m23.linux-prepared',runner,volume,network:'isolated PG container namespace',sourceMount:'read-only'}));
}else if(action==='sync'){
  docker(['exec',runner,'sh','-c',"tar -C /source --exclude=node_modules --exclude='.git' --exclude='artifacts' --exclude='storage' --exclude='./docs/v1.3/evidence' --exclude='.env' --exclude='.env.*' --exclude='.next' --exclude='dist' --exclude='src/generated' --exclude='*.tsbuildinfo' -cf - . | tar -C /work -xf -"]);
  docker(['exec',runner,'sh','-c','mkdir -p /work/artifacts/m23 && cp /source/artifacts/m23/runtime-private.json /source/artifacts/m23/runtime-baseline.json /work/artifacts/m23/']);
  // Git verification gets a snapshot with the real history, never writes host .git.
  if(docker(['exec',runner,'sh','-c','if [ -d .git ]; then echo present; fi']).trim()!=='present')docker(['cp','.git',runner+':/work/.git']);
  docker(['exec',runner,'git','config','--global','--add','safe.directory','/work']);
  console.log(JSON.stringify({event:'m23.linux-source-sync',result:'PASS'}));
}else if(action==='run'){
  assert.ok(args.length);const child=spawn('docker',['exec',runner,...args],{stdio:'inherit',windowsHide:true});process.exitCode=await new Promise((r,j)=>{child.on('error',j);child.on('exit',r);});
}else if(action==='collect'){
  const incoming='artifacts/m23/linux-evidence';mkdirSync(incoming,{recursive:true});docker(['cp',runner+':/work/docs/v1.3/evidence/.',resolve(incoming)]);
  function merge(folder,relative=''){for(const entry of readdirSync(folder,{withFileTypes:true})){const path=join(folder,entry.name),rel=join(relative,entry.name);if(entry.isDirectory())merge(path,rel);else if(/^M23.*\.json$/.test(entry.name)){const target=join('docs/v1.3/evidence',rel);if(existsSync(target)){const old=JSON.parse(readFileSync(target)),next=JSON.parse(readFileSync(path));if((old.checkedAt??old.finishedAt??'')>(next.checkedAt??next.finishedAt??''))continue;}mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);}}}
  merge(incoming);docker(['cp',runner+':/work/artifacts/m23/.',resolve('artifacts/m23')]);
  console.log(JSON.stringify({event:'m23.linux-evidence-collect',result:'PASS'}));
}else if(action==='stop'){
  assert.equal(docker(['inspect','--format','{{ index .Config.Labels "mobiflow.milestone" }}',runner]).trim(),'M23');
  docker(['rm','-f',runner]);assert.equal(JSON.parse(docker(['volume','inspect',volume]))[0].Labels['mobiflow.milestone'],'M23');docker(['volume','rm',volume]);
  console.log(JSON.stringify({event:'m23.linux-cleanup',result:'PASS'}));
}else throw new Error('Expected prepare/sync/run/collect/stop');
