import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {saveEvidence} from './evidence.mjs';
import {developerContainers} from './m22-runtime.mjs';
import {sourceInventory} from './m22-source.mjs';
const git=(...args)=>execFileSync('git',['--no-optional-locks','-c','core.safecrlf=false',...args],{encoding:'utf8',windowsHide:true}).trim();
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true}).trim();
const read=p=>JSON.parse(readFileSync(p)),preflight=read('artifacts/m22/preflight.json'),runtime=read('artifacts/m22/runtime-baseline.json');
assert.equal(git('rev-parse','HEAD'),preflight.previousCheckpointSha);assert.equal(git('branch','--show-current'),'feat/v1.3-reminder-sla-escalation');assert.equal(git('diff','--cached','--name-only'),'');
assert.equal(git('rev-parse','main'),preflight.main);assert.equal(git('rev-parse','origin/main'),preflight.originMain);assert.equal(git('show-ref','--tags'),preflight.tags);
assert.equal(git('ls-remote','--heads','origin','refs/heads/main').split(/\s/)[0],preflight.main);
for(const c of preflight.checkpoints){assert.equal(git('rev-parse',c.branch),c.sha);assert.equal(git('ls-remote','--heads','origin','refs/heads/'+c.branch).split(/\s/)[0],c.sha);}
for(const line of preflight.tags.split('\n')){const [sha,ref]=line.split(' ');assert.equal(git('ls-remote','--tags','origin',ref).split(/\s/)[0],sha);}
assert.equal(git('diff','--check'),'');
for(const name of ['M22_LINT','M22_TYPECHECK','M22_UNIT','M22_BUILD','M22_DATABASE','M22_API','M22_E2E','M22_SECURITY']){const report=read('docs/v1.3/evidence/gates/'+name+'.json');assert.equal(report.result,'PASS',name);assert.equal(report.exitCode,0,name);}
const coverage=read('docs/v1.3/evidence/M22_SOURCE_COVERAGE.json');assert.equal(coverage.result,'PASS');assert.equal(coverage.source.fingerprint,sourceInventory().fingerprint,'Final executable source matches reviewed coverage');
assert.deepEqual(developerContainers(),runtime.developerContainers,'Developer containers retain post-auto-start identities/start times/ports');
const developer=new Client({connectionString:process.env.DATABASE_URL});await developer.connect();let developerMigrations;
try{developerMigrations=(await developer.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;assert.deepEqual(developerMigrations,runtime.developerMigrations);assert.equal(Number((await developer.query("SELECT count(*) FROM pg_database WHERE datname='mobiflow_m22_test'")).rows[0].count),0);}finally{await developer.end();}
for(const name of ['mobiflow-m22-verification-postgres','mobiflow-m22-verification-runner'])assert.equal(docker('ps','-aq','--filter','name=^/'+name+'$'),'');
for(const name of ['mobiflow-m22-verification_m22_postgres','mobiflow-m22-verification-work'])assert.equal(docker('volume','ls','-q','--filter','name=^'+name+'$'),'');
for(const port of [55422,33022,33400,33401]){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
const historicalPaths=git('ls-tree','-r','--name-only',preflight.previousCheckpointSha,'docs/v1.3').split('\n').filter(p=>/^docs\/v1\.3\/(?:M(?:18|19|20|21)_|evidence\/)/.test(p));
for(const path of historicalPaths)assert.equal(git('hash-object','--path='+path,path),git('rev-parse',preflight.previousCheckpointSha+':'+path),'Historical evidence frozen: '+path);
const paths=[...new Set([...git('diff','--name-only',preflight.previousCheckpointSha).split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')])].filter(Boolean).sort();
const excludedFromRecursiveManifest=['docs/v1.3/evidence/M22_FINAL.json','docs/v1.3/evidence/gates/M22_FINAL.json'];
function category(p){return p.includes('/prisma/')?'database':p.startsWith('apps/api/src')?'backend':p.startsWith('apps/web/src')?'frontend':/\/test\/|\/e2e\/|^playwright/.test(p)?'tests':p.startsWith('docs/')?(p.endsWith('.json')?'sanitized-evidence':'documentation'):'verification';}
for(const p of paths){assert.ok(/^(?:apps\/(?:api|web)\/|packages\/config\/|scripts\/verification\/m22-|scripts\/verification\/docker-compose\.m22|docs\/(?:specs\/|v1\.3\/|verification\/MILESTONE_22|IMPLEMENTATION_PLAN)|playwright\.m22|package\.json)/.test(p),'Allowed M22 scope: '+p);assert.ok(!/(?:^|\/)(?:node_modules|\.next|storage|coverage)(?:\/|$)|^artifacts\/|(?:^|\/)\.env(?:\.|$)|\.(?:log|png|zip)$/.test(p),'Private/runtime excluded: '+p);}
const inventory=paths.filter(p=>!excludedFromRecursiveManifest.includes(p)).map(path=>({path,category:category(path),disposition:'INCLUDE',gitBlob:git('hash-object','--path='+path,path)}));
await saveEvidence('docs/v1.3/evidence/M22_FINAL.json',{checkedAt:new Date().toISOString(),result:'PASS',previousCheckpointSha:preflight.previousCheckpointSha,branch:'feat/v1.3-reminder-sla-escalation',closureAuthorization:'RECEIVED — explicit user execution prompt',technicalSelfReview:'PASS',independentExternalHumanReview:'NOT RUN',sourceFingerprint:coverage.source.fingerprint,productFingerprint:coverage.productFingerprint,reviewedFiles:inventory,inventoryFingerprint:createHash('sha256').update(JSON.stringify(inventory)).digest('hex'),excludedFromRecursiveManifest,developerMigrations:developerMigrations.length,developerDatabaseModified:false,developerStack:'Initially offline; Docker Desktop automatically resumed existing containers. Preserved post-start IDs/start times/ports; no normal Compose/build/migrate/reset/reseed',ownedTestContainersAndVolumes:'REMOVED; each synthetic database dropped by harness',portsReleased:[55422,33022,33400,33401],mainUnchanged:true,historicalTagsAndCheckpointsUnchanged:true,historicalDocumentsAndEvidenceFrozen:historicalPaths.length,m23:'NOT STARTED',deployment:'NOT RUN',gitClosure:'Evaluate live refs after commit/push; this record makes no prospective SHA/publication assertion'});
console.log(JSON.stringify({event:'m22.final',result:'PASS',reviewedFiles:inventory.length,developerMigrations:developerMigrations.length,cleanup:'PASS',publication:'PENDING normal commit/push/live refs'}));
