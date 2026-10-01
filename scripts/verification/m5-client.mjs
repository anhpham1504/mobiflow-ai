import {setTimeout as delay} from 'node:timers/promises';
/* global FormData */
export const base=process.env.VERIFY_API_URL??'http://localhost:3001';
export async function call(token,path,body,method=body===undefined?'GET':'POST'){
  const response=await fetch(base+'/api/v1'+path,{method,headers:{Origin:process.env.WEB_ORIGIN??'http://localhost:3000','X-CSRF-Protection':'1',...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();return {status:response.status,result,retryAfter:Number(response.headers.get('Retry-After')??'0')};
}
export async function login(email='manager@mobiflow.local'){const r=await call(null,'/auth/login',{email,password:'MobiFlowDemo!2026'});if(r.status!==200)throw Error('Login failed '+r.status);return r.result.data.accessToken;}
export async function command(token,path,body,expected=body===undefined?200:202){const r=await call(token,path,body);if(r.status!==expected)throw Error(path+' '+r.status+' '+JSON.stringify(r.result));return r.result.data;}
export async function waitDocument(token,id){const start=Date.now();while(Date.now()-start<610000){const d=await command(token,'/knowledge/documents/'+id);if(['READY','FAILED','DISABLED'].includes(d.status))return d;await delay(2500);}throw Error('Index deadline exceeded');}
export async function waitRun(token,id){const start=Date.now();while(Date.now()-start<310000){const r=await command(token,'/ai/runs/'+id);if(['SUCCEEDED','FAILED','CANCELED'].includes(r.status))return r;await delay(2500);}throw Error('Run deadline exceeded');}
