import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {checkedComparison} from '../evaluation/release-results.mjs';
import {git,pinned,protocolPath,saveNew,sha256} from '../evaluation/capture-release-environment.mjs';

const directory='docs/verification/evidence/',read=name=>JSON.parse(readFileSync(directory+name+'.json','utf8'));
const freshNames=['LINT','RELEASE_LINT','TYPECHECK','UNIT','BUILD','DB_VALIDATE','DB_MIGRATE','DEPENDENCY_AUDIT','SECURITY_M8','SECURITY_M9','SECURITY_M10','RESET','DOCKER_BUILD','DOCKER_START','DEMO_READY'];
const commands=Object.fromEntries(freshNames.map(name=>{const value=read('M10_V1_'+name);assert.equal(value.exitCode,0,name);assert.equal(value.status,'PASS',name);assert.ok(existsSync(directory+value.log));return [name,value];}));
const productionPaths=['apps','packages','datasets','docker','docker-compose.yml','package-lock.json','.env.example'];
assert.equal(git('diff','584bd984','--',...productionPaths),'','Production behavior/config/lockfile changed');
assert.equal(git('diff','v0.9.0-m9','--','apps/api/prisma/migrations'),'','Historical migrations changed');
const legacy=read('M10_FINAL_VERIFICATION');
const inheritedNames=['M10_INTEGRATION_FINAL','M10_INTEGRATION_SEED','M10_RUNTIME_OUTAGE','M10_E2E'];
const inherited=Object.fromEntries(inheritedNames.map(name=>{
  const value=read(name);assert.equal(value.exitCode,0,name);assert.equal(value.status,'PASS',name);
  assert.equal(git('hash-object','--path='+directory+name+'.json',directory+name+'.json'),git('rev-parse','584bd984:'+directory+name+'.json'));
  return [name,{...value,reexecuted:false,provenance:'Approved M10 evidence; owning production/config/test files unchanged from snapshot.'}];
}));
const browserExpected={M3:2,M4_OFFLINE:1,M4_ONLINE_RECOVERY:2,M5:1,M6:1,M7:1,M8:1,M9:1,M10:3};
for(const [key,count] of Object.entries(browserExpected)){
  const value=legacy.browser[key];assert.equal(value.status,'PASS');assert.equal(value.expected,count);assert.equal(value.unexpected,0);assert.equal(value.skipped,0);assert.equal(value.flaky,0);
}
const result=read('V1_AI_EVALUATION'),regression=read('V1_EVAL_REGRESSION'),baseline=JSON.parse(readFileSync(regression.baseline));
const checked=checkedComparison(result,baseline);assert.equal(checked.passed,true);assert.equal(regression.exitCode,0);assert.deepEqual(regression.regressions,checked.regressions);
assert.equal(sha256(readFileSync(regression.current)),sha256(readFileSync(directory+'V1_AI_EVALUATION.json')));
const completion=read('V1_EVAL_COMPLETION');assert.equal(completion.status,'COMPLETED');assert.deepEqual(completion.integrityProblems,[]);assert.deepEqual(completion.productionChangedFiles,[]);
assert.equal(result.environment.protocolSha256,sha256(readFileSync(protocolPath)));assert.equal(result.timingSummary.missingProviderMetadata,0);
assert.ok(result.results.every(r=>r.identity?.digest===pinned.digest));
const journal=readFileSync(directory+'V1_EVAL_PROGRESS.jsonl','utf8').trim().split('\n').map(line=>JSON.parse(line));
assert.equal(journal.length,100);assert.deepEqual(journal.map(r=>r.id),result.results.map(r=>r.id));
const historicalEvaluation=read('M10_EVAL_CONTRACT_DIFF').protectedEvidence;
const preexistingEvidenceDifferences=[];
for(const item of historicalEvaluation){
  const workingSha256=sha256(readFileSync(item.path));
  const remediationBaselineSha256=sha256(execFileSync('git',['show','584bd984:'+item.path],{windowsHide:true}));
  assert.equal(workingSha256,remediationBaselineSha256,'Historical evidence changed during V1 remediation: '+item.path);
  if(workingSha256!==item.sha256)preexistingEvidenceDifferences.push({path:item.path,recordedBeforeM10Sha256:item.sha256,remediationBaselineSha256});
}
assert.deepEqual(preexistingEvidenceDifferences.map(value=>value.path),['docs/verification/evidence/M9_SECURITY_SCAN.json']);
for(const name of ['V1_RESET','V1_WARMUP','V1_PREFLIGHT'])assert.equal(read(name).status,'PASS',name);
assert.equal(read('V1_WARMUP').businessMutation,'NONE');
const docker=read('V1_DOCKER');assert.equal(docker.runtimeStatus,'PASS');assert.equal(docker.dashboardSnapshot.runId,result.snapshot.runId);assert.equal(docker.migrations.length,6);
for(const name of ['V1_SECURITY_M8','V1_SECURITY_M9','V1_SECURITY_M10']){
  const value=read(name);assert.ok(Object.values(value.invariants).every(Boolean),name);assert.ok(value.findings.every(f=>f.classification==='REVIEWED_DEMO_OR_TEST_PLACEHOLDER'),name);
}
const paths=[...new Set([...git('diff','--name-only','584bd984').split(/\r?\n/),...git('ls-files','--others','--exclude-standard').split(/\r?\n/)])].filter(Boolean);
const secrets=['DATABASE_URL','MIGRATION_DATABASE_URL','JWT_SECRET','REFRESH_TOKEN_SECRET','POSTGRES_PASSWORD','POSTGRES_APP_PASSWORD'].map(k=>process.env[k]).filter(Boolean);
const secretFindings=[];
for(const path of paths){
  assert.ok(!/(?:^|\/)(?:\.env(?:$|\.(?!example$))|models\/|storage\/|artifacts\/|node_modules\/)/.test(path),'Excluded release artifact: '+path);
  const text=readFileSync(path,'utf8');if(secrets.some(value=>text.includes(value)))secretFindings.push({path,kind:'CONFIGURED_SECRET'});
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b|\bsk-[A-Za-z0-9_-]{20,}\b/.test(text))secretFindings.push({path,kind:'SECRET_SHAPE'});
}
assert.deepEqual(secretFindings,[]);
execFileSync('git',['diff','--check','584bd984'],{encoding:'utf8',windowsHide:true});
const evidence={at:new Date().toISOString(),finalGate:'PASS',releaseBlockers:[],sourceCommit:git('rev-parse','HEAD'),branch:git('branch','--show-current'),productionChanged:false,commands,
  inherited:{commands:inherited,browser:legacy.browser,reason:'Phase 16 permits focused verification for evaluation/tooling/docs-only changes. Integration, actual outages and M3-M10 browser flows retain their original dates; they were not rerun or relabeled.'},
  evaluation:{runId:result.snapshot.runId,protocolSha256:result.environment.protocolSha256,comparatorExit:0,flags:0,fullRunAttempts:1,historicalEvidenceUnchangedSinceRemediationBaseline:historicalEvaluation.map(r=>r.path),preexistingEvidenceDifferences,snapshot:result.snapshot},
  runtime:docker,security:{freshStaticChecks:['V1_SECURITY_M8','V1_SECURITY_M9','V1_SECURITY_M10'],newFilesScanned:paths.length,secretFindings,dynamicAuthorizationAndInjectionEvidence:'Inherited unchanged M10 integration plus fresh 43 API unit tests.'},migrations:{count:6,newMigration:false,historicalChanged:false},gitDiffCheck:'PASS',m11Started:false,
  limitations:['Historical slowdown mechanism remains unknown; current controlled release passes the original gate.','Synthetic label agreement is not generalized accuracy.','No new manual productivity benchmark, external penetration test or distributed scheduler guarantee.']};
saveNew(directory+'V1_FINAL_GATE.json',evidence);console.log(JSON.stringify({finalGate:'PASS',runId:result.snapshot.runId,comparatorExit:0,productionChanged:false,inheritedChecks:inheritedNames,browserSuites:Object.keys(browserExpected),secretFindings:0,migrations:6,m11Started:false}));
