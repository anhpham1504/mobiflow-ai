import {readFileSync,mkdirSync} from 'node:fs';
import {writeEvaluationFile as writeFileSync} from './evidence-output.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {z} from 'zod';
import {parseApiEnvironment} from '@mobiflow/config';
import {categories,priorities,analysisSchema,analysisSchemaVersion} from '@mobiflow/contracts';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {executeAnalysis} from '../../apps/api/dist/ai/analysis-execution.js';
import {promptVersion} from '../../apps/api/dist/ai/prompts/request-analysis.js';
const raw=readFileSync('datasets/ai-evaluation/requests.json','utf8');
const caseSchema=z.object({id:z.string().min(1),input:z.string().min(10).max(10000),expected:z.object({category:z.enum(categories),priority:z.enum(priorities),team:z.string(),entities:analysisSchema.shape.entities.optional(),missingFields:analysisSchema.shape.missingFields.optional()}).strict(),tags:z.array(z.string())}).strict();
const cases=z.array(caseSchema).length(50).parse(JSON.parse(raw));
if(new Set(cases.map(c=>c.id)).size!==50)throw new Error('Duplicate dataset ID');
for(const [tag,count] of Object.entries({normal:30,incomplete:10,ambiguous:5,noisy:5}))if(cases.filter(c=>c.tags.includes(tag)).length!==count)throw new Error('Invalid dataset distribution');
const env=parseApiEnvironment(process.env),provider=new OllamaProvider(env),results=[];
const report={datasetHash:createHash('sha256').update(raw).digest('hex'),datasetVersion:'m4.v1',promptVersion,schemaVersion:analysisSchemaVersion,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,provider:env.AI_PROVIDER,model:env.OLLAMA_MODEL,temperature:env.AI_TEMPERATURE,maxOutputTokens:env.AI_MAX_OUTPUT_TOKENS,attemptTimeoutMs:env.AI_ATTEMPT_TIMEOUT_MS,runTimeoutMs:env.AI_RUN_TIMEOUT_MS,startedAt:new Date().toISOString(),warmState:'Not prewarmed by harness; first case may load model.',results};
mkdirSync('artifacts/m4',{recursive:true});
const norm=x=>typeof x==='string'?x.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase():x;
for(const c of cases){
  const started=performance.now();let attemptCount=0;
  try{
    const r=await executeAnalysis(provider,{title:c.input.slice(0,100),description:c.input,messages:[],historyTruncated:false},AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS),async n=>{attemptCount=n+1;});
    results.push({id:c.id,status:'SUCCEEDED',attemptCount,latencyMs:r.latencyMs,firstAttemptValid:r.firstAttemptValid,identity:r.identity,result:r.analysis,categoryMatch:r.analysis.category===c.expected.category,priorityMatch:r.analysis.prioritySuggestion===c.expected.priority,entityMatches:c.expected.entities?Object.fromEntries(Object.entries(c.expected.entities).map(([key,value])=>[key,norm(value)===norm(r.analysis.entities[key])])):null,missingFound:(c.expected.missingFields??[]).filter(f=>r.analysis.missingFields.includes(f)).length,missingExpected:(c.expected.missingFields??[]).length});
  }catch(error){results.push({id:c.id,status:'FAILED',attemptCount,latencyMs:Math.round(performance.now()-started),errorCode:error.code??'AI_ANALYSIS_FAILED',firstAttemptValid:false,categoryMatch:false,priorityMatch:false,entityMatches:c.expected.entities?Object.fromEntries(Object.keys(c.expected.entities).map(k=>[k,false])):null,missingFound:0,missingExpected:(c.expected.missingFields??[]).length});}
  writeFileSync('artifacts/m4/evaluation-progress.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({case:c.id,status:results.at(-1).status,latencyMs:results.at(-1).latencyMs}));
}
const latency=rows=>{const values=rows.map(r=>r.latencyMs).sort((a,b)=>a-b);return {count:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,p50:values[Math.ceil(values.length*.5)-1]??null,p95:values[Math.ceil(values.length*.95)-1]??null};};
report.finishedAt=new Date().toISOString();
report.metrics={cases:results.length,completed:results.filter(r=>r.status==='SUCCEEDED').length,schemaValid:results.filter(r=>r.status==='SUCCEEDED').length,firstAttemptValid:results.filter(r=>r.firstAttemptValid).length,categoryAgreement:results.filter(r=>r.categoryMatch).length,priorityAgreement:results.filter(r=>r.priorityMatch).length,missingInformation:{found:results.reduce((n,r)=>n+r.missingFound,0),expected:results.reduce((n,r)=>n+r.missingExpected,0)},entities:Object.fromEntries(['customer','location','affectedCount','startedAt'].map(key=>[key,{matched:results.filter(r=>r.entityMatches?.[key]).length,total:results.filter(r=>r.entityMatches!==null).length}])),latencyAll:latency(results),latencySuccessful:latency(results.filter(r=>r.status==='SUCCEEDED'))};
report.limitations='Small synthetic specification-labeled set; no calibrated confidence or generalized accuracy claim. All errors retained in denominators. No M5 retrieval or routing inference.';
writeFileSync('docs/verification/evidence/M4_AI_EVAL.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.metrics));
if(results.some(r=>r.status==='FAILED'))process.exitCode=1;
