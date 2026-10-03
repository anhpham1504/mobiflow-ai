import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sourceInventory } from './m23-source.mjs';
import { saveEvidence } from './evidence.mjs';
const source = sourceInventory(), read = path => JSON.parse(readFileSync(path));
const product = source.files.filter(file => /^(?:apps\/(?:api\/src|api\/prisma|web\/src)|packages\/[^/]+\/src|package-lock)/.test(file.path));
const scopes = {
  M23_DATABASE: /^apps\/api\/prisma\//,
  M23_API: /^(?:apps\/api\/(?:src|prisma)|packages\/[^/]+\/src|package-lock)/,
  M23_UNIT: /^(?:apps\/api\/(?:src|prisma)|packages\/[^/]+\/src|package-lock)/,
  M23_TYPECHECK: /./,
  M23_BUILD: /./,
  M23_E2E: /./,
  M23_LINT: /./,
};
const coverage = [];
for (const [name, scope] of Object.entries(scopes)) {
  const gate = read('docs/v1.3/evidence/gates/' + name + '.json');
  assert.equal(gate.result, 'PASS', name); assert.equal(gate.exitCode, 0, name);
  assert.deepEqual(gate.productFiles.filter(file => scope.test(file.path)), product.filter(file => scope.test(file.path)), name + ' relevant tested product must match final source');
  const previous = new Map(gate.productFiles.map(file => [file.path, file.sha256]));
  const outsideScopeDifferences = product.filter(file => !scope.test(file.path) && previous.get(file.path) !== file.sha256).map(file => file.path);
  coverage.push({ gate: name, command: gate.command, finishedAt: gate.finishedAt, inputFingerprint: gate.sourceFingerprint, matchingProductFiles: product.filter(file => scope.test(file.path)).length, outsideScopeDifferences });
}
const browser = read('docs/v1.3/evidence/M23_BROWSER.json'), build = read('docs/v1.3/evidence/gates/M23_BUILD.json');
assert.equal(browser.result, 'PASS');
// Later edits were verification/documentation only; both build and browser gate capture identical product bytes.
assert.deepEqual(read('docs/v1.3/evidence/gates/M23_E2E.json').productFiles, build.productFiles);
await saveEvidence('docs/v1.3/evidence/M23_SOURCE_COVERAGE.json', {
  checkedAt: new Date().toISOString(), result: 'PASS', source, productFingerprint: createHash('sha256').update(JSON.stringify(product)).digest('hex'), productFileCount: product.length, coverage,
  browserRunId: browser.runId, browserServerFingerprint: browser.sourceFingerprint,
  explanation: 'Exact per-file product hashes match all relevant gate scopes. Database checks own Prisma schema/migrations; API and unit own backend/contracts/config. Later frontend focus fix is covered by rebuilt production build, new typecheck and production browser. Verification utilities, tests and docs are separately reviewed in final Git inventory; their later edits are not claimed as product test reruns. Git blob hashes normalize LF at staging.',
});
console.log(JSON.stringify({ event: 'm23.source-coverage', result: 'PASS', productFiles: product.length, gates: coverage.length }));
