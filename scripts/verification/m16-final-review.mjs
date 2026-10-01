import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';

const root=resolve(process.argv[2]??process.cwd());
const state=JSON.parse(readFileSync(join(root,'artifacts/m16/current.json'),'utf8'));
const candidate=resolve(root,state.candidate),evidence=join(root,'docs/v1.2/evidence/m16',state.id),checks=[];
assert.ok(candidate.startsWith(join(root,'artifacts/m16/runs')+sep)&&state.project.startsWith('mobiflow-m16-'));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const pass=(name,details={})=>{checks.push({name,status:'PASS',...details});console.log('PASS '+name);};
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const readReport=name=>JSON.parse(readFileSync(join(candidate,'artifacts/m16/reports',name+'.json'),'utf8'));
const output={checkedAt:new Date().toISOString(),synthetic:true,scope:'targeted local packaging/identity review; no penetration-test or production-accuracy claim',checks};
try{
  assert.equal(git(['rev-parse','HEAD']),'310b6db40e8b42189baa665eb04958e999eec0dc');
  assert.equal(git(['branch','--show-current']),'feat/v1.2-release-hardening-demo-readiness');
  assert.equal(git(['diff','--cached','--name-only']),'');
  pass('authorized M15 HEAD and M16 branch retained; nothing staged');

  const changed=git(['diff','--name-only']).split('\n').filter(Boolean);
  const frozen=['package-lock.json','apps/api/prisma/schema.prisma','apps/api/prisma/migrations/','apps/api/src/ai/','packages/contracts/','datasets/ai-evaluation/'];
  assert.equal(changed.some(file=>frozen.some(prefix=>file===prefix||file.startsWith(prefix))),false);
  assert.equal(changed.some(file=>/^docs\/(verification|reference|specs)\//.test(file)||/^docs\/v1\.2\/(?:evidence\/(?!m16\/)|M1[1-5]_)/.test(file)),false);
  const identities={
    'apps/api/src/ai/prompts/recommendation.ts':'71d7bbd664a232f31c7ef637601bbb812695e27a9a3acf7b6c76586cc34661de',
    'apps/api/src/ai/recommendation-output.ts':'2489638d4fb0dcd653e099784fee41fb21e2a568249df03f52a414f8979a0698',
    'packages/contracts/src/recommendation.ts':'8b75065e212a92d790cc4c521a5e142b6e68b2af46b3362d99af78fc342481eb',
    'datasets/ai-evaluation/m15-recommendation-v2.json':'e3e9022433a4378ce98294169b2ae1b77799ee2cce6acba2d0f2c4d9673c5290',
  };
  for(const [file,expected] of Object.entries(identities)){assert.equal(hash(join(root,file)),expected);assert.equal(hash(join(candidate,file)),expected);}
  const migrations=readdirSync(join(root,'apps/api/prisma/migrations'),{withFileTypes:true}).filter(item=>item.isDirectory()).map(item=>item.name).sort();assert.equal(migrations.length,7);
  for(const file of changed.filter(file=>!file.startsWith('docs/'))){assert.equal(hash(join(root,file)),state.sourceHashes[file],'Candidate differs from reviewed source: '+file);assert.equal(hash(join(root,file)),hash(join(candidate,file)));}
  pass('prompt parser schema dataset migrations dependencies and historical evidence preserved',{identities,migrations,schemaChanged:false,migrationAdded:false});

  for(const name of ['DATABASE','RUNTIME','BROWSER_CANONICAL','BROWSER_STATES','SECURITY_FINAL','RECOVERY'])assert.equal(readReport(name).result,'PASS',name);
  for(const name of ['DATABASE','RUNTIME','SECURITY_FINAL','RECOVERY'])assert.ok(readReport(name).checks.every(check=>check.status==='PASS'),name+' check status');
  const canonical=readReport('BROWSER_CANONICAL'),runtime=readReport('RUNTIME');
  assert.equal(canonical.widthChecks.length,20);assert.ok(canonical.widthChecks.every(check=>check.serious===0&&check.critical===0&&!check.overflow));
  assert.equal(runtime.smoke.length,3);assert.equal(runtime.fullM15EvaluationRerun,false);
  const unit=state.steps.filter(step=>step.label==='unit tests'&&step.exitCode===0).at(-1);assert.ok(unit);
  const unitLog=readFileSync(join(candidate,unit.log),'utf8'),unitGroups=[...unitLog.matchAll(/(?:ℹ|#) tests (\d+)/g)].map(match=>Number(match[1]));assert.equal(unitGroups.reduce((sum,n)=>sum+n,0),170);
  pass('all required real runtime database browser recovery reports and root gates completed',{unitGroups,unitTotal:170,httpChecks:runtime.checks.length,finalSecurityChecks:readReport('SECURITY_FINAL').checks.length,databaseChecks:readReport('DATABASE').checks.length,recoveryChecks:readReport('RECOVERY').checks.length,widthScans:20,smokeCases:3,canonicalLiveCase:true});

  const env=Object.fromEntries(readFileSync(join(candidate,'.env'),'utf8').split(/\r?\n/).filter(line=>/^[A-Z0-9_]+=/.test(line)).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
  assert.equal(new URL(env.DATABASE_URL).port,'54616');assert.equal(env.COMPOSE_PROJECT_NAME,state.project);
  const ollamaVersion=await fetch(env.OLLAMA_BASE_URL+'/api/version',{signal:AbortSignal.timeout(10000)}).then(response=>response.json());
  const tags=await fetch(env.OLLAMA_BASE_URL+'/api/tags',{signal:AbortSignal.timeout(10000)}).then(response=>response.json());
  const models=[env.OLLAMA_MODEL,env.OLLAMA_EMBEDDING_MODEL].map(name=>{const found=tags.models.find(model=>model.name===name);assert.ok(found?.digest);return {name,digest:found.digest};});
  assert.ok(runtime.smoke.every(row=>row.job.evidence.embeddingIdentity.dimension===1024&&row.job.evidence.embeddingIdentity.digest===models[1].digest));
  pass('actual installed Ollama tags digests and smoke embedding identity verified',{ollamaVersion:ollamaVersion.version,models,embeddingDimension:1024});

  const ids=execFileSync('docker',['ps','--filter','label=com.docker.compose.project='+state.project,'--format','{{.ID}}'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);assert.equal(ids.length,3);
  const inspected=JSON.parse(execFileSync('docker',['inspect',...ids],{encoding:'utf8'}));
  const containers=inspected.map(item=>({service:item.Config.Labels['com.docker.compose.service'],project:item.Config.Labels['com.docker.compose.project'],user:item.Config.User,readOnly:item.HostConfig.ReadonlyRootfs,capDrop:item.HostConfig.CapDrop,securityOptions:item.HostConfig.SecurityOpt,memoryBytes:item.HostConfig.Memory,nanoCpus:item.HostConfig.NanoCpus,ports:Object.values(item.HostConfig.PortBindings).flat().map(port=>({host:port.HostIp,port:port.HostPort})),volumes:item.Mounts.filter(mount=>mount.Type==='volume').map(mount=>mount.Name)}));
  for(const container of containers){assert.equal(container.project,state.project);assert.ok(container.ports.every(port=>port.host==='127.0.0.1'));assert.ok(container.volumes.every(volume=>volume.startsWith(state.project+'_')));assert.ok(container.memoryBytes>0&&container.nanoCpus>0);if(['api','web'].includes(container.service)){assert.equal(container.user,'node');assert.equal(container.readOnly,true);assert.ok(container.capDrop.includes('ALL'));assert.ok(container.securityOptions.includes('no-new-privileges:true'));}}
  pass('actual containers use isolated volumes loopback ports and retained security limits',{containers});

  const docs=['docs/v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_SPEC.md','docs/v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_IMPLEMENTATION_PLAN.md','docs/v1.2/M16_RELEASE_HARDENING_DEMO_READINESS_VERIFICATION.md','docs/verification/MILESTONE_16_VERIFICATION.md','docs/v1.2/M16_DEMO_RUNBOOK.md','docs/v1.2/M16_CONFIGURATION_REFERENCE.md','docs/v1.2/M16_RELEASE_INVENTORY.md'];
  for(const file of docs)assert.ok(existsSync(join(root,file)),file);
  assert.ok(docs.every(file=>readFileSync(join(root,file),'utf8').includes('M16')));
  pass('required current documentation runbook configuration and inventory exist',{files:docs});

  const files=git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
  const needles=[];for(const file of [join(candidate,'.env'),join(root,'.env')])if(existsSync(file)){for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const match=/^(JWT_SECRET|REFRESH_TOKEN_SECRET|POSTGRES_PASSWORD|POSTGRES_APP_PASSWORD)=(.+)$/.exec(line);if(match&&match[2].length>=16)needles.push(match[2]);}}
  let sourceFiles=0,evidenceFiles=0;
  const privateKey=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]+-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
  for(const file of files){if(!existsSync(join(root,file)))continue;assert.ok(!/(^|\/)\.env(?:$|\.)/.test(file)||file.endsWith('.env.example'));assert.ok(!/(^|\/)(?:node_modules|\.next|dist|artifacts|storage|models)(?:\/|$)/.test(file));const content=readFileSync(join(root,file));for(const secret of needles)assert.equal(content.includes(Buffer.from(secret)),false,'Private configured secret detected in: '+file);assert.equal(privateKey.test(content.toString('utf8')),false,file);sourceFiles++;if(file.startsWith('docs/v1.2/evidence/m16/')){const text=content.toString('utf8');assert.equal(/Bearer\s+eyJ|"(?:rawPrompt|systemPrompt|rawOutput|chainOfThought)"\s*:/.test(text),false,file);evidenceFiles++;}}
  const ignoreFiles=['.env','apps/api/.env','artifacts/m16/current.json','apps/api/src/generated/prisma/client.ts','apps/web/.next/BUILD_ID'];
  for(const file of ignoreFiles)assert.equal(execFileSync('git',['check-ignore',file],{cwd:root,encoding:'utf8'}).trim(),file);
  pass('reviewable source and new evidence exclude private configured secrets raw prompts and runtime artifacts',{sourceFiles,evidenceFiles,ignoredChecks:ignoreFiles});

  execFileSync('git',['diff','--check'],{cwd:root,stdio:'pipe'});pass('git diff --check');
  output.result='PASS';output.baseline=git(['rev-parse','HEAD']);output.branch=git(['branch','--show-current']);output.v11Commit=git(['rev-parse','v1.1.0^{commit}']);output.changedTracked=changed;
}catch(error){output.result='FAIL';output.failure=error instanceof Error?error.message:'Release packaging review failed';throw error;}
finally{writeFileSync(join(candidate,'artifacts/m16/reports/PACKAGING.json'),JSON.stringify(output,null,2)+'\n');writeFileSync(join(evidence,'PACKAGING.json'),JSON.stringify(output,null,2)+'\n');}
