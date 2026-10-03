import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,openSync,closeSync,writeFileSync,readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {saveEvidence} from './evidence.mjs';
const runId=randomUUID(),directory='artifacts/m22/browser-runs/'+runId,runner='mobiflow-m22-verification-runner';mkdirSync(directory,{recursive:true});
const output=openSync(directory+'/server-runtime.log','w');let server,code=1;
try{
  server=spawn('docker',['exec',runner,'node','scripts/verification/m22-browser-server.mjs',runId],{stdio:['ignore',output,output],windowsHide:true});
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('M22 browser server failed; inspect ignored runtime log');try{ready=(await fetch('http://localhost:33400/login',{signal:AbortSignal.timeout(1000)})).ok;}catch{/* bounded isolated readiness */}if(ready)break;await delay(500);}assert.ok(ready,'M22 browser readiness timeout');
  execFileSync('docker',['cp',runner+':/work/'+directory+'/fixtures.json',directory+'/fixtures.json'],{windowsHide:true});
  const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.m22.config.mjs'],{env:{...process.env,M22_BROWSER_RUN_ID:runId},stdio:'inherit',windowsHide:true});[code]=await once(child,'exit');
}finally{
  writeFileSync(directory+'/client-done.json',JSON.stringify({runId,exitCode:code}));
  if(server&&server.exitCode===null)await once(server,'exit');closeSync(output);
}
const results=JSON.parse(readFileSync(directory+'/browser-results.json')),checks=['staff','manager','responsive','states'].flatMap(name=>existsSync(directory+'/'+name+'.json')?[JSON.parse(readFileSync(directory+'/'+name+'.json'))]:[]);
execFileSync('docker',['cp',runner+':/work/'+directory+'/server-report.json',directory+'/server-report.json'],{windowsHide:true});
const serverReport=JSON.parse(readFileSync(directory+'/server-report.json')),success=code===0&&server.exitCode===0&&checks.length===4&&results.stats.unexpected===0&&results.stats.skipped===0;
await saveEvidence('docs/v1.3/evidence/M22_BROWSER.json',{checkedAt:new Date().toISOString(),runId,synthetic:true,browser:'Microsoft Edge on Windows / Playwright',runtime:'Production Next and real API/PG in isolated Linux container',productionBuild:true,isolatedPorts:[33400,33401],stats:results.stats,checks,...serverReport,result:success?'PASS':'FAIL',artifactDirectory:directory,limitations:'503/delay cases are transport fixtures; real delivery/read/handoff use server/database. No WCAG certification or live AI.'});
if(!success)throw new Error('M22 browser gate failed');
