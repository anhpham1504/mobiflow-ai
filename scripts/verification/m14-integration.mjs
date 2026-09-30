import {spawnSync} from 'node:child_process';
import {withM14Database} from './m14-database.mjs';
await withM14Database(async({databaseUrl,ownerUrl})=>{
  const result=spawnSync(process.execPath,['--test','apps/api/test/recommendation-v2.integration.test.mjs'],{cwd:process.cwd(),env:{...process.env,M14_DATABASE_URL:databaseUrl,M14_OWNER_DATABASE_URL:ownerUrl},stdio:'inherit',windowsHide:true});
  if(result.status!==0)throw new Error('M14 integration failed');
});
