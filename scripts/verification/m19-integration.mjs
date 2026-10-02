import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withM19Database } from './m19-database.mjs';
import { saveEvidence } from './evidence.mjs';
await withM19Database(async ({ databaseUrl, ownerUrl }) => {
  const child = spawnSync(process.execPath, ['--test', 'apps/api/test/mentions-watchers.integration.test.mjs'], { cwd: process.cwd(), env: { ...process.env, M19_DATABASE_URL: databaseUrl, M19_OWNER_DATABASE_URL: ownerUrl }, stdio: 'inherit', windowsHide: true });
  if (child.status !== 0) throw new Error('M19 PostgreSQL/API gate failed');
  const report = JSON.parse(readFileSync('artifacts/m19/api-report.json', 'utf8')); assert.ok(Object.values(report.checks).every(value => value === 'PASS'));
  await saveEvidence('docs/v1.3/evidence/M19_API.json', { ...report, result: 'PASS', testCommand: 'node --test apps/api/test/mentions-watchers.integration.test.mjs' });
});
