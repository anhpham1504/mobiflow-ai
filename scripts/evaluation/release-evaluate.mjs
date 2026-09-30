import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {appendFileSync,closeSync,existsSync,mkdirSync,mkdtempSync,openSync,readFileSync,unlinkSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {parseApiEnvironment} from '@mobiflow/config';
import {analysisSchema,categories,priorities} from '@mobiflow/contracts';
import {installObserver,observeCase} from './analysis-observer.mjs';
import {captureEnvironment,datasetPath,git,isolationProblems,pinned,protocolPath,saveNew,sha256} from './capture-release-environment.mjs';
import {checkedComparison,projectResult,snapshotFor,timingSummary} from './release-results.mjs';

const evidence='docs/verification/evidence',baselinePath='docs/evaluation/results/m9-2026-09-29T14-17-47-313Z.json';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
export const diagnosticIds=['normal-06','incomplete-06','normal-01','normal-11','ambiguous-01'];
function protectedFiles(){
  return git('ls-files','--','docs/evaluation/results','docs/verification/evidence').split(/\r?\n/).filter(path=>path.startsWith('docs/evaluation/results/')||/\/(?:M9|M10)[^/]*\.json$/.test(path)).map(path=>({path,sha256:sha256(readFileSync(path))}));
}
function verifyProtected(files){for(const item of files)assert.equal(sha256(readFileSync(item.path)),item.sha256,'Historical evidence changed: '+item.path);}
function checkInput(){
  const raw=readFileSync(datasetPath);assert.equal(sha256(raw),pinned.datasetHash);
  const schema=z.object({id:z.string(),input:z.string().min(10).max(10000),expected:z.object({category:z.enum(categories),priority:z.enum(priorities),team:z.string(),entities:analysisSchema.shape.entities.optional(),missingFields:analysisSchema.shape.missingFields.optional()}).strict(),tags:z.array(z.string())}).strict();
  const cases=z.array(schema).length(100).parse(JSON.parse(raw));assert.equal(new Set(cases.map(c=>c.id)).size,100);return cases;
}
export async function runRelease(mode){
  assert.ok(['diagnostics','final'].includes(mode),'Usage: release-evaluate.mjs diagnostics|final');
  const cases=checkInput(),env=parseApiEnvironment(process.env),protectedEvidence=protectedFiles(),protocolHash=sha256(readFileSync(protocolPath));
  assert.equal(git('diff','584bd984','--','apps','packages','datasets','.env.example','docker-compose.yml'),'','This frozen protocol requires unchanged production and dataset source');
  const prefix=mode==='final'?'V1_EVAL':'V1_PRIORITY',attemptFile=join(evidence,prefix+'_ATTEMPT.json');
  assert.equal(existsSync(attemptFile),false,'This batch has already consumed its one attempt; inspect retained evidence');
  if(mode==='final'){
    const justification=read(join(evidence,'V1_FULL_RUN_JUSTIFICATION.json'));
    assert.equal(justification.justified,true);assert.equal(justification.protocolSha256,protocolHash);
  }
  // Preflight is read-only. Refusals here occur before the bounded call budget.
  const pre=await captureEnvironment(env,mode+'-before-warmup');
  const problems=isolationProblems(pre);
  if(problems.length){console.log(JSON.stringify({status:'NOT_RUN',problems}));process.exitCode=2;return;}
  const lockPath=join(evidence,'V1_RELEASE_EVALUATION.lock');
  const lock=openSync(lockPath,'wx');closeSync(lock);
  let observer;
  try{
    const stamp=new Date().toISOString(),runId=randomUUID();
    saveNew(attemptFile,{at:stamp,mode,runId,protocolSha256:protocolHash,commit:git('rev-parse','HEAD'),status:'RESERVED',rule:'No second attempt after this reservation, including interrupted or undesirable results.',protectedEvidence});
    const progress=join(evidence,prefix+'_PROGRESS.jsonl');
    closeSync(openSync(progress,'wx'));
    saveNew(join(evidence,prefix+'_ENVIRONMENT_BEFORE.json'),pre);
    observer=installObserver();const provider=observer.provider(env);
    const warmItem={id:'protocol-warmup',input:'Khách hàng Demo Warmup báo 2 SIM IoT mất kết nối tại phòng lab từ 8 giờ sáng.',expected:{category:'NETWORK',priority:'HIGH',team:'NETWORK_OPERATIONS'},tags:[]};
    const warm=projectResult(await observeCase(provider,env,warmItem,'warmup',1),warmItem);
    saveNew(join(evidence,prefix+'_WARMUP.json'),{protocolSha256:protocolHash,notScored:true,result:warm});
    assert.equal(warm.schemaValid,true,'Single bounded warmup failed; batch stops');
    const ready=await captureEnvironment(env,mode+'-after-warmup');
    assert.deepEqual(isolationProblems(ready,{warm:true}),[],'Warm/isolation preconditions failed');
    assert.equal(ready.protocol.sha256,protocolHash);assert.deepEqual(ready.git.sourceHashes,pre.git.sourceHashes);
    saveNew(join(evidence,prefix+'_ENVIRONMENT.json'),ready);
    await delay(2000);
    const results=[],startedAt=new Date().toISOString();
    const selected=mode==='final'?cases:Array.from({length:5},()=>diagnosticIds.map(id=>cases.find(c=>c.id===id))).flat();
    for(const [index,item] of selected.entries()){
      const record=projectResult(await observeCase(provider,env,item,mode,index+1),item);
      results.push(record);appendFileSync(progress,JSON.stringify({ordinal:index+1,...record})+'\n');
      console.log(JSON.stringify({ordinal:index+1,id:item.id,priority:record.actual.priority,status:record.status,attempts:record.attempts,passed:record.passed,latencyMs:record.latencyMs}));
    }
    observer.restore();observer=null;
    const finishedAt=new Date().toISOString();
    // Save complete raw results before any postflight/CLI failure can occur.
    const payload={snapshot:snapshotFor(results,{runId,startedAt,finishedAt}),commit:pre.git.commit,environment:{node:process.version,temperature:env.AI_TEMPERATURE,maxOutputTokens:env.AI_MAX_OUTPUT_TOKENS,protocolSha256:protocolHash,evidenceFile:prefix+'_ENVIRONMENT.json'},timingSummary:timingSummary(results),results};
    if(mode==='diagnostics'){
      const distributions=Object.fromEntries(diagnosticIds.map(id=>[id,results.filter(r=>r.id===id).reduce((out,r)=>{const key=r.actual.priority??r.failureCategory;out[key]=(out[key]??0)+1;return out;},{})]));
      saveNew(join(evidence,'V1_PRIORITY_STABILITY.json'),{at:finishedAt,diagnosticOnly:true,protocolSha256:protocolHash,repetitionsPerCase:5,distributions,timingSummary:payload.timingSummary,results});
      console.log(JSON.stringify({distributions,timingSummary:payload.timingSummary}));
    }else{
      saveNew(join(evidence,'V1_AI_EVALUATION.json'),payload);
      const resultPath='docs/evaluation/results/m9-'+finishedAt.replace(/[:.]/g,'-')+'.json';saveNew(resultPath,payload);
      const comparison=checkedComparison(payload,read(baselinePath));
      mkdirSync('artifacts',{recursive:true});const scratch=mkdtempSync(resolve('artifacts/v1-comparator-'));
      mkdirSync(join(scratch,'docs/verification/evidence'),{recursive:true});
      const comparator=resolve('scripts/evaluation/m9-compare.mjs');
      const cli=spawnSync(process.execPath,[comparator,resolve(baselinePath),resolve(resultPath)],{cwd:scratch,encoding:'utf8',windowsHide:true,timeout:15000});
      assert.equal(cli.error,undefined,'Comparator could not execute');
      const actual=read(join(scratch,'docs/verification/evidence/M9_EVAL_REGRESSION.json'));
      assert.deepEqual(actual.regressions,comparison.regressions);assert.equal(cli.status,comparison.passed?0:1);
      saveNew(join(evidence,'V1_EVAL_REGRESSION.json'),{at:finishedAt,baseline:baselinePath,current:resultPath,comparator:'scripts/evaluation/m9-compare.mjs',comparatorSha256:sha256(readFileSync(comparator)),scratch:relative(process.cwd(),scratch).replaceAll('\\','/'),exitCode:cli.status,...comparison});
      process.exitCode=cli.status;
      console.log(JSON.stringify({snapshot:payload.snapshot,comparator:{passed:comparison.passed,exit:cli.status,flags:comparison.regressions.length,failToPass:comparison.failToPass}}));
    }
    const post=await captureEnvironment(env,mode+'-after-cases');saveNew(join(evidence,prefix+'_ENVIRONMENT_AFTER.json'),post);
    verifyProtected(protectedEvidence);
    const integrityProblems=isolationProblems(post,{warm:true});
    if(post.protocol.sha256!==protocolHash)integrityProblems.push('PROTOCOL_CHANGED');
    if(JSON.stringify(pre.git.sourceHashes)!==JSON.stringify(post.git.sourceHashes))integrityProblems.push('SOURCE_CHANGED');
    if(pre.ollama.version!==post.ollama.version||pre.ollama.templateSha256!==post.ollama.templateSha256||pre.ollama.parametersSha256!==post.ollama.parametersSha256)integrityProblems.push('RUNTIME_IDENTITY_CHANGED');
    const productionChangedFiles=execFileSync('git',['diff','--name-only','584bd984','--','apps','packages','datasets','.env.example','docker-compose.yml'],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
    if(productionChangedFiles.length)integrityProblems.push('PRODUCTION_SOURCE_CHANGED');
    saveNew(join(evidence,prefix+'_COMPLETION.json'),{at:new Date().toISOString(),runId,mode,cases:results.length,integrityProblems,protectedEvidenceUnchanged:true,productionChangedFiles,status:integrityProblems.length?'INVALID':'COMPLETED',releaseApproval:false});
    if(integrityProblems.length)process.exitCode=2;
  }finally{observer?.restore();unlinkSync(lockPath);}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/release-evaluate.mjs'))await runRelease(process.argv[2]);
