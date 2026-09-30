import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {parseApiEnvironment} from '@mobiflow/config';
import {boundedJson} from '../../apps/api/dist/ai/ollama-provider.js';
import {promptVersion,outputFormat} from '../../apps/api/dist/ai/prompts/request-analysis.js';

export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const protocolPath='docs/evaluation/RELEASE_EVALUATION_PROTOCOL.md';
export const datasetPath='datasets/ai-evaluation/requests.json';
export const pinned={datasetVersion:'requests.m9.v2',datasetHash:'e462988851955ed05edbb8c6b05dd5b73b4bc9c975bb60be42b3f2999ac6bc44',model:'qwen3:4b-instruct-2507-q4_K_M',digest:'d5364eb63691d8dc2812a1749a6bd621e26b1ff3aceb320bf223372276dcf641',promptVersion:'request-analysis.v4',schemaVersion:'analysis.v1'};
export const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6}).trim();
export const saveNew=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
export async function ollamaRead(env,path,body){
  const base=new URL(env.OLLAMA_BASE_URL);
  if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||base.username||base.password)throw Error('Release collector requires local Ollama');
  const response=await fetch(new URL(path,base),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Ollama metadata unavailable');
  return boundedJson(response,2e6);
}
const selectedModel=(models,name)=>{
  const item=models.find(m=>m.name===name);
  return item?{name:item.name,digest:item.digest,sizeBytes:item.size,details:{family:item.details?.family,parameterSize:item.details?.parameter_size,quantization:item.details?.quantization_level}}:null;
};
export function isolationProblems(environment,{warm=false}={}){
  const problems=[],host=environment.host;
  if(host.docker.status!=='AVAILABLE')problems.push('DOCKER_UNAVAILABLE');
  for(const service of ['api','web']){
    const row=host.docker.services.find(s=>s.Service===service);
    if(!row||!['exited','created'].includes(row.State))problems.push('SERVICE_NOT_ISOLATED_'+service.toUpperCase());
  }
  for(const p of host.processes){
    if(p.self||p.mcpServer)continue;
    if(p.commandUnavailable&&p.executable==='node.exe')problems.push('UNINSPECTABLE_NODE_PROCESS');
    if(['evaluation','appWorker','browserTest','integration','ingestion','build'].some(k=>p[k]))problems.push('COMPETING_PROCESS_'+p.pid);
  }
  if(environment.ollama.loaded.some(m=>m.name!==pinned.model))problems.push('OTHER_MODEL_LOADED');
  if(warm&&!environment.ollama.loaded.some(m=>m.name===pinned.model&&m.digest===pinned.digest&&m.contextLength===16384))problems.push('MODEL_NOT_WARM');
  if(environment.dataset.sha256!==pinned.datasetHash||environment.dataset.count!==100)problems.push('DATASET_DRIFT');
  if(environment.ollama.model?.name!==pinned.model||environment.ollama.model?.digest!==pinned.digest)problems.push('MODEL_DRIFT');
  if(environment.contract.promptVersion!==pinned.promptVersion)problems.push('PROMPT_DRIFT');
  if(environment.contract.temperature!==0||environment.contract.maxOutputTokens!==1200||environment.contract.attemptTimeoutMs!==120000||environment.contract.runTimeoutMs!==300000)problems.push('CONFIG_DRIFT');
  return problems;
}
export async function captureEnvironment(env,label){
  const host=JSON.parse(execFileSync('pwsh',['-NoProfile','-File','scripts/evaluation/capture-release-host.ps1','-EvaluatorPid',String(process.pid)],{encoding:'utf8',timeout:30000,windowsHide:true,maxBuffer:2e6}));
  const [version,inventory,loaded,show]=await Promise.all([ollamaRead(env,'/api/version'),ollamaRead(env,'/api/tags'),ollamaRead(env,'/api/ps'),ollamaRead(env,'/api/show',{model:env.OLLAMA_MODEL})]);
  const raw=readFileSync(datasetPath),cases=JSON.parse(raw),paths=git('ls-files','--','apps/api/src/ai','apps/api/src/knowledge','apps/api/src/analytics','packages/contracts/src','packages/config/src','scripts/evaluation','scripts/verification/m10-eval-observer.mjs',datasetPath).split(/\r?\n/).filter(Boolean);
  const untracked=git('ls-files','--others','--exclude-standard','--','scripts/evaluation').split(/\r?\n/).filter(Boolean);
  const sourceHashes=Object.fromEntries([...new Set([...paths,...untracked])].sort().map(path=>[path,sha256(readFileSync(path))]));
  const npmVersion=execFileSync(process.execPath,[process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'--version'],{encoding:'utf8',windowsHide:true,timeout:10000}).trim();
  return {schemaVersion:'release.environment.v1',at:new Date().toISOString(),label,node:process.version,npm:npmVersion,host,
    git:{commit:git('rev-parse','HEAD'),branch:git('branch','--show-current'),dirty:Boolean(git('status','--porcelain')),sourceHashes},
    protocol:{version:'release-evaluation.v1',sha256:sha256(readFileSync(protocolPath))},
    dataset:{version:pinned.datasetVersion,sha256:sha256(raw),count:cases.length,orderedIdsSha256:sha256(JSON.stringify(cases.map(c=>c.id)))},
    contract:{promptVersion,schemaVersion:pinned.schemaVersion,schemaSha256:sha256(JSON.stringify(outputFormat)),structuredOutput:true,stream:false,think:false,temperature:env.AI_TEMPERATURE,seed:42,maxOutputTokens:env.AI_MAX_OUTPUT_TOKENS,contextTokens:16384,attemptTimeoutMs:env.AI_ATTEMPT_TIMEOUT_MS,runTimeoutMs:env.AI_RUN_TIMEOUT_MS,maxAttempts:2,retryBackoffMs:1000,keepAliveExplicit:false,topPExplicit:false,topKExplicit:false},
    ollama:{version:version.version,model:selectedModel(inventory.models,env.OLLAMA_MODEL),embedding:selectedModel(inventory.models,env.OLLAMA_EMBEDDING_MODEL.includes(':')?env.OLLAMA_EMBEDDING_MODEL:env.OLLAMA_EMBEDDING_MODEL+':latest'),
      loaded:loaded.models.map(m=>({name:m.name===env.OLLAMA_MODEL?m.name:'OTHER_MODEL',digest:m.digest,sizeBytes:m.size,vramBytes:m.size_vram,contextLength:m.context_length})),
      templateSha256:typeof show.template==='string'?sha256(show.template):null,parametersSha256:typeof show.parameters==='string'?sha256(show.parameters):null,
      numericDefaults:typeof show.parameters==='string'?show.parameters.split('\n').filter(line=>/^(temperature|top_p|top_k|min_p|repeat_penalty|seed|num_ctx|num_predict)\s+[\d.-]+\s*$/.test(line)):[]},
    limitations:['Between-call host snapshots do not measure utilization during inference.','Historical M9 per-call runtime/digest and provider timings are unavailable.','Windows active power scheme does not establish the Settings power-mode overlay.']};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/capture-release-environment.mjs')){
  const environment=await captureEnvironment(parseApiEnvironment(process.env),'initial-inspection');
  saveNew('docs/verification/evidence/V1_EVAL_ENVIRONMENT_INITIAL.json',environment);
  console.log(JSON.stringify({file:'V1_EVAL_ENVIRONMENT_INITIAL.json',model:environment.ollama.model,problems:isolationProblems(environment)}));
}
