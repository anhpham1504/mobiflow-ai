import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {withM22Database} from './m22-database.mjs';
import {saveEvidence} from './evidence.mjs';
await withM22Database(async({databaseUrl,ownerUrl})=>{
  const child=spawnSync(process.execPath,['--test','apps/api/test/sla-alert.integration.test.mjs'],{env:{...process.env,M22_DATABASE_URL:databaseUrl,M22_OWNER_DATABASE_URL:ownerUrl},stdio:'inherit',windowsHide:true});
  const report=JSON.parse(readFileSync('artifacts/m22/api-report.json','utf8'));await saveEvidence('docs/v1.3/evidence/M22_API.json',{...report,result:child.status===0?'PASS':'FAIL',exitCode:child.status,testCommand:'node --test apps/api/test/sla-alert.integration.test.mjs'});
  if(child.status!==0)throw new Error('M22 PostgreSQL/API gate failed');assert.equal(Object.keys(report.checks).length,10);assert.ok(Object.values(report.checks).every(v=>v==='PASS'));assert.equal(report.aiCalls,0);
});
