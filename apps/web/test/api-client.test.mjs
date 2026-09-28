import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { fetchReadiness } from '../src/lib/api-client.ts';

test('health client handles a typed 503 and rejects untrusted response shapes', async (t) => {
  const component = { status: 'DOWN', code: 'UNAVAILABLE' };
  let invalid = false;
  const server = createServer((_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(invalid ? { private: 'unexpected' } : { requestId: '11111111-1111-4111-8111-111111111111', data: { status: 'NOT_READY', coreReady: false, aiReady: false, checkedAt: new Date().toISOString(), components: { API: { status: 'UP', code: 'OK' }, DATABASE: component, VECTOR_EXTENSION: component, OLLAMA_SERVER: component, OLLAMA_LLM_MODEL: component, OLLAMA_EMBEDDING_MODEL: component } } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetchReadiness(base)).data.status, 'NOT_READY');
  invalid = true;
  await assert.rejects(fetchReadiness(base), /không hợp lệ/);
});
