import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import test from 'node:test';
import {assertResetAuthorization,countsEqual,finalStatus,jsonRequest,safeDatabaseTarget,validateReleaseConfig} from './release-core.mjs';

const postgresProtocol='postgres'+'ql://';
const validEnv={DATABASE_URL:postgresProtocol+'app:secret@127.0.0.1:5432/mobiflow',MIGRATION_DATABASE_URL:postgresProtocol+'owner:secret@localhost:5432/mobiflow',JWT_SECRET:'aB3!long-secret-with-entropy-123456789',REFRESH_TOKEN_SECRET:'zY7!another-secret-with-entropy-987654',WEB_ORIGIN:'http://localhost:3000',NEXT_PUBLIC_API_BASE_URL:'http://localhost:3001/api/v1',OLLAMA_BASE_URL:'http://localhost:11434',OLLAMA_MODEL:'qwen3:4b-instruct-2507-q4_K_M',OLLAMA_EMBEDDING_MODEL:'bge-m3:latest',AUTH_COOKIE_SECURE:'false',AI_RAG_ENABLED:'true',DEMO_MODE:'true'};

test('database target guard accepts only explicit loopback demo targets',()=>{
  assert.equal(safeDatabaseTarget(validEnv.DATABASE_URL,{demoMode:'true'}).database,'mobiflow');
  for(const [url,demoMode] of [[postgresProtocol+'app:x@example.com:5432/mobiflow','true'],[postgresProtocol+'app:x@localhost:5432/production','true'],[validEnv.DATABASE_URL,'false']])assert.throws(()=>safeDatabaseTarget(url,{demoMode}),/DEMO_MODE|allowlisted/);
});

test('preflight diagnostics never contain configured secret values',()=>{
  const serialized=JSON.stringify(validateReleaseConfig(validEnv));
  assert.equal(finalStatus(validateReleaseConfig(validEnv)),'PASS');
  assert.equal(serialized.includes(validEnv.JWT_SECRET),false);assert.equal(serialized.includes(validEnv.REFRESH_TOKEN_SECRET),false);
});

test('reset authorization refuses active API, absent marker, and migration drift',()=>{
  assert.doesNotThrow(()=>assertResetAuthorization({apiActive:false,markerCount:1,completedMigrations:6,totalMigrations:6}));
  assert.throws(()=>assertResetAuthorization({apiActive:true,markerCount:1,completedMigrations:6,totalMigrations:6}),/API port/);
  assert.throws(()=>assertResetAuthorization({apiActive:false,markerCount:0,completedMigrations:6,totalMigrations:6}),/marker/);
  assert.throws(()=>assertResetAuthorization({apiActive:false,markerCount:1,completedMigrations:5,totalMigrations:6}),/six completed/);
});

test('warmup count comparison proves no business mutation',()=>{
  const before={requests:8,ai_runs:2,audits:30,assignments:5,documents:6};
  assert.equal(countsEqual(before,{...before}),true);assert.equal(countsEqual(before,{...before,audits:31}),false);
});

test('bounded JSON request covers success, dependency down, and timeout',async()=>{
  const server=createServer((request,response)=>{
    if(request.url==='/ok'){response.setHeader('content-type','application/json');response.end('{"status":"READY"}');return;}
    if(request.url==='/down'){response.statusCode=503;response.end('{"error":"down"}');return;}
    setTimeout(()=>response.end('{"late":true}'),100);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address(),base=`http://127.0.0.1:${address.port}`;
  try{
    assert.equal((await jsonRequest(`${base}/ok`,{timeout:500})).body.status,'READY');
    await assert.rejects(jsonRequest(`${base}/down`,{timeout:500}),/HTTP_503/);
    await assert.rejects(jsonRequest(`${base}/timeout`,{timeout:10}),error=>error.name==='TimeoutError');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
