import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { saveEvidence } from './evidence.mjs';

const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', windowsHide: true }).trim();
const baseline = '35e4b1c41165fa04348871dee31bd20c28386b47', release = '31b445caf07dad606601a1e38e8ed39836d9f825';
assert.equal(git('rev-parse', 'HEAD'), baseline);
assert.equal(git('branch', '--show-current'), 'feat/v1.3-response-checklist-templates');
assert.equal(git('rev-parse', 'main'), release);
assert.equal(git('rev-parse', 'v1.2.0^{commit}'), release);
assert.equal(git('diff', '--cached', '--name-only'), '');
assert.equal(git('diff', '--check'), '');
const historical = git('ls-tree', '-r', '--name-only', baseline, 'docs/v1.3').split('\n').filter(path => /\/M1[89]_|\/evidence\//.test(path));
assert.equal(git('diff', baseline, '--', ...historical, 'docs/v1.2', 'docs/reference', 'docs/verification', '.env', 'package-lock.json'), '');
const migrations = (await readdir('apps/api/prisma/migrations')).filter(name => /^\d/.test(name));
assert.equal(migrations.length, 10);
for (const path of git('ls-tree', '-r', '--name-only', baseline, 'apps/api/prisma/migrations').split('\n').filter(path => path.endsWith('/migration.sql'))) {
  assert.equal(git('hash-object', '--path=' + path, path), git('rev-parse', baseline + ':' + path));
}
for (const name of ['M20_DATABASE', 'M20_API', 'M20_BROWSER', 'M20_SECURITY']) {
  assert.equal(JSON.parse(await readFile('docs/v1.3/evidence/' + name + '.json', 'utf8')).result, 'PASS');
}
for (const name of ['M20_LINT', 'M20_TYPECHECK', 'M20_UNIT', 'M20_BUILD', 'M20_DATABASE', 'M20_INTEGRATION', 'M20_E2E', 'M20_SECURITY', 'M20_TARGETED_UNIT']) {
  assert.equal(JSON.parse(await readFile('docs/v1.3/evidence/gates/' + name + '.json', 'utf8')).exitCode, 0);
}
const db = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await db.connect();
let developerMigrations, testDatabaseRemoved;
try {
  developerMigrations = Number((await db.query('SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count);
  testDatabaseRemoved = (await db.query('SELECT 1 FROM pg_database WHERE datname=$1', ['mobiflow_m20_test'])).rowCount === 0;
} finally { await db.end(); }
assert.equal(developerMigrations, 7);
assert.equal(testDatabaseRemoved, true);
const isolatedPorts = [33020, 33200, 33201];
for (const port of isolatedPorts) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
}
const starts = [];
for (const folder of ['docs/v1.3/evidence/gates', 'docs/v1.3/evidence/gates/iterations']) {
  for (const file of (await readdir(folder)).filter(file => /^M20_.*\.json$/.test(file))) {
    starts.push(new Date(JSON.parse(await readFile(folder + '/' + file, 'utf8')).startedAt).getTime());
  }
}
assert.ok(starts.length && starts.every(Number.isFinite));
const firstVerifiedAt = new Date(Math.min(...starts));
const normalStack = ['mobiflow-ai-web-1', 'mobiflow-ai-api-1', 'mobiflow-ai-postgres-1'].map(name => {
  const [running, startedAt] = execFileSync('docker', ['inspect', '--format', '{{.State.Running}}|{{.State.StartedAt}}', name], { encoding: 'utf8', windowsHide: true }).trim().split('|');
  assert.equal(running, 'true');
  assert.ok(new Date(startedAt) < firstVerifiedAt, 'Normal stack restarted during M20 verification');
  return { name, running: true, startedAt };
});
const evidencePath = 'docs/v1.3/evidence/M20_FINAL.json', gatePath = 'docs/v1.3/evidence/gates/M20_FINAL_SANITY.json';
const retained = [];
for (const path of [evidencePath, gatePath]) {
  try {
    const previous = await readFile(path), hash = createHash('sha256').update(previous).digest('hex').slice(0, 12);
    retained.push(path.replace(/\/([^/]+)\.json$/, (_match, name) => '/iterations/' + name + '-' + hash + '.json'));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const files = [...new Set([...git('diff', '--name-only', baseline).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n'), evidencePath, gatePath, ...retained])].filter(Boolean).sort();
assert.ok(files.every(path => !path.startsWith('artifacts/') && !path.startsWith('.env')));
await saveEvidence(evidencePath, { checkedAt: new Date().toISOString(), result: 'PASS', branch: 'feat/v1.3-response-checklist-templates', head: baseline, release,
  stagedFiles: 0, committed: false, pushed: false, tagged: false, merged: false, deployment: 'NOT RUN', repositoryMigrations: 10,
  developerMigrations, developerDatabaseModified: false, testDatabaseRemoved, isolatedPortsReleased: isolatedPorts, normalStack, firstVerifiedAt,
  historicalEvidencePreserved: true, historicalMigrationsPreserved: true, files, inventoryNote: 'Includes final evidence/capture and their deterministically retained prior metadata; ignored local outputs are excluded.' });
console.log(JSON.stringify({ event: 'm20.final-sanity', result: 'PASS', stagedFiles: 0, files: files.length, developerMigrations, testDatabaseRemoved, isolatedPortsReleased: isolatedPorts }));
