import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withM23Database } from './m23-database.mjs';
import { saveEvidence } from './evidence.mjs';
await withM23Database(async ({ databaseUrl, ownerUrl }) => {
  const child = spawnSync(process.execPath, ['--test', 'apps/api/test/saved-views.integration.test.mjs'], { env: { ...process.env, M23_DATABASE_URL: databaseUrl, M23_OWNER_DATABASE_URL: ownerUrl }, stdio: 'inherit', windowsHide: true });
  const report = JSON.parse(readFileSync('artifacts/m23/api-report.json'));
  await saveEvidence('docs/v1.3/evidence/M23_API.json', { ...report, result: child.status === 0 ? 'PASS' : 'FAIL', exitCode: child.status, testCommand: 'node --test apps/api/test/saved-views.integration.test.mjs' });
  assert.equal(child.status, 0); assert.equal(Object.keys(report.checks).length, 9); assert.equal(report.aiCalls, 0);
});
