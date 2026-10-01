import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {saveEvidence} from './evidence.mjs';

const startedAt=new Date().toISOString(),commands=['npm run lint','npm run typecheck','npm run test','npm run build'],results=[];
for(const command of commands){
  const start=performance.now();
  console.log('Running '+command);
  const result=process.platform==='win32'?spawnSync(process.env.ComSpec??'cmd.exe',['/d','/s','/c',command],{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}):spawnSync('npm',command.split(' ').slice(1),{encoding:'utf8',maxBuffer:16*1024*1024});
  results.push({command,result:result.status===0?'PASS':'FAIL',exitCode:result.status,durationMs:Math.round(performance.now()-start),stdout:result.stdout??'',stderr:result.stderr??'',error:result.error?.message});
  console.log(command+': '+results.at(-1).result);
}
const paths=['package.json','apps/api/package.json','apps/api/src/ai/prompts/recommendation.ts','apps/api/src/ai/recommendation-output.ts','packages/contracts/src/recommendation.ts'];
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const report={startedAt,finishedAt:new Date().toISOString(),result:results.every(row=>row.result==='PASS')?'PASS':'FAIL',sourceHashes,results};
await saveEvidence('docs/v1.2/evidence/M15_FINAL_GATES.json',report);
if(report.result!=='PASS')process.exitCode=1;
