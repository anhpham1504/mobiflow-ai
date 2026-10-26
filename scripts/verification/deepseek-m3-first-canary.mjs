import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCanaryFetchGuard} from './deepseek-canary-fetch-guard.mjs';

const ledgerPath=resolve('artifacts/m3/runtime/ledger.json');
const outputPath=resolve('artifacts/m3/first-live-canary.json');
assert.ok(process.env.DEEPSEEK_API_KEY,'BLOCKED_NO_KEY');
const guarded=createCanaryFetchGuard({fetchImpl:globalThis.fetch.bind(globalThis),ledgerPath,maxHttpAttempts:20,budgetUsd:.50,maxOutputTokens:1200,cacheHitInputPerMillion:.006,cacheMissInputPerMillion:.30,outputPerMillion:1.20});
const body=JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},messages:[{role:'system',content:'Return exactly one JSON object matching OUTPUT_JSON_SCHEMA. OUTPUT_JSON_SCHEMA={"type":"object","additionalProperties":false,"required":["synthetic","status"],"properties":{"synthetic":{"const":true},"status":{"const":"READY"}}}'},{role:'user',content:'Synthetic MobiFlow M3 connectivity canary. No customer, contact, internal document, web search, or tool call.'}],response_format:{type:'json_object'},stream:false,temperature:0,max_tokens:128});
const started=performance.now();let evidence;
try{
  const response=await guarded('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${process.env.DEEPSEEK_API_KEY}`,'Content-Type':'application/json'},body});
  assert.equal(response.status,200);const envelope=await response.json();assert.equal(envelope.model,'deepseek-flash');assert.equal(envelope.choices?.[0]?.finish_reason,'stop');const value=JSON.parse(envelope.choices[0].message.content);assert.deepEqual(value,{synthetic:true,status:'READY'});
  const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));assert.equal(ledger.attemptCount,1);assert.equal(ledger.completedCount,1);assert.equal(ledger.failedCount,0);assert.equal(ledger.entries[0].usageStatus,'REPORTED');
  evidence={checkedAt:new Date().toISOString(),result:'PASS',provider:'deepseek',model:envelope.model,structuredOutput:true,syntheticOnly:true,noToolCall:!envelope.choices[0].message.tool_calls,latencyMs:Math.round(performance.now()-started),responseSha256:createHash('sha256').update(envelope.choices[0].message.content).digest('hex'),ledger:{attemptCount:ledger.attemptCount,completedCount:ledger.completedCount,failedCount:ledger.failedCount,timeoutCount:ledger.timeoutCount,reportedCostUsd:ledger.reportedCostUsd,uncertainCostUsd:ledger.uncertainCostUsd,remainingAttempts:ledger.remainingAttempts,remainingBudgetUsd:ledger.remainingBudgetUsd}};
}catch(error){evidence={checkedAt:new Date().toISOString(),result:'FAIL',errorCode:error?.code??error?.name??'ERROR',latencyMs:Math.round(performance.now()-started)};process.exitCode=1;}
await mkdir(resolve('artifacts/m3'),{recursive:true});await writeFile(outputPath,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(evidence));
