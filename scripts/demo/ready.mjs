import {command} from './release-core.mjs';

for(const [label,args,timeout] of [
  ['knowledge corpus ingestion',['scripts/demo/ingest-knowledge.mjs'],900000],
  ['bounded model warmup',['scripts/demo/warmup.mjs'],180000],
  ['release preflight',['scripts/demo/preflight.mjs'],60000],
]){
  console.log(`M10 ready: ${label}`);
  const result=command(process.execPath,args,{timeout});
  if(result.stdout)console.log(result.stdout);
  if(!result.ok){if(result.stderr)console.error(result.stderr);throw new Error(`${label} failed`);}
}
console.log('M10 ready: PASS (no reset performed)');
