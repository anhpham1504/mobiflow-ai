import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withM24Database } from './m24-database.mjs';
import { saveEvidence } from './evidence.mjs';
await withM24Database(async ({ databaseUrl, ownerUrl }) => {
  const child = spawnSync(process.execPath, ['--test', 'apps/api/test/release-hardening.integration.test.mjs'], { env: { ...process.env, M24_DATABASE_URL: databaseUrl, M24_OWNER_DATABASE_URL: ownerUrl }, stdio: 'inherit', windowsHide: true });
  const report = JSON.parse(readFileSync('artifacts/m24/api-report.json'));
  await saveEvidence('docs/v1.3/evidence/M24_API.json', { ...report, result: child.status === 0 ? 'PASS' : 'FAIL', exitCode: child.status, testCommand: 'node --test apps/api/test/release-hardening.integration.test.mjs' });
  assert.equal(child.status, 0); assert.equal(Object.keys(report.checks).length, 5); assert.ok(Object.values(report.checks).every(value=>value==='PASS'));
});
