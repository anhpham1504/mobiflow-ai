import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {once} from 'node:events';
import {mkdirSync,readFileSync,writeFileSync,createWriteStream,existsSync} from 'node:fs';
import {parseApiEnvironment} from '@mobiflow/config';
import {createApplication} from '../../apps/api/dist/app.js';
import {seedAnalyticsFixture} from '../../apps/api/test/helpers/analytics-v2-fixture.mjs';
import {withM13Database} from './m13-database.mjs';

if(!existsSync('apps/web/.next/BUILD_ID'))throw new Error('Run npm run build before the M13 browser gate');
const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(3000,'127.0.0.1',resolve);});await new Promise(resolve=>probe.close(resolve));
await withM13Database(async({databaseUrl})=>{
  const env=parseApiEnvironment({...process.env,NODE_ENV:'test',DATABASE_URL:databaseUrl,AI_AUTO_ANALYZE:'false',AI_RAG_ENABLED:'false',WEB_ORIGIN:'http://localhost:3000'});
  const s=await createApplication(env,{quiet:true,aiWorker:false,knowledgeWorker:false,log:()=>{}});let web;
  mkdirSync('artifacts/m13',{recursive:true});const output=createWriteStream('artifacts/m13/web-runtime.log');
  try{
    await seedAnalyticsFixture(s.prisma);await s.app.listen(3001,'127.0.0.1');
    web=spawn(process.execPath,['apps/web/scripts/start.mjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',PORT:'3000'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    web.stdout.pipe(output);web.stderr.pipe(output);let ready=false;
    for(let attempt=0;attempt<80;attempt++){
      if(web.exitCode!==null)throw new Error('M13 web failed to start; inspect artifacts/m13/web-runtime.log');
      try{ready=(await fetch('http://localhost:3000/login',{signal:AbortSignal.timeout(1000)})).ok;}catch{/* Bounded readiness polling. */}
      if(ready)break;await delay(500);
    }
    if(!ready)throw new Error('M13 web readiness failed');
    const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.m13.config.mjs'],{cwd:process.cwd(),env:process.env,stdio:'inherit',windowsHide:true});
    const [code]=await once(child,'exit');
    const report=JSON.parse(readFileSync('artifacts/m13/browser-results.json','utf8'));
    const evidence={checkedAt:new Date().toISOString(),result:code===0?'PASS':'FAIL',synthetic:true,database:'mobiflow_m13_test',browser:'Microsoft Edge / Playwright',productionBuild:true,stats:report.stats,smoke:existsSync('artifacts/m13/ui-smoke.json')?JSON.parse(readFileSync('artifacts/m13/ui-smoke.json','utf8')):null,limitations:'Targeted M13 smoke; no historical browser or live-model evaluation run.'};
    mkdirSync('docs/v1.2/evidence',{recursive:true});writeFileSync('docs/v1.2/evidence/M13_BROWSER.json',JSON.stringify(evidence,null,2)+'\n');
    if(code!==0)throw new Error('M13 browser tests failed');
  }finally{
    if(web&&web.exitCode===null){web.kill();await once(web,'exit');}output.end();
    await s.app.close();await s.database.close();await s.prisma.$disconnect();
  }
});
