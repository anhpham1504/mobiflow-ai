import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {CanaryGuardError,createCanaryFetchGuard} from './deepseek-canary-fetch-guard.mjs';

const payload=overrides=>JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},messages:[{role:'system',content:'Return json matching OUTPUT_JSON_SCHEMA={"type":"object"}'},{role:'user',content:'Synthetic IoT fixture only.'}],response_format:{type:'json_object'},stream:false,temperature:0,max_tokens:1200,...overrides});
const init=body=>({method:'POST',redirect:'error',headers:{Authorization:'Bearer '+'synthetic-token-material-do-not-use','Content-Type':'application/json'},body});
const ok=()=>new globalThis.Response(JSON.stringify({id:'synthetic-provider-id',model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120,prompt_cache_hit_tokens:40,prompt_cache_miss_tokens:60}}),{status:200,headers:{'Content-Type':'application/json'}});

test('persistent canary ledger counts before dispatch, stores only hashes/usage and caps across guard instances',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mobiflow-canary-'));t.after(()=>rm(dir,{recursive:true,force:true}));const ledger=join(dir,'ledger.json');let calls=0;
  const first=createCanaryFetchGuard({fetchImpl:async()=>{calls++;return ok();},ledgerPath:ledger,maxHttpAttempts:1});
  await first('https://api.deepseek.com/chat/completions',init(payload()));
  const state=JSON.parse(await readFile(ledger,'utf8'));assert.equal(state.schemaVersion,'mobiflow-deepseek-m3-ledger.v2');assert.equal(state.attemptCount,1);assert.equal(state.completedCount,1);assert.equal(state.failedCount,0);assert.equal(state.timeoutCount,0);assert.equal(state.remainingAttempts,0);assert.equal(state.entries[0].thinking,'disabled');assert.equal(state.entries[0].status,'HTTP_OK');assert.equal(state.entries[0].usage.promptTokens,100);assert.equal(state.entries[0].usageStatus,'REPORTED');assert.ok(state.entries[0].bodySha256);assert.equal(JSON.stringify(state).includes('Synthetic IoT fixture'),false);assert.equal(JSON.stringify(state).includes('synthetic-token-material'),false);
  const second=createCanaryFetchGuard({fetchImpl:async()=>{calls++;return ok();},ledgerPath:ledger,maxHttpAttempts:1});
  await assert.rejects(second('https://api.deepseek.com/chat/completions',init(payload())),error=>error instanceof CanaryGuardError&&error.code==='CANARY_HTTP_LIMIT_REACHED');assert.equal(calls,1);
});

test('guard blocks wrong origin, implicit thinking, privacy marker and oversized reservation before HTTP',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mobiflow-canary-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
  const make=name=>createCanaryFetchGuard({fetchImpl:async()=>{calls++;return ok();},ledgerPath:join(dir,name+'.json'),budgetUsd:.10});
  await assert.rejects(make('origin')('https://example.test/chat/completions',init(payload())),error=>error.code==='CANARY_EGRESS_BLOCKED');
  await assert.rejects(make('thinking')('https://api.deepseek.com/chat/completions',init(payload({thinking:undefined}))),error=>error.code==='CANARY_MODEL_CONTRACT_INVALID');
  await assert.rejects(make('privacy')('https://api.deepseek.com/chat/completions',init(payload({messages:[{role:'system',content:'json OUTPUT_JSON_SCHEMA={} CANARY_INTERNAL_NOTE_FORBIDDEN'}]}))),error=>error.code==='CANARY_PRIVACY_BLOCKED');
  await assert.rejects(make('phone')('https://api.deepseek.com/chat/completions',init(payload({messages:[{role:'system',content:'json OUTPUT_JSON_SCHEMA={} synthetic contact +84 901 234 567'}]}))),error=>error.code==='CANARY_PRIVACY_BLOCKED');
  await assert.rejects(createCanaryFetchGuard({fetchImpl:async()=>{calls++;return ok();},ledgerPath:join(dir,'budget.json'),budgetUsd:.000001})('https://api.deepseek.com/chat/completions',init(payload())),error=>error.code==='CANARY_BUDGET_EXHAUSTED');assert.equal(calls,0);
});

test('guard permits ISO dates and numeric UUIDs used by sanitized application context',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mobiflow-canary-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
  const guarded=createCanaryFetchGuard({fetchImpl:async()=>{calls++;return ok();},ledgerPath:join(dir,'ledger.json'),maxHttpAttempts:1});
  const messages=[{role:'system',content:'Return json matching OUTPUT_JSON_SCHEMA={"type":"object"}'},{role:'user',content:'Synthetic snapshot at 2026-10-23 with staffId 10000000-0000-4000-8000-000000000003.'}];
  const response=await guarded('https://api.deepseek.com/chat/completions',init(payload({messages})));
  assert.equal(response.status,200);assert.equal(calls,1);
});

