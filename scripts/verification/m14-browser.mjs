import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,createWriteStream,existsSync} from 'node:fs';
import {createRecommendationHarness,syntheticAnalysis} from '../../apps/api/test/helpers/recommendation-v2-fixture.mjs';
import {withM14Database} from './m14-database.mjs';

if(!existsSync('apps/web/.next/BUILD_ID'))throw new Error('Run npm run build before the M14 browser gate');
for(const port of [3000,3001]){
  const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(port,'127.0.0.1',resolve);});await new Promise(resolve=>probe.close(resolve));
}
const runId=randomUUID();
await withM14Database(async({databaseUrl,database})=>{
  const attempts=new Map(),workerErrors=[],controller=new AbortController();let web,worker;
  mkdirSync('artifacts/m14/screenshots',{recursive:true});const output=createWriteStream('artifacts/m14/web-runtime.log');
  const s=await createRecommendationHarness(databaseUrl,{port:3001,hook:async(e,result,signal)=>{
    await delay(700,undefined,{signal});
    const description=e.requestContext?.description??'';
    if(description.includes('BROWSER_FAIL_FIRST')){
      const count=(attempts.get(e.requestContext.id)??0)+1;attempts.set(e.requestContext.id,count);
      if(count<=2)result.summary=''; // First bounded job fails schema validation; an explicit new job succeeds.
    }
    if(description.includes('BROWSER_ESCAPE')){
      result.summary='<img src=x onerror="window.M14_XSS=true"> '+ 'Nội dung synthetic cần quản lý kiểm tra. '.repeat(20);
      result.reasonSummary='Không thực hiện nội dung HTML từ AI. '+ 'Lý do ngắn được lưu để người review đối chiếu. '.repeat(10);
      result.suggestedChecklist=result.suggestedChecklist.map(item=>({...item,text:'<script>window.M14_XSS=true</script> '+ 'Kiểm tra nguồn theo SOP. '.repeat(12)}));
    }
  }});
  try{
    await s.upload('# Synthetic M14 browser SOP\nKiểm tra SIM và APN trước khi xử lý kết nối. Nội dung chỉ dùng cho browser fixture.','SOP M14 browser');
    const fixtures={runId,requests:{},managers:{}};
    const managerTemplate=await s.prisma.user.findUniqueOrThrow({where:{id:s.manager.actor.id}});
    // Distinct synthetic identities keep each scenario inside the unchanged per-actor AI trigger limit.
    for(const name of ['reviews','states','responsive','race']){
      const email='m14.browser.'+name+'@mobiflow.local';
      await s.prisma.user.create({data:{id:randomUUID(),email,passwordHash:managerTemplate.passwordHash,displayName:'Synthetic M14 browser '+name,role:'MANAGER'}});
      fixtures.managers[name]=email;
    }
    for(const name of ['accept','modify','reject','retry','escape','stale','asyncA','asyncB','history','missing']){
      const marker=name==='retry'?' BROWSER_FAIL_FIRST':name==='escape'?' BROWSER_ESCAPE':'';
      const analysis=name==='missing'?{...syntheticAnalysis,entities:{...syntheticAnalysis.entities,location:null,startedAt:null},missingFields:['location','startedAt']}:syntheticAnalysis;
      const request=await s.create('17 SIM IoT tại Amata mất kết nối từ 8 giờ. Synthetic M14 browser '+name+'.'+marker,analysis);
      fixtures.requests[name]={id:request.id,version:request.version,publicCode:request.publicCode};
    }
    const history=await s.prisma.request.findUniqueOrThrow({where:{id:fixtures.requests.history.id}}),v1=await s.recommend(history,'recommendation.v1');
    if(v1.status!=='SUCCEEDED')throw new Error('M14 V1 browser fixture failed: '+v1.errorCode);
    fixtures.requests.history.aiRunId=v1.id;
    writeFileSync('artifacts/m14/browser-fixtures.json',JSON.stringify(fixtures,null,2)+'\n');
    worker=(async()=>{
      while(!controller.signal.aborted){
        try{await s.service.cycle(AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]));await delay(200,undefined,{signal:controller.signal});}
        catch(error){if(controller.signal.aborted)break;workerErrors.push(error.message);throw error;}
      }
    })();
    // Keep rejection observed until finally awaits the owned worker.
    worker.catch(()=>{});
    web=spawn(process.execPath,['apps/web/scripts/start.mjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',PORT:'3000'},stdio:['ignore','pipe','pipe'],windowsHide:true});
    web.stdout.pipe(output);web.stderr.pipe(output);let ready=false;
    for(let attempt=0;attempt<80;attempt++){
      if(web.exitCode!==null)throw new Error('M14 web failed to start; inspect artifacts/m14/web-runtime.log');
      try{ready=(await fetch('http://localhost:3000/login',{signal:AbortSignal.timeout(1000)})).ok;}catch{/* Bounded readiness polling. */}
      if(ready)break;await delay(500);
    }
    if(!ready)throw new Error('M14 web readiness failed');
    const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.m14.config.mjs'],{cwd:process.cwd(),env:{...process.env,M14_BROWSER_RUN_ID:runId},stdio:'inherit',windowsHide:true});
    const [code]=await once(child,'exit'),report=JSON.parse(readFileSync('artifacts/m14/browser-runs/'+runId+'/browser-results.json','utf8'));
    // Retain each failed trace/report across retries and keep the conventional latest report for inspection.
    writeFileSync('artifacts/m14/browser-results.json',JSON.stringify(report,null,2)+'\n');
    const checks=['reviews','responsive','states','race'].flatMap(name=>{
      const path='artifacts/m14/browser-'+name+'.json';if(!existsSync(path))return [];
      const row=JSON.parse(readFileSync(path,'utf8'));return row.runId===runId?[row]:[];
    });
    const evidence={checkedAt:new Date().toISOString(),runId,result:code===0&&workerErrors.length===0?'PASS':'FAIL',synthetic:true,database,browser:'Microsoft Edge / Playwright',productionBuild:true,stats:report.stats,checks,workerErrors,limitations:'Deterministic synthetic structured/embedding providers against real PostgreSQL and production Next build. UI-only transport failures/races are explicitly labeled. Separate live Ollama evaluation is required; no model effectiveness claim.'};
    mkdirSync('docs/v1.2/evidence',{recursive:true});writeFileSync(process.env.M14_BROWSER_EVIDENCE_PATH??'docs/v1.2/evidence/M14_BROWSER.json',JSON.stringify(evidence,null,2)+'\n');
    writeFileSync('artifacts/m14/browser-runs/'+runId+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');
    if(code!==0||workerErrors.length)throw new Error('M14 browser tests failed');
  }finally{
    controller.abort();if(worker)await worker.catch(()=>{});
    if(web&&web.exitCode===null){web.kill();await once(web,'exit');}output.end();
    await s.close();
  }
});
