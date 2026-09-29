import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {saveEvidence} from './evidence.mjs';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:60000,windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const startedAt=new Date().toISOString(),began=performance.now();
const id=docker('compose','ps','-q','api');assert.ok(id,'API must be running before shutdown verification');
let report={startedAt,status:'FAIL'};
try{
  docker('compose','stop','api');
  const elapsedMs=Math.round(performance.now()-began),state=JSON.parse(docker('inspect','--format','{{json .State}}',id));
  const log=docker('logs','--since',startedAt,id),events=log.split(/\r?\n/).flatMap(line=>{try{const row=JSON.parse(line);return typeof row.event==='string'&&row.event.startsWith('shutdown.')?[row.event]:[];}catch{return [];}});
  assert.equal(state.ExitCode,0);assert.ok(events.includes('shutdown.started'));assert.ok(events.includes('shutdown.complete'));assert.ok(!events.some(event=>['shutdown.timeout','shutdown.failed','shutdown.forced'].includes(event)));
  report={startedAt,finishedAt:new Date().toISOString(),status:'PASS',elapsedMs,exitCode:state.ExitCode,events};
}finally{
  docker('compose','up','-d','api');
  await saveEvidence('docs/verification/evidence/M10_GRACEFUL_SHUTDOWN.json',report);
}
console.log(JSON.stringify(report));