test('transport failure still consumes the persistent request slot without retry',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mobiflow-canary-'));t.after(()=>rm(dir,{recursive:true,force:true}));const ledger=join(dir,'ledger.json');let calls=0;
  const guarded=createCanaryFetchGuard({fetchImpl:async()=>{calls++;throw new Error('synthetic transport failure');},ledgerPath:ledger,maxHttpAttempts:1});
  await assert.rejects(guarded('https://api.deepseek.com/chat/completions',init(payload())),/synthetic transport failure/);
  const state=JSON.parse(await readFile(ledger,'utf8'));assert.equal(state.attemptCount,1);assert.equal(state.failedCount,1);assert.equal(state.entries[0].status,'TRANSPORT_ERROR');assert.equal(state.uncertainCostUsd,state.entries[0].uncertainCostUsd);assert.ok(state.uncertainCostUsd>0);assert.equal(calls,1);
});

test('call 21 is blocked before HTTP and concurrent contenders cannot exceed the shared cap',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mobiflow-canary-'));t.after(()=>rm(dir,{recursive:true,force:true}));const ledger=join(dir,'ledger.json');let calls=0;
  const make=()=>createCanaryFetchGuard({fetchImpl:async()=>{calls++;return ok();},ledgerPath:ledger,maxHttpAttempts:20,budgetUsd:.50});
  const results=await Promise.allSettled(Array.from({length:24},()=>make()('https://api.deepseek.com/chat/completions',init(payload()))));
  assert.equal(results.filter(item=>item.status==='fulfilled').length,20);assert.equal(results.filter(item=>item.status==='rejected'&&item.reason?.code==='CANARY_HTTP_LIMIT_REACHED').length,4);assert.equal(calls,20);
  const state=JSON.parse(await readFile(ledger,'utf8'));assert.equal(state.attemptCount,20);assert.equal(state.completedCount,20);assert.equal(state.remainingAttempts,0);assert.ok(state.actualOrReservedSpendUsd<=.50);
});

test('budget exhaustion blocks before HTTP and a bounded retry consumes another attempt',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mobiflow-canary-'));t.after(()=>rm(dir,{recursive:true,force:true}));const ledger=join(dir,'ledger.json');let calls=0;
  const responses=[new globalThis.Response(JSON.stringify({error:{message:'synthetic'}}),{status:500,headers:{'Content-Type':'application/json'}}),ok()];
  const guarded=createCanaryFetchGuard({fetchImpl:async()=>{calls++;return responses.shift();},ledgerPath:ledger,maxHttpAttempts:20,budgetUsd:.50});
  await guarded('https://api.deepseek.com/chat/completions',init(payload()));await guarded('https://api.deepseek.com/chat/completions',init(payload()));
  let state=JSON.parse(await readFile(ledger,'utf8'));assert.equal(state.attemptCount,2);assert.equal(state.completedCount,2);assert.equal(state.failedCount,1);assert.equal(calls,2);
  const blocked=createCanaryFetchGuard({fetchImpl:async()=>{calls++;return ok();},ledgerPath:join(dir,'budget.json'),budgetUsd:.000001});
  await assert.rejects(blocked('https://api.deepseek.com/chat/completions',init(payload())),error=>error.code==='CANARY_BUDGET_EXHAUSTED');assert.equal(calls,2);
});

test('timeout and missing usage retain conservative uncertain cost',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mobiflow-canary-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const timeoutLedger=join(dir,'timeout.json');const timed=createCanaryFetchGuard({fetchImpl:async()=>{throw new globalThis.DOMException('synthetic timeout','TimeoutError');},ledgerPath:timeoutLedger,maxHttpAttempts:20,budgetUsd:.50});
  await assert.rejects(timed('https://api.deepseek.com/chat/completions',init(payload())),error=>error.name==='TimeoutError');
  const timedState=JSON.parse(await readFile(timeoutLedger,'utf8'));assert.equal(timedState.attemptCount,1);assert.equal(timedState.failedCount,1);assert.equal(timedState.timeoutCount,1);assert.ok(timedState.uncertainCostUsd>0);assert.equal(timedState.reservedCostUsd,0);
  const missingLedger=join(dir,'missing.json');const missing=createCanaryFetchGuard({fetchImpl:async()=>new globalThis.Response(JSON.stringify({id:'synthetic',model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:'{}'}}]}),{status:200,headers:{'Content-Type':'application/json'}}),ledgerPath:missingLedger,maxHttpAttempts:20,budgetUsd:.50});
  await missing('https://api.deepseek.com/chat/completions',init(payload()));
  const missingState=JSON.parse(await readFile(missingLedger,'utf8'));assert.equal(missingState.completedCount,1);assert.equal(missingState.failedCount,0);assert.ok(missingState.uncertainCostUsd>0);assert.equal(missingState.entries[0].usageStatus,'MISSING');
});
