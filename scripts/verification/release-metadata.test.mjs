import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import metadata from '../../packages/config/src/release-metadata.json' with {type:'json'};
import {REQUIRED_EMBEDDING,REQUIRED_LLM} from '../demo/release-core.mjs';

const read=file=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');

test('release metadata owns Swagger identity and the exact rollback models',()=>{
  assert.equal(metadata.apiTitle,'MobiFlow AI API');assert.equal(metadata.releaseVersion,'1.4.2');assert.equal(metadata.baseTag,'v1.4.1');
  assert.equal(REQUIRED_LLM,metadata.rollbackProfile.generationModel);assert.equal(REQUIRED_EMBEDDING,metadata.rollbackProfile.embeddingModel);
  const app=read('apps/api/src/app.ts');assert.match(app,/setTitle\(RELEASE_METADATA\.apiTitle\)/);assert.match(app,/setVersion\(RELEASE_METADATA\.releaseVersion\)/);
});

test('Compose, environment example, runtime default, preflight and current operations docs cannot drift from rollback metadata',()=>{
  const model=metadata.rollbackProfile.generationModel,embedding=metadata.rollbackProfile.embeddingModel;
  assert.ok(read('.env.example').includes(`OLLAMA_MODEL=${model}`));assert.ok(read('.env.example').includes(`OLLAMA_EMBEDDING_MODEL=${embedding}`));
  assert.ok(read('docker-compose.yml').includes(`OLLAMA_MODEL: \${OLLAMA_MODEL:-${model}}`));assert.ok(read('docker-compose.yml').includes(`OLLAMA_EMBEDDING_MODEL: \${OLLAMA_EMBEDDING_MODEL:-${embedding}}`));
  assert.match(read('packages/config/src/index.ts'),/RELEASE_METADATA\.rollbackProfile\.generationModel/);
  assert.match(read('scripts/demo/preflight.mjs'),/REQUIRED_LLM/);
  for(const file of ['docs/release/V1_4_2_RUNBOOK.md','docs/release/V1_4_2_MACHINE_CHECKLIST.md']){const text=read(file);assert.ok(text.includes(model));assert.ok(text.includes(embedding));}
});
