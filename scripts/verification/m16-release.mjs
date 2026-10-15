import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdirSync,existsSync,readFileSync,writeFileSync,copyFileSync,createWriteStream,readdirSync} from 'node:fs';
import {dirname,join,resolve,relative,sep} from 'node:path';

const root=process.cwd(),mode=process.argv[2]??'--prepare',current=join(root,'artifacts/m16/current.json');
assert.ok(['--prepare','--prepare-resume','--runtime','--runtime-checks','--checks','--http','--security','--recovery','--review','--shutdown'].includes(mode),'Choose a documented M16 stage');
const npmCli=process.env.npm_execpath;
assert.ok(npmCli,'Run through npm run verify:release:m16 -- <mode>');
const parseEnv=path=>Object.fromEntries(readFileSync(path,'utf8').split(/\r?\n/).filter(line=>/^[A-Z0-9_]+=/.test(line)).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
let state;
if(mode==='--prepare'){
  const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID(),candidate=join(root,'artifacts/m16/runs',id,'candidate');
  const project='mobiflow-m16-'+id.slice(-8),ports={postgres:54616,api:31601,web:31600};
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),'310b6db40e8b42189baa665eb04958e999eec0dc');
  const existing=execFileSync('docker',['ps','-a','--filter','label=com.docker.compose.project='+project,'--format','{{.ID}}'],{encoding:'utf8'}).trim();
  assert.equal(existing,'','Refuse an existing Compose project');
  for(const port of Object.values(ports)){
    const probe=createServer();await new Promise((ok,no)=>{probe.once('error',no);probe.listen(port,'127.0.0.1',ok);});await new Promise(ok=>probe.close(ok));
  }
  assert.equal(existsSync(candidate),false);mkdirSync(candidate,{recursive:true});
  const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))].filter(file=>!file.startsWith('docs/v1.2/evidence/m16/')&&!file.endsWith('.tsbuildinfo'));
  const sourceHashes={};
  for(const file of files){
    assert.ok(!file.split(/[\\/]/).some(part=>['.git','node_modules','.next','dist','artifacts','storage'].includes(part)),'Unexpected runtime artifact in release source');
    assert.ok(!/(^|\/)\.env($|\.)/.test(file)||file.endsWith('.env.example'),'Environment file must not enter release source');
    const from=join(root,file),to=join(candidate,file);if(!existsSync(from))continue;
    mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to);sourceHashes[file]=createHash('sha256').update(readFileSync(from)).digest('hex');
  }
  state={id,candidate:relative(root,candidate),project,ports,sourceHashes,startedAt:new Date().toISOString(),steps:[],status:'RUNNING'};
  mkdirSync(dirname(current),{recursive:true});writeFileSync(current,JSON.stringify(state,null,2)+'\n');
}else{state=JSON.parse(readFileSync(current,'utf8'));}
const candidate=resolve(root,state.candidate),allowedRoot=resolve(root,'artifacts/m16/runs')+sep;
assert.ok(candidate.startsWith(allowedRoot)&&state.project.startsWith('mobiflow-m16-'),'Refuse a target outside the M16 runner resources');
if(mode==='--prepare-resume'){
  assert.equal(createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),state.sourceHashes['package-lock.json'],'Changed dependencies require a new fresh setup');
  for(const file of Object.keys(state.sourceHashes)){if(!existsSync(join(root,file)))continue;copyFileSync(join(root,file),join(candidate,file));state.sourceHashes[file]=createHash('sha256').update(readFileSync(join(root,file))).digest('hex');}
}
if(['--runtime','--runtime-checks','--checks','--http','--security','--recovery','--review'].includes(mode)){
  // Corrections to verification code do not rebuild or change application behavior.
  const checks=[...readdirSync(join(root,'scripts/verification')).filter(file=>/^m16-.*\.mjs$/.test(file)).map(file=>'scripts/verification/'+file)];
  for(const file of checks){copyFileSync(join(root,file),join(candidate,file));state.sourceHashes[file]=createHash('sha256').update(readFileSync(join(root,file))).digest('hex');}
}
if(state.failure){state.recoveredFailures??=[];state.recoveredFailures.push({reportedBefore:mode,message:state.failure});delete state.failure;}
state.status='RUNNING';
const evidenceDirectory=join(root,'docs/v1.2/evidence/m16',state.id);mkdirSync(evidenceDirectory,{recursive:true});
const save=()=>{writeFileSync(current,JSON.stringify(state,null,2)+'\n');writeFileSync(join(evidenceDirectory,'SETUP.json'),JSON.stringify({...state,candidate:'ignored clean source copy',mode},null,2)+'\n');};
async function run(label,file,args,extra={}){
  const log=join(candidate,'artifacts/m16/commands',String(state.steps.length+1).padStart(2,'0')+'-'+label.replace(/[^a-z0-9]/gi,'-')+'.log');mkdirSync(dirname(log),{recursive:true});
  const stream=createWriteStream(log),startedAt=new Date().toISOString();console.log('START '+label);
  const result=await new Promise((ok,no)=>{
    const child=spawn(file,args,{cwd:candidate,env:{...process.env,...(existsSync(join(candidate,'.env'))?parseEnv(join(candidate,'.env')):{}),...extra},stdio:['ignore','pipe','pipe'],windowsHide:true});
    child.stdout.pipe(stream);child.stderr.pipe(stream);child.once('error',no);child.once('close',code=>ok(code));
  });
  await new Promise(ok=>stream.end(ok));
  state.steps.push({label,command:file===process.execPath?'node '+args.map(arg=>arg===npmCli?'npm-cli':arg).join(' '):file+' '+args.join(' '),startedAt,finishedAt:new Date().toISOString(),exitCode:result,log:relative(candidate,log).replaceAll('\\','/')});save();
  console.log((result===0?'PASS ':'FAIL ')+label);
  if(result!==0)throw new Error(label+' failed; inspect the private candidate log '+relative(root,log));
}
const npm=(label,args,extra)=>run(label,process.execPath,[npmCli,...args],extra);
const docker=(label,args)=>run(label,'docker',['compose','-p',state.project,...args]);
try{
  if(['--prepare','--prepare-resume'].includes(mode)){
    if(mode==='--prepare'){
      await npm('npm ci',['ci','--no-audit','--no-fund']);
      await npm('env setup',['run','env:setup','--','qwen3:4b-instruct-2507-q4_K_M']);
    }
    const env=parseEnv(join(candidate,'.env'));
    Object.assign(env,{NODE_ENV:'production',API_PORT:String(state.ports.api),POSTGRES_PORT:String(state.ports.postgres),WEB_PORT:String(state.ports.web),WEB_ORIGIN:'http://localhost:'+state.ports.web,NEXT_PUBLIC_API_BASE_URL:'http://localhost:'+state.ports.api+'/api/v1',COMPOSE_PROJECT_NAME:state.project,AI_RAG_ENABLED:'true',EMBEDDING_DIMENSION:'1024',DEMO_EVIDENCE_ROOT:'artifacts/m16/operator',VERIFY_API_URL:'http://localhost:'+state.ports.api});
    for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL']){const url=new URL(env[key]);url.port=String(state.ports.postgres);env[key]=url.toString();}
    writeFileSync(join(candidate,'.env'),Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
    assert.equal(readdirSync(join(candidate,'apps/api/prisma/migrations'),{withFileTypes:true}).filter(item=>item.isDirectory()).length,7);
    if(mode==='--prepare'){assert.equal(existsSync(join(candidate,'apps/web/.next')),false);assert.equal(existsSync(join(candidate,'apps/api/src/generated/prisma')),false);}
    await npm('Prisma generation',['run','prisma:generate']);
    await npm('lint',['run','lint']);await npm('typecheck',['run','typecheck']);await npm('unit tests',['test']);await npm('production build',['run','build']);
    await docker('Compose validation',['config','--quiet']);await docker('fresh PostgreSQL startup',['up','-d','--wait','postgres']);
    await npm('schema validate',['run','db:validate']);await npm('seven migrations',['run','db:migrate']);
    await npm('synthetic seed',['run','demo:seed']);
    await run('seed and migration safety',process.execPath,['--env-file=.env','scripts/verification/m16-database.mjs']);
    state.status='PREPARED';save();
  }
  if(mode==='--runtime'){
    await docker('API and web container builds',['build','api','web']);await docker('full local startup',['up','-d','--wait','api','web']);
  }
  if(['--runtime','--runtime-checks'].includes(mode)){
    await npm('real knowledge ingestion',['run','knowledge:ingest']);
    await run('guarded synthetic preparation',process.execPath,['--env-file=.env','scripts/verification/m16-index-history.mjs']);
    await npm('bounded warmup',['run','demo:warmup']);await npm('demo preflight',['run','demo:preflight']);
    state.status='STARTED';save();
  }
  if(['--checks','--http'].includes(mode)){
    await run('release HTTP and live AI smoke',process.execPath,['--env-file=.env','scripts/verification/m16-runtime.mjs']);
    state.status='HTTP_VERIFIED';save();
  }
  if(mode==='--security'){
    await run('final security regression',process.execPath,['--env-file=.env','scripts/verification/m16-runtime.mjs','--security-only']);
    state.status='SECURITY_VERIFIED';save();
  }
  if(['--checks','--recovery'].includes(mode)){
    await run('degradation restart recovery',process.execPath,['--env-file=.env','scripts/verification/m16-recovery.mjs']);
    state.status=mode==='--checks'?'VERIFIED':'RECOVERY_VERIFIED';save();
  }
  if(mode==='--checks'){
    await run('final security regression',process.execPath,['--env-file=.env','scripts/verification/m16-runtime.mjs','--security-only']);
    state.status='VERIFIED';save();
  }
  if(mode==='--review'){
    await npm('final verification lint',['run','lint']);
    await run('release packaging and evidence review',process.execPath,['scripts/verification/m16-final-review.mjs',root]);
    state.status='REVIEWED';save();
  }
  if(mode==='--shutdown'){
    // Stop only this runner's project. Retain volumes and failed-run data for review; no volume deletion.
    await docker('isolated stack shutdown',['stop']);state.status='STOPPED';save();
  }
}catch(error){state.status='FAIL';state.failure=error.message;save();throw error;}
finally{
  const reports=join(candidate,'artifacts/m16/reports');if(existsSync(reports))for(const name of readdirSync(reports)){if(name.endsWith('.json'))copyFileSync(join(reports,name),join(evidenceDirectory,name));}
}
console.log(JSON.stringify({status:state.status,runId:state.id,project:state.project,ports:state.ports,evidence:relative(root,evidenceDirectory).replaceAll('\\','/')}));
