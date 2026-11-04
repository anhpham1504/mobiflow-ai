import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BoundedNodeProcessError,runBoundedNode} from './bounded-node-process.mjs';

test('bounded node subprocess reports a successful final exit code',()=>{
  const events=[],result=runBoundedNode(['--input-type=module','--eval','process.exit(0)'],{timeoutMs:2000,stdio:'ignore',log:value=>events.push(JSON.parse(value))});
  assert.equal(result.exitCode,0);assert.equal(result.signal,null);assert.equal(result.errorCode,null);
  assert.deepEqual(events.map(event=>[event.event,event.result]),[['verification.subprocess.start',undefined],['verification.subprocess.finish','PASS']]);
});

test('bounded node subprocess preserves a non-zero exit as failure evidence',()=>{
  const events=[];
  assert.throws(()=>runBoundedNode(['--input-type=module','--eval','process.exit(7)'],{timeoutMs:2000,stdio:'ignore',log:value=>events.push(JSON.parse(value))}),error=>error instanceof BoundedNodeProcessError&&error.details.exitCode===7&&error.details.errorCode===null);
  assert.equal(events.at(-1).result,'FAIL');assert.equal(events.at(-1).exitCode,7);
});

test('bounded node subprocess terminates and reports a controlled timeout',()=>{
  const events=[],started=Date.now();
  assert.throws(()=>runBoundedNode(['--input-type=module','--eval','setInterval(()=>{},1000)'],{timeoutMs:150,stdio:'ignore',log:value=>events.push(JSON.parse(value))}),error=>error instanceof BoundedNodeProcessError&&error.details.errorCode==='ETIMEDOUT');
  assert.equal(events.at(-1).result,'TIMEOUT');assert.equal(events.at(-1).signal,'SIGTERM');assert.ok(Date.now()-started<5000);
});
