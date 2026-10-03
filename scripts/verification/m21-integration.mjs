import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withM21Database } from './m21-database.mjs';
import { saveEvidence } from './evidence.mjs';
await withM21Database(async ({ databaseUrl, ownerUrl }) => {
  const child = spawnSync(process.execPath, ['--test', 'apps/api/test/routing.integration.test.mjs'], { env: { ...process.env, M21_DATABASE_URL: databaseUrl, M21_OWNER_DATABASE_URL: ownerUrl }, stdio: 'inherit', windowsHide: true });
  const report = JSON.parse(readFileSync('artifacts/m21/api-report.json', 'utf8'));
  await saveEvidence('docs/v1.3/evidence/M21_API.json', { ...report, result: child.status === 0 ? 'PASS' : 'FAIL', exitCode: child.status, testCommand: 'node --test apps/api/test/routing.integration.test.mjs' });
  if (child.status !== 0) throw new Error('M21 PostgreSQL/API gate failed');
  assert.ok(Object.values(report.checks).every(value => value === 'PASS'));
});
