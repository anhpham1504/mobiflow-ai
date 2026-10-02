import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withM18Database } from './m18-database.mjs';
import { saveEvidence } from './evidence.mjs';
await withM18Database(async ({ databaseUrl, ownerUrl }) => {
  const result = spawnSync(process.execPath, ['--test', 'apps/api/test/internal-notes.integration.test.mjs'], { cwd: process.cwd(), env: { ...process.env, M18_DATABASE_URL: databaseUrl, M18_OWNER_DATABASE_URL: ownerUrl }, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error('M18 integration/API/security gate failed');
  const report = JSON.parse(readFileSync('artifacts/m18/api-report.json', 'utf8'));
  assert.equal(Object.keys(report.checks).length, 10); assert.ok(Object.values(report.checks).every(value => value === 'PASS'));
  await saveEvidence('docs/v1.3/evidence/M18_API.json', { ...report, result: 'PASS', testCommand: 'node --test apps/api/test/internal-notes.integration.test.mjs', tests: 11, skipped: 0 });
});
