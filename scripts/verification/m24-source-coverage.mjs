import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceInventory,releaseProduct} from './m24-source.mjs';
import {saveEvidence} from './evidence.mjs';
const read=p=>JSON.parse(readFileSync(p)),source=sourceInventory(),product=source.files.filter(f=>releaseProduct.test(f.path));
const names=['LINT','TYPECHECK','UNIT','BUILD','DATABASE','INTEGRATION','E2E','PACKAGING_BUILD','RUNTIME_START','PRODUCTION_SMOKE','RECOVERY','SEED_IDEMPOTENCE','AI_IDENTITY','SECURITY'],coverage=[];
for(const name of names){const gate=read('docs/v1.3/evidence/gates/M24_'+name+'.json');assert.equal(gate.result,'PASS',name);assert.equal(gate.exitCode,0,name);assert.deepEqual(gate.productFiles,product,name+' final product/config/migration bytes');coverage.push({gate:'M24_'+name,command:gate.command,finishedAt:gate.finishedAt,matchingProductFiles:product.length,inputFingerprint:gate.sourceFingerprint});}
const git=(...args)=>execFileSync('git',['-c','core.safecrlf=false',...args],{encoding:'utf8',windowsHide:true}).trim();
const baseline='4735afafe7cda4dbf98bdd387cc2fd49db22f764';assert.equal(git('diff',baseline,'--','apps/api/src','apps/api/prisma','apps/web/src','packages','package-lock.json','docker/Dockerfile','apps/api/package.json','apps/web/package.json','apps/api/tsconfig.json','apps/web/tsconfig.json','apps/web/next.config.ts'),'');
const packageOld=JSON.parse(git('show',baseline+':package.json')),packageNow=read('package.json');for(const key of Object.keys(packageNow.scripts).filter(k=>k.endsWith(':m24')))delete packageNow.scripts[key];assert.deepEqual(packageNow,packageOld);
const historical=['M18','M19','M20','M21','M22','M23'].map(milestone=>({milestone,sourceReuse:'All application/contracts/schema/lockfile bytes unchanged from accepted M23 chain; deep gates preserved, no replay claimed'}));
const productBlobs=product.map(f=>({path:f.path,gitBlob:git('hash-object','--path='+f.path,f.path)}));
await saveEvidence('docs/v1.3/evidence/M24_SOURCE_COVERAGE.json',{checkedAt:new Date().toISOString(),result:'PASS',source,productFileCount:product.length,productFingerprint:createHash('sha256').update(JSON.stringify(product)).digest('hex'),productBlobs,coverage,historical,explanation:'Exact raw product/config/migration hashes match all fourteen required current gate captures, including Docker packaging and browser runtime. Additional build inputs are unchanged from M23. Root package delta only adds verification commands. Verification and docs reviewed separately; Git blobs normalize staging line endings.'});console.log(JSON.stringify({event:'m24.source-coverage',result:'PASS',productFiles:product.length,gates:names.length}));
