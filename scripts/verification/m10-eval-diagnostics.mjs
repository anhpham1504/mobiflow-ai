import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync,existsSync,mkdirSync} from 'node:fs';
import {parseApiEnvironment} from '@mobiflow/config';
import {analysisMessages,formatFor} from '../../apps/api/dist/ai/prompts/request-analysis.js';
import {compareEvaluation} from '../../apps/api/dist/analytics/metrics.js';
import {boundedJson} from '../../apps/api/dist/ai/ollama-provider.js';
import {hash,inputFor,safeRequest,installObserver,observeCase,sampleIds,priorityIds,summarize} from './m10-eval-observer.mjs';

const evidence='docs/verification/evidence/',ref='v0.9.0-m9',datasetPath='datasets/ai-evaluation/requests.json';
const artifacts={baseline:'m9-2026-09-29T14-17-47-313Z.json',contended:'m9-2026-09-29T16-34-01-887Z.json',isolated:'m9-2026-09-29T16-42-23-764Z.json'};
const env=parseApiEnvironment(process.env),cases=JSON.parse(readFileSync(datasetPath,'utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6}).trim();
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const runs=Object.fromEntries(Object.entries(artifacts).map(([key,file])=>[key,json('docs/evaluation/results/'+file)]));
const save=(name,data)=>writeFileSync(evidence+name+'.json',JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const contractPath=evidence+'M10_EVAL_CONTRACT_DIFF.json';
const config=()=>({model:env.OLLAMA_MODEL,baseUrl:env.OLLAMA_BASE_URL,temperature:env.AI_TEMPERATURE,maxOutputTokens:env.AI_MAX_OUTPUT_TOKENS,attemptTimeoutMs:env.AI_ATTEMPT_TIMEOUT_MS,runTimeoutMs:env.AI_RUN_TIMEOUT_MS});

function historicalCase(item){
  return Object.fromEntries(Object.entries(runs).map(([name,run])=>{
    const r=run.results.find(r=>r.id===item.id);
    const actual={category:r.categoryMatch?item.expected.category:null,priority:r.priorityMatch?item.expected.priority:null,team:r.teamMatch?item.expected.team:null};
    return [name,{actual,provenance:'Match=true implies equality to the frozen expected label; it is not an archived raw prediction. Match=false means exact alternative UNRECORDED, represented by null.',match:{category:r.categoryMatch,priority:r.priorityMatch,team:r.teamMatch},attempts:r.attempts,schemaValid:r.schemaValid,failureCategory:r.failureCategory,latencyMs:r.latencyMs}];
  }));
}
function protect(){
  return git('ls-files','--cached','--others','--exclude-standard','docs/evaluation/results','docs/verification/evidence').split(/\r?\n/).filter(p=>p.startsWith('docs/evaluation/results/')||/\/(?:M9[^/]*|M10_EVAL_(?:RESULT|REGRESSION))\.json$/.test(p)).map(path=>({path,sha256:hash(readFileSync(path))}));
}
function checkProtected(){
  const audit=json(contractPath);
  for(const row of audit.protectedEvidence)assert.equal(hash(readFileSync(row.path)),row.sha256,'Protected evidence changed: '+row.path);
  return {count:audit.protectedEvidence.length,unchanged:true};
}
function audit(){
  const paths=['apps/api/src/ai','apps/api/src/knowledge','apps/api/src/analytics','scripts/evaluation','datasets/ai-evaluation','packages/contracts','.env.example'];
  const changed=git('diff','--name-only',ref,'--',...paths).split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed,[]);
  const normalized=value=>value.toString('utf8').replaceAll('\r\n','\n');
  const files=git('ls-files','--',...paths).split(/\r?\n/).filter(Boolean).map(path=>{
    const baseline=execFileSync('git',['show',ref+':'+path],{maxBuffer:8e6,windowsHide:true});
    const current=readFileSync(path),m9=hash(normalized(baseline)),m10=hash(normalized(current));
    assert.equal(m9,m10,path);return {path,m9NormalizedSha256:m9,m10NormalizedSha256:m10,equal:true};
  });
  const baselineRaw=execFileSync('git',['show',ref+':'+datasetPath],{windowsHide:true}),currentRaw=readFileSync(datasetPath);
  const oldCases=JSON.parse(baselineRaw.toString('utf8'));
  assert.deepEqual(cases,oldCases);assert.equal(cases.length,100);assert.equal(new Set(cases.map(c=>c.id)).size,100);
  assert.equal(hash(currentRaw),hash(baselineRaw));
  for(const run of Object.values(runs)){
    assert.equal(run.snapshot.datasetHash,hash(currentRaw));assert.equal(run.snapshot.datasetVersion,'requests.m9.v2');
    assert.deepEqual(run.results.map(r=>r.id),cases.map(c=>c.id));
  }
  const definitions=[
    ['prompt/version/assembly','request-analysis.v4; analysisMessages; same versioned bilingual instructions'],
    ['schema/strictness/taxonomy','analysis.v1; strict Zod; category/subcategory oneOf; unchanged six categories/four priorities'],
    ['context/preprocessing/truncation','title=input.slice(0,100); full description=input; messages=[]; historyTruncated=false; no normalization; no retrieval'],
    ['routing/team/skills','M9 evaluator static category-to-team route after generation; no team/skill context enters prompt'],
    ['format/stream/think','formatFor(input) JSON Schema; stream=false; think=false'],
    ['token/context/output limits','num_predict=1200; num_ctx=16384; messages<=24000 chars; raw output<=32768 bytes; envelope<=65536'],
    ['timeouts','attempt=120000ms; run=300000ms'],
    ['retry/repair','at most two attempts; 1000ms retry delay; trusted validator feedback only'],
    ['sampling','temperature=0; seed=42; top_p/top_k absent (runtime/model defaults not archived per historical run)'],
    ['keep_alive','absent from production request; runtime default not archived per run'],
    ['provider URL','validated OLLAMA_BASE_URL; tracked example localhost:11434; actual historical run URL UNRECORDED'],
    ['parser/validation','boundedJson + parseAnalysis + strict analysisSchema; no ORM changes'],
    ['expected-label logic','exact category AND priority AND deterministic team; all 100 cases retained'],
    ['comparator','same compareEvaluation; any pass-to-fail, schema/reference loss, more attempts, new failure or latency>1.5x fails'],
  ];
  const components=definitions.map(([component,value])=>({component,m9:value,m10:value,changed:false,canAffectResult:'Yes if changed; no source change found. Runtime-only unknowns are explicitly noted.'}));
  const comparisons=Object.fromEntries(['contended','isolated'].map(name=>{
    const comparison=compareEvaluation(runs[name].results,runs.baseline.results);
    return [name,{...comparison,exitCodeByUnchangedCliPolicy:comparison.passed?0:1,failToPass:runs[name].results.filter(row=>row.passed&&!runs.baseline.results.find(r=>r.id===row.id).passed).map(r=>r.id)}];
  }));
  const selected=cases.filter(c=>[...priorityIds,'M9-065','M9-075','M9-085'].includes(c.id)).map(item=>({id:item.id,syntheticInput:inputFor(item),expected:item.expected,expectedAtM9:oldCases.find(c=>c.id===item.id).expected,historical:historicalCase(item)}));
  const prompts=sampleIds.map(id=>{
    const input=inputFor(cases.find(c=>c.id===id));
    return {id,current:safeRequest({model:env.OLLAMA_MODEL,messages:analysisMessages(input),format:formatFor(input),stream:false,think:false,options:{temperature:env.AI_TEMPERATURE,num_predict:env.AI_MAX_OUTPUT_TOKENS,seed:42,num_ctx:16384}}),m9Equivalence:'Reconstructible identically from byte-equivalent source/data and the same dependency lock entries. Historical wire prompt/token counts were NOT recorded; this is not a claim to possess those observations.'};
  });
  save('M10_EVAL_CONTRACT_DIFF',{at:new Date().toISOString(),baselineRef:ref,baselineCommit:git('rev-parse',ref+'^{commit}'),head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),changed,files,components,
    configDiff:git('diff',ref,'--','packages/config/src/index.ts'),packageDiff:git('diff',ref,'--','package.json','package-lock.json'),actualConfig:config(),
    dataset:{version:'requests.m9.v2',sha256:hash(currentRaw),baselineSha256:hash(baselineRaw),identical:true,totalCases:100,idsIdentical:true,allExpectedLabelsIdentical:true,resultArtifactsStoreLabels:false,labelProvenance:'Frozen tagged dataset plus matching dataset hashes; historical artifacts retain match flags, not expected or actual label text.'},
    selected,prompts,comparisons,protectedEvidence:protect(),diagnosticProtocol:{priorityMaxPerCase:5,priorityDedicatedRepeats:4,priorityFifthRepeat:'one occurrence in the fixed microbenchmark',coldWarmProbe:'normal-01 twice before replays',sampleIds,selection:'Declared before measurement: canonical stable pass, IOT/BILLING, missing facts, both blockers, ambiguity, Vietnamese without accents and all three fail-to-pass examples. Not selected by measured latency.',fullRun:'NOT AUTHORIZED by this runner; requires separately justified intervention.'}});
  console.log(JSON.stringify({audit:'PASS',sourceFiles:files.length,datasetHash:hash(currentRaw),sampleIds,protectedCount:protect().length}));
}
async function api(path,body){
  const response=await fetch(new URL(path,env.OLLAMA_BASE_URL),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000),redirect:'error'});
  assert.equal(response.ok,true,'Runtime diagnostic request failed');return boundedJson(response,2e6);
}
async function runtime(label){
  const host=JSON.parse(execFileSync('pwsh',['-NoProfile','-File','scripts/verification/m10-eval-host.ps1'],{encoding:'utf8',timeout:25000,windowsHide:true}));
  const [version,loaded,tags,show]=await Promise.all([api('/api/version'),api('/api/ps'),api('/api/tags'),api('/api/show',{model:env.OLLAMA_MODEL})]);
  const model=tags.models.find(m=>m.name===env.OLLAMA_MODEL);assert.ok(model,'Configured exact model missing');
  return {label,at:new Date().toISOString(),node:process.version,host,version:version.version,config:config(),loaded:loaded.models.map(m=>({name:m.name,digest:m.digest,size:m.size,size_vram:m.size_vram,context_length:m.context_length,expires_at:m.expires_at})),
    model:{name:model.name,digest:model.digest,details:model.details,template:{length:show.template?.length??null,sha256:show.template?hash(show.template):null},parameters:{length:show.parameters?.length??null,sha256:show.parameters?hash(show.parameters):null,numericDefaults:show.parameters?.split('\n').filter(line=>/^(temperature|top_p|top_k|min_p|repeat_penalty|seed|num_ctx|num_predict)\s+[\d.-]+\s*$/.test(line))??[]},capabilities:show.capabilities}};
}
async function live(){
  const protectedBefore=checkProtected();
  for(const name of ['M10_EVAL_PRIORITY_REPLAY','M10_EVAL_LATENCY_DIAGNOSTIC','M10_EVAL_MICROBENCHMARK','M10_OLLAMA_RUNTIME'])assert.equal(existsSync(evidence+name+'.json'),false,'Diagnostic run already exists; do not silently repeat');
  const pre=await runtime('before-cold-probe');
  assert.ok(pre.host.containers.filter(c=>['api','web'].includes(c.service)).every(c=>c.state==='exited'),'Stop API/web for isolation');
  assert.ok(pre.host.nodes.filter(n=>n.evaluation&&n.pid!==process.pid).length===0,'Competing evaluation process');
  assert.equal(pre.loaded.length,0,'Cold probe requires no loaded model, and no embedding workload');
  const observer=installObserver(),provider=observer.provider(env),all=[],snapshots=[pre];
  mkdirSync(evidence+'iterations',{recursive:true});
  const progress=evidence+'iterations/M10_EVAL_DIAGNOSTIC-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jsonl';
  writeFileSync(progress,'',{flag:'wx'});
  const run=async(id,phase,ordinal)=>{
    const record=await observeCase(provider,env,cases.find(c=>c.id===id),phase,ordinal);all.push(record);appendFileSync(progress,JSON.stringify(record)+'\n');
    console.log(JSON.stringify({id,phase,ordinal,priority:record.analysis?.prioritySuggestion,status:record.status,attempts:record.attempts,latencyMs:record.latencyMs,ollama:record.http.find(r=>r.path==='/api/chat')?.ollama}));
  };
  try{
    await run('normal-01','cold-probe',1);await run('normal-01','warm-probe',2);
    snapshots.push(await runtime('after-cold-and-warm-probe'));
    for(let ordinal=1;ordinal<=4;ordinal++)for(const id of priorityIds)await run(id,'priority-replay',ordinal);
    snapshots.push(await runtime('before-microbenchmark'));
    for(const [index,id] of sampleIds.entries())await run(id,'microbenchmark',index+1);
    snapshots.push(await runtime('after-microbenchmark'));
  }finally{observer.restore();}
  const sample=all.filter(r=>r.phase==='microbenchmark'),priority=all.filter(r=>priorityIds.includes(r.id));
  const distributions=Object.fromEntries(priorityIds.map(id=>[id,priority.filter(r=>r.id===id).reduce((out,r)=>{const label=r.analysis?.prioritySuggestion??r.failureCategory;out[label]=(out[label]??0)+1;return out;},{})]));
  const common={at:new Date().toISOString(),diagnosticOnly:true,notOfficialEvaluation:true,progress,protectedBefore,protectedAfter:checkProtected(),productionContractChanged:false};
  save('M10_OLLAMA_RUNTIME',{...common,snapshots,initialCliObservation:'At 2026-09-29T17:50Z Ollama CLI version reported server unavailable; CLI ps auto-started the Windows app. Only API read diagnostics used subsequently. No evidence ties this later restart to historical M9/M10 results.'});
  save('M10_EVAL_PRIORITY_REPLAY',{...common,distributions,results:priority,historical:json(contractPath).selected.filter(r=>priorityIds.includes(r.id))});
  save('M10_EVAL_MICROBENCHMARK',{...common,caseIds:sampleIds,latency:summarize(sample.map(r=>r.latencyMs)),runnerWall:summarize(sample.map(r=>r.timing.runnerWallMs)),results:sample,
    historicalSubset:Object.fromEntries(Object.entries(runs).map(([name,run])=>[name,summarize(run.results.filter(r=>sampleIds.includes(r.id)).map(r=>r.latencyMs))])),limitations:'Fixed diagnostic subset, not all-case comparison or a replacement release score. Historical per-call token counts/timings are unavailable.'});
  save('M10_EVAL_LATENCY_DIAGNOSTIC',{...common,probes:all.filter(r=>r.phase.endsWith('probe')),allRequestCount:all.length,allAttemptCount:all.reduce((n,r)=>n+r.attempts,0),
    timingMeans:Object.fromEntries(['casePreparationMs','contextConstructionMs','providerWallMs','finalValidationAndCompletionMs','repairProviderMs','runnerWallMs'].map(k=>[k,summarize(sample.map(r=>r.timing[k]))])),
    ollama:Object.fromEntries(['total_duration_ms','load_duration_ms','prompt_eval_duration_ms','eval_duration_ms','prompt_eval_count','eval_count'].map(k=>[
      k,summarize(sample.flatMap(r=>r.http.filter(h=>h.ollama?.[k]!==undefined).map(h=>h.ollama[k])))
    ])),
    interpretation:'Use current component measurements for attribution only. Historical request-level token and host telemetry are missing; no historical generation-speed claim can be derived from these probes alone.'});
  console.log(JSON.stringify({complete:true,distributions,microbenchmark:summarize(sample.map(r=>r.latencyMs)),protectedEvidence:checkProtected()}));
}
const mode=process.argv[2];
if(mode==='audit')audit();
else if(mode==='runtime')console.log(JSON.stringify(await runtime('read-only-snapshot'),null,2));
else if(mode==='live')await live();
else if(mode==='verify-protected')console.log(JSON.stringify(checkProtected()));
else throw Error('Usage: node --env-file=.env scripts/verification/m10-eval-diagnostics.mjs audit|runtime|live|verify-protected');
