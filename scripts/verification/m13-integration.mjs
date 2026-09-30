import {spawnSync} from 'node:child_process';
import {withM13Database} from './m13-database.mjs';
await withM13Database(async({databaseUrl})=>{
  const result=spawnSync(process.execPath,['--test','apps/api/test/analytics-v2.integration.test.mjs'],{cwd:process.cwd(),env:{...process.env,M13_DATABASE_URL:databaseUrl},stdio:'inherit'});
  if(result.status!==0)throw new Error('M13 integration failed');
});
