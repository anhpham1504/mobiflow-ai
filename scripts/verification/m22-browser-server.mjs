import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync,mkdirSync,writeFileSync,createWriteStream,cpSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {withM22Database} from './m22-database.mjs';
import {createSlaAlertHarness} from '../../apps/api/test/helpers/sla-alert-fixture.mjs';
import {SlaAlertService} from '../../apps/api/dist/requests/sla-alert.service.js';
import {sourceInventory} from './m22-source.mjs';
const runId=process.argv[2];assert.match(runId,/^[0-9a-f-]{36}$/);const directory='artifacts/m22/browser-runs/'+runId;mkdirSync(directory,{recursive:true});
assert.ok(existsSync('apps/web/.next/BUILD_ID'),'Production build required');
await withM22Database(async({databaseUrl,database})=>{
  const s=await createSlaAlertHarness(databaseUrl,{port:33401,webOrigin:'http://localhost:33400',listenHost:'0.0.0.0'}),worker=s.app.get(SlaAlertService),output=createWriteStream(directory+'/web-runtime.log');let web;
  try{
    const f={runId,database,requests:{},tokens:{manager:s.manager.token,staff:s.staff.token,user:s.user.token},staffId:s.staff.actor.id,otherStaffId:s.otherStaff.actor.id,teamId:s.decision.teamId,literal:'<img src="/m22-xss" onerror="window.M22_XSS=true">',sourceFingerprint:sourceInventory().fingerprint};
    for(const [name,seconds] of [['reminder',50],['risk',90],['breach',101]]){
      const request=await s.assign(await s.create(name==='breach'?f.literal:name)),row=await s.prisma.slaInstance.findUniqueOrThrow({where:{requestId:request.id}}),start=new Date(s.clock.now.getTime()-seconds*1000);
      await s.prisma.slaInstance.update({where:{id:row.id},data:{startedAt:start,targetSeconds:100,dueAt:new Date(start.getTime()+100000),assessedAt:start}});await worker.observe(row.id,request.id,[s.manager.actor.id]);f.requests[name]=request;
    }
    writeFileSync(directory+'/fixtures.json',JSON.stringify(f,null,2));
    cpSync('apps/web/.next/static','apps/web/.next/standalone/apps/web/.next/static',{recursive:true});
    web=spawn(process.execPath,['apps/web/.next/standalone/apps/web/server.js'],{env:{...process.env,NODE_ENV:'production',PORT:'33400',HOSTNAME:'0.0.0.0'},stdio:['ignore','pipe','pipe'],windowsHide:true});web.stdout.pipe(output);web.stderr.pipe(output);
    let ready=false;for(let i=0;i<80;i++){if(web.exitCode!==null)throw new Error('M22 production web failed');try{ready=(await fetch('http://localhost:33400/login',{signal:AbortSignal.timeout(1000)})).ok;}catch{/* bounded readiness */}if(ready)break;await delay(500);}assert.ok(ready,'Production web readiness timeout');
    writeFileSync(directory+'/server-ready.json',JSON.stringify({runId,result:'READY'}));
    let done=false;for(let i=0;i<2400;i++){done=existsSync('/source/'+directory+'/client-done.json');if(done)break;await delay(500);}assert.ok(done,'Browser client timeout');
    const aiCalls=Object.values(s.captured).reduce((n,list)=>n+list.length,0);assert.equal(aiCalls,0);writeFileSync(directory+'/server-report.json',JSON.stringify({runId,result:'PASS',aiCalls,database,sourceFingerprint:f.sourceFingerprint},null,2));
  }finally{if(web&&web.exitCode===null){web.kill();await once(web,'exit');}output.end();await s.close();}
});
