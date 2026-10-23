import {command} from './release-core.mjs';

const tasks=[['knowledge corpus ingestion',['scripts/demo/ingest-knowledge.mjs'],900000]];
if(process.env.AI_GENERATION_PROVIDER==='ollama')tasks.push(['bounded rollback-model warmup',['scripts/demo/warmup.mjs'],180000]);
else console.log('V1.3 ready: DeepSeek warmup skipped; no billable request is made by demo preparation.');
tasks.push(['release preflight',['scripts/demo/preflight.mjs'],60000]);
for(const [label,args,timeout] of tasks){
  console.log(`M10 ready: ${label}`);
  const result=command(process.execPath,args,{timeout});
  if(result.stdout)console.log(result.stdout);
  if(!result.ok){if(result.stderr)console.error(result.stderr);throw new Error(`${label} failed`);}
}
console.log('V1.3 ready: PASS (no reset, Ollama start, or DeepSeek generation performed)');
