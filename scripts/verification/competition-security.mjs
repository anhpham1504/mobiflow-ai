import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

const api=process.env.COMPETITION_API_URL??'http://127.0.0.1:34101/api/v1';
const origin=process.env.COMPETITION_WEB_ORIGIN??'http://127.0.0.1:34100';
const foreignRequestId=process.env.COMPETITION_FOREIGN_REQUEST_ID;
const sourceId=process.env.COMPETITION_SOURCE_ID;
const absentRequestId='00000000-0000-4000-8000-000000000999';
const evidencePath=resolve(process.env.COMPETITION_SECURITY_EVIDENCE??'artifacts/competition-2026/security-live.json');
if(!foreignRequestId||!sourceId)throw new Error('Synthetic foreign request and live source IDs are required.');

const csrf={'Origin':origin,'X-CSRF-Protection':'1'};
async function json(response){return response.status===204?null:response.json();}
async function login(email){
  const response=await fetch(`${api}/auth/login`,{method:'POST',headers:{...csrf,'Content-Type':'application/json'},body:JSON.stringify({email,password:'MobiFlowDemo!2026'})});
  const body=await json(response),cookie=response.headers.get('set-cookie')?.split(';')[0]??'';
  assert.equal(response.status,200);assert.ok(cookie);assert.ok(response.headers.get('set-cookie')?.includes('HttpOnly'));assert.ok(response.headers.get('set-cookie')?.includes('SameSite=Lax'));assert.ok(response.headers.get('set-cookie')?.includes('Path=/api/v1/auth'));
  assert.ok(body.data.accessToken);assert.equal('refreshToken' in body.data,false);return {accessToken:body.data.accessToken,cookie,role:body.data.user.role};
}
const get=(path,token)=>fetch(api+path,{headers:{Authorization:`Bearer ${token}`}});

const user=await login('user@mobiflow.local');assert.equal(user.role,'USER');
const me=await get('/auth/me',user.accessToken);assert.equal(me.status,200);
const absent=await get(`/requests/${absentRequestId}`,user.accessToken);assert.equal(absent.status,404);
const notes=await get(`/requests/${foreignRequestId}/internal-notes`,user.accessToken);assert.ok([403,404].includes(notes.status));
const analytics=await get('/analytics?windowDays=30',user.accessToken);assert.equal(analytics.status,403);
const source=await get(`/knowledge/sources/${encodeURIComponent(sourceId)}`,user.accessToken);assert.equal(source.status,403);
const noCsrf=await fetch(`${api}/auth/logout`,{method:'POST',headers:{Origin:origin,Cookie:user.cookie}});assert.equal(noCsrf.status,403);
const refreshed=await fetch(`${api}/auth/refresh`,{method:'POST',headers:{...csrf,Cookie:user.cookie}});assert.equal(refreshed.status,200);const refreshedBody=await json(refreshed),rotatedCookie=refreshed.headers.get('set-cookie')?.split(';')[0]??'';assert.ok(rotatedCookie&&rotatedCookie!==user.cookie);assert.ok(refreshedBody.data.accessToken);
const replay=await fetch(`${api}/auth/refresh`,{method:'POST',headers:{...csrf,Cookie:user.cookie}});assert.ok([401,409].includes(replay.status));
const logout=await fetch(`${api}/auth/logout`,{method:'POST',headers:{...csrf,Cookie:rotatedCookie}});assert.equal(logout.status,204);
const revoked=await get('/auth/me',refreshedBody.data.accessToken);assert.equal(revoked.status,401);

const staff=await login('staff.billing@mobiflow.local');assert.equal(staff.role,'STAFF');
const staffAnalytics=await get('/analytics?windowDays=30',staff.accessToken);assert.equal(staffAnalytics.status,403);
const staffForeign=await get(`/requests/${foreignRequestId}`,staff.accessToken);assert.equal(staffForeign.status,404);
const staffForeignNotes=await get(`/requests/${foreignRequestId}/internal-notes`,staff.accessToken);assert.ok([403,404].includes(staffForeignNotes.status));

const evidence={checkedAt:new Date().toISOString(),result:'PASS',checks:{cookie:{httpOnly:true,sameSiteLax:true,pathRestrictedToAuth:true,refreshTokenAbsentFromBody:true},session:{refreshRotation:refreshed.status,replayRejected:replay.status,logout:logout.status,revokedAccessRejected:revoked.status},authorization:{userAbsentRequest:absent.status,userInternalNotes:notes.status,userAnalytics:analytics.status,userKnowledgeSource:source.status,staffAnalytics:staffAnalytics.status,staffForeignRequest:staffForeign.status,staffForeignNotes:staffForeignNotes.status},csrf:{logoutWithoutHeader:noCsrf.status}},targets:{foreignRequestId,absentRequestId,sourceId}};
mkdirSync(dirname(evidencePath),{recursive:true});writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
