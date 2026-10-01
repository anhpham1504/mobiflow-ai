import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
export const apiBase='http://localhost:'+process.env.API_PORT+'/api/v1';
export const webOrigin=process.env.WEB_ORIGIN;
export async function call(token,path,body,method=body===undefined?'GET':'POST'){
  const response=await fetch(apiBase+path,{method,headers:{Origin:webOrigin,'X-CSRF-Protection':'1',...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  const text=await response.text();return {status:response.status,headers:response.headers,body:text?JSON.parse(text):null};
}
export async function login(email='manager@mobiflow.local'){
  let result=await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'});
  if(result.status===429){
    const retry=Number(result.headers.get('retry-after'));assert.ok(Number.isFinite(retry)&&retry>0&&retry<=60,'Respect a bounded authentication rate-limit window');
    console.log('WAIT authentication Retry-After '+retry+'s');await delay((retry+1)*1000);
    result=await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'});
  }
  assert.equal(result.status,200);
  return {token:result.body.data.accessToken,cookie:result.headers.get('set-cookie').split(';')[0],user:result.body.data.user};
}
export async function detail(token,id){const result=await call(token,'/requests/'+id);assert.equal(result.status,200);return result.body.data;}
export async function poll(read,done,timeout=310000){const started=Date.now();while(Date.now()-started<timeout){const result=await read();if(done(result))return result;await delay(1000);}throw new Error('M16 bounded operation timed out');}
export function report(name,data){mkdirSync('artifacts/m16/reports',{recursive:true});writeFileSync('artifacts/m16/reports/'+name+'.json',JSON.stringify({checkedAt:new Date().toISOString(),synthetic:true,...data},null,2)+'\n');}
export function checkSecretFree(value){const serialized=String(value);for(const key of ['JWT_SECRET','REFRESH_TOKEN_SECRET','POSTGRES_PASSWORD','POSTGRES_APP_PASSWORD'])if(process.env[key])assert.equal(serialized.includes(process.env[key]),false,'Configured secret value leaked: '+key);assert.equal(/Bearer\s+[A-Za-z0-9_.-]+|mobiflow_refresh=|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(serialized),false,'Credential marker leaked');}
