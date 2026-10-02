import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { saveEvidence } from './evidence.mjs';
const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', windowsHide: true }).trim();
const baseline = '1f54dce3c8427976763b19ef33f181b4ef9a3337', release = '31b445caf07dad606601a1e38e8ed39836d9f825';
assert.equal(git('rev-parse', 'HEAD'), baseline); assert.equal(git('branch', '--show-current'), 'feat/v1.3-mentions-watchers');
assert.equal(git('rev-parse', 'main'), release); assert.equal(git('rev-parse', 'v1.2.0^{commit}'), release);
assert.equal(git('diff', '--cached', '--name-only'), ''); assert.equal(git('diff', '--check'), '');
const historical = git('ls-tree', '-r', '--name-only', baseline, 'docs/v1.3').split('\n').filter(path => /\/M18_|\/evidence\//.test(path));
assert.equal(git('diff', baseline, '--', ...historical, 'docs/v1.2', 'docs/verification', '.env', 'package-lock.json'), '');
for (const name of ['M19_DATABASE', 'M19_API', 'M19_BROWSER', 'M19_SECURITY']) assert.equal(JSON.parse(await readFile('docs/v1.3/evidence/' + name + '.json', 'utf8')).result, 'PASS');
for (const name of ['M19_LINT', 'M19_TYPECHECK', 'M19_UNIT', 'M19_BUILD', 'M19_DATABASE', 'M19_INTEGRATION', 'M19_E2E', 'M19_SECURITY', 'M19_TARGETED_UNIT']) assert.equal(JSON.parse(await readFile('docs/v1.3/evidence/gates/' + name + '.json', 'utf8')).exitCode, 0);
const db = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL }); await db.connect();
let developerMigrations, testDatabaseRemoved;
try {
  developerMigrations = Number((await db.query('SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count);
  testDatabaseRemoved = (await db.query('SELECT 1 FROM pg_database WHERE datname=$1', ['mobiflow_m19_test'])).rowCount === 0;
} finally { await db.end(); }
assert.equal(developerMigrations, 7); assert.equal(testDatabaseRemoved, true);
for (const port of [33100, 33101]) { const probe = createServer(); await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); }); await new Promise(resolve => probe.close(resolve)); }
const files = [...new Set([...git('diff', '--name-only', baseline).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean).sort();
assert.ok(files.every(path => !path.startsWith('artifacts/') && !path.startsWith('.env')));
await saveEvidence('docs/v1.3/evidence/M19_FINAL.json', { checkedAt: new Date().toISOString(), result: 'PASS', branch: 'feat/v1.3-mentions-watchers', head: baseline, release,
  stagedFiles: 0, committed: false, pushed: false, tagged: false, merged: false, deployment: 'NOT RUN', developerMigrations, developerDatabaseModified: false, testDatabaseRemoved, isolatedPortsReleased: [33100, 33101], historicalEvidencePreserved: true, files, inventoryNote: 'Snapshot before this final evidence/gate metadata and any retained subsequent evidence iteration are written.' });
console.log(JSON.stringify({ event: 'm19.final-sanity', result: 'PASS', stagedFiles: 0, files: files.length, developerMigrations, testDatabaseRemoved, isolatedPortsReleased: [33100, 33101] }));
