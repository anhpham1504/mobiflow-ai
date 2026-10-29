import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {withM24Database} from './m24-database.mjs';

await withM24Database(async({databaseUrl})=>{
  const child=spawnSync(process.execPath,['--test','apps/api/test/auto-routing.integration.test.mjs'],{cwd:process.cwd(),env:{...process.env,V141_DATABASE_URL:databaseUrl},stdio:'inherit',windowsHide:true});
  assert.equal(child.status,0);
});
