import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {Client} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
const project='mobiflow-m24-verification',container=project+'-postgres',manifest='artifacts/m24/runtime-private.json';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true}).trim();
export function m24Environment(){
  const data=JSON.parse(readFileSync(manifest,'utf8'));
  assert.equal(data.project,project);assert.equal(new URL(data.DATABASE_URL).host,'127.0.0.1:55424');
  assert.equal(new URL(data.MIGRATION_DATABASE_URL).host,'127.0.0.1:55424');
  if(process.env.M24_LINUX_RUNTIME==='true')for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL']){const url=new URL(data[key]);url.port='5432';data[key]=url.toString();}
  return {...process.env,...data,DEMO_MODE:'true'};
}
export function developerContainers(){return JSON.parse(docker('inspect','mobiflow-ai-postgres-1','mobiflow-ai-api-1','mobiflow-ai-web-1')).map(c=>({id:c.Id,name:c.Name,startedAt:c.State.StartedAt,running:c.State.Running,image:c.Image,ports:c.NetworkSettings.Ports}));}
async function main(){
  const action=process.argv[2];assert.ok(['start','stop'].includes(action));
  if(action==='start'){
    assert.ok(!existsSync(manifest),'Private runtime manifest exists; inspect before reuse');
    assert.equal(docker('ps','-aq','--filter','name=^/'+container+'$'),'','Owned container name already exists');
    const owner=randomBytes(32).toString('hex'),app=randomBytes(32).toString('hex');
    const env={...process.env,M24_OWNER_PASSWORD:owner,M24_APP_PASSWORD:app};
    const before=developerContainers();mkdirSync('artifacts/m24',{recursive:true});
    execFileSync('docker',['compose','-p',project,'-f','scripts/verification/docker-compose.m24.yml','up','-d'],{env,stdio:'inherit',windowsHide:true});
    const data={project,M24_OWNER_PASSWORD:owner,M24_APP_PASSWORD:app,DATABASE_URL:`postgresql://mobiflow_app:${app}@127.0.0.1:55424/mobiflow`,MIGRATION_DATABASE_URL:`postgresql://mobiflow_owner:${owner}@127.0.0.1:55424/mobiflow`,containerId:docker('inspect','--format','{{.Id}}',container)};
    writeFileSync(manifest,JSON.stringify(data));
    let ready=false;for(let i=0;i<60;i++){
      const c=new Client({connectionString:data.DATABASE_URL,connectionTimeoutMillis:1000});
      try{await c.connect();await c.query('SELECT 1');ready=true;}catch{/* bounded isolated initialization */}finally{await c.end();}
      if(ready)break;await delay(500);
    }assert.ok(ready,'Isolated PG initialization timed out');assert.deepEqual(developerContainers(),before);
    const developer=new Client({connectionString:process.env.DATABASE_URL});await developer.connect();let migrations;
    try{migrations=(await developer.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;assert.equal(migrations.length,7);}finally{await developer.end();}
    writeFileSync('artifacts/m24/runtime-baseline.json',JSON.stringify({checkedAt:new Date().toISOString(),developerContainers:before,developerMigrations:migrations,isolatedContainerId:data.containerId,project,initialRuntime:'Docker engine was initially unavailable; starting Docker Desktop auto-resumed developer PostgreSQL only. Captured IDs/start times/ports after engine startup; API/Web remained stopped; no normal-stack compose/rebuild/migrate/reset/reseed'},null,2));
    console.log(JSON.stringify({event:'m24.runtime',result:'PASS',project,port:55424,developerMigrations:7}));
  }else{
    const env=m24Environment();assert.equal(docker('inspect','--format','{{.Id}}',container),env.containerId);
    assert.equal(docker('inspect','--format','{{ index .Config.Labels "com.docker.compose.project" }}',container),project);
    execFileSync('docker',['compose','-p',project,'-f','scripts/verification/docker-compose.m24.yml','down','--volumes'],{env,stdio:'inherit',windowsHide:true});
    assert.equal(docker('ps','-aq','--filter','name=^/'+container+'$'),'');assert.equal(docker('volume','ls','-q','--filter','label=com.docker.compose.project='+project),'');
    console.log(JSON.stringify({event:'m24.runtime-cleanup',result:'PASS',project}));
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
