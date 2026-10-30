import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const definitions={
  'deepseek-lexical':{AI_GENERATION_PROVIDER:'deepseek',AI_PROVIDER:'deepseek',RAG_RETRIEVAL_MODE:'lexical'},
  'ollama-vector':{AI_GENERATION_PROVIDER:'ollama',AI_PROVIDER:'ollama',RAG_RETRIEVAL_MODE:'vector'},
};
const requested=process.argv[2]??'all',reverse=process.argv.includes('--reverse');
assert.ok(requested==='all'||requested in definitions,'Expected deepseek-lexical, ollama-vector, or all');
const runtimeManifest=process.env.M24_RUNTIME_MANIFEST??'artifacts/m24/runtime-private.json';
const runtime=JSON.parse(readFileSync(runtimeManifest,'utf8'));
for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL']){
  const target=new URL(runtime[key]);
  assert.equal(target.protocol,'postgresql:');assert.ok(['127.0.0.1','localhost'].includes(target.hostname));assert.equal(target.pathname,'/mobiflow');
}
let profiles=requested==='all'?Object.keys(definitions):[requested];if(reverse)profiles=profiles.reverse();
const matrix=[];
for(const profile of profiles){
  const started=Date.now(),env={...process.env,...definitions[profile],NODE_ENV:'test',M2_PROFILE_INTEGRATION:'true',AI_LIVE_CALLS_ENABLED:'false',DEEPSEEK_API_KEY:'',DATABASE_URL:runtime.DATABASE_URL,MIGRATION_DATABASE_URL:runtime.MIGRATION_DATABASE_URL,DEMO_MODE:'true',JWT_SECRET:'m2-profile-jwt-secret-'.padEnd(48,'a'),REFRESH_TOKEN_SECRET:'m2-profile-refresh-secret-'.padEnd(48,'b')};
  for(const script of ['scripts/verification/m2-integration.mjs','scripts/verification/m24-integration.mjs']){
    console.log(JSON.stringify({event:'m2.profile.start',profile,script,liveAi:false}));
    const child=spawnSync(process.execPath,[script],{cwd:process.cwd(),env,stdio:'inherit',windowsHide:true});
    if(child.status!==0)throw new Error(`${profile} failed in ${script} with exit code ${child.status}`);
  }
  matrix.push({profile,generationProvider:definitions[profile].AI_GENERATION_PROVIDER,retrievalMode:definitions[profile].RAG_RETRIEVAL_MODE,m2:'PASS',m24:'PASS',liveAi:'NOT RUN',durationMs:Date.now()-started});
}
mkdirSync('artifacts/m2',{recursive:true});writeFileSync(`artifacts/m2/profile-matrix${reverse?'-reverse':''}.json`,JSON.stringify({checkedAt:new Date().toISOString(),order:profiles,matrix},null,2)+'\n');
console.log(JSON.stringify({event:'m2.profile.matrix',result:'PASS',order:profiles,matrix}));
