import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
export const apiBase='http://localhost:33601',webOrigin='http://localhost:33600';
export async function call(token,path,body,method=body===undefined?'GET':'POST',expected){
 const r=await fetch(apiBase+'/api/v1'+path,{method,signal:AbortSignal.timeout(15000),headers:{Origin:webOrigin,'X-CSRF-Protection':'1','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await r.json();if(expected!==undefined)assert.equal(r.status,expected,JSON.stringify(data));return {status:r.status,body:data,headers:r.headers};
}
export async function login(name){return (await call(null,'/auth/login',{email:name+'@mobiflow.local',password:'MobiFlowDemo!2026'},'POST',200)).body.data.accessToken;}
export async function releaseDb(){const {env}=JSON.parse(readFileSync('artifacts/m24/release-private.json'));const c=new Client({connectionString:`postgresql://mobiflow_owner:${env.POSTGRES_PASSWORD}@127.0.0.1:55425/mobiflow`});await c.connect();return c;}
export async function waitUntil(work,{attempts=60,interval=1000}={}){for(let i=0;i<attempts;i++){if(await work())return;await new Promise(r=>setTimeout(r,interval));}throw new Error('Bounded M24 readiness/condition timeout');}
