import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { saveEvidence } from './evidence.mjs';

const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', windowsHide: true }).trim();
const baseline = 'b75d15acc2dbbb16d00ce47db8ed891af210a48d', release = '31b445caf07dad606601a1e38e8ed39836d9f825';
assert.equal(git('rev-parse', 'HEAD'), baseline);
assert.equal(git('branch', '--show-current'), 'feat/v1.3-rule-based-routing');
assert.equal(git('rev-parse', 'main'), release);
assert.equal(git('rev-parse', 'v1.2.0^{commit}'), release);
assert.equal(git('ls-remote', 'origin', 'refs/heads/feat/v1.3-response-checklist-templates').split(/\s/)[0], baseline);
assert.equal(git('diff', '--cached', '--name-only'), '');
assert.equal(git('diff', '--check'), '');
const historical = git('ls-tree', '-r', '--name-only', baseline, 'docs/v1.3').split('\n').filter(path => /\/M(?:18|19|20)_|\/evidence\//.test(path));
assert.equal(git('diff', baseline, '--', ...historical, 'docs/v1.2', 'docs/reference', 'docs/verification', '.env', 'package-lock.json'), '');
const migrations = (await readdir('apps/api/prisma/migrations')).filter(name => /^\d/.test(name)); assert.equal(migrations.length, 11);
for (const path of git('ls-tree', '-r', '--name-only', baseline, 'apps/api/prisma/migrations').split('\n').filter(path => path.endsWith('/migration.sql'))) assert.equal(git('hash-object', '--path=' + path, path), git('rev-parse', baseline + ':' + path));
for (const name of ['M21_DATABASE', 'M21_API', 'M21_BROWSER', 'M21_SECURITY']) assert.equal(JSON.parse(await readFile('docs/v1.3/evidence/' + name + '.json', 'utf8')).result, 'PASS');
for (const name of ['M21_LINT', 'M21_TYPECHECK', 'M21_UNIT', 'M21_BUILD', 'M21_E2E', 'M21_SECURITY']) assert.equal(JSON.parse(await readFile('docs/v1.3/evidence/gates/' + name + '.json', 'utf8')).exitCode, 0);
const db = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL }); await db.connect(); let developerMigrations, testDatabaseRemoved;
try {
  developerMigrations = Number((await db.query('SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count);
  testDatabaseRemoved = (await db.query('SELECT 1 FROM pg_database WHERE datname=$1', ['mobiflow_m21_test'])).rowCount === 0;
} finally { await db.end(); }
assert.equal(developerMigrations, 7); assert.equal(testDatabaseRemoved, true);
const isolatedPorts = [33021, 33300, 33301];
for (const port of isolatedPorts) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
}
const previousStack = JSON.parse(await readFile('docs/v1.3/evidence/M20_FINAL.json', 'utf8')).normalStack;
const normalStack = previousStack.map(previous => {
  const [running, startedAt] = execFileSync('docker', ['inspect', '--format', '{{.State.Running}}|{{.State.StartedAt}}', previous.name], { encoding: 'utf8', windowsHide: true }).trim().split('|');
  assert.equal(running, 'true'); assert.equal(startedAt, previous.startedAt, 'Normal stack changed since M20');
  const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .HostConfig.PortBindings}}', previous.name], { encoding: 'utf8', windowsHide: true }));
  assert.ok(Object.values(ports).flat().every(binding => binding.HostIp === '127.0.0.1'));
  return { name: previous.name, running: true, startedAt, loopbackOnly: true };
});
const evidencePath = 'docs/v1.3/evidence/M21_FINAL.json', gatePath = 'docs/v1.3/evidence/gates/M21_FINAL_SANITY.json', retained = [];
for (const path of [evidencePath, gatePath]) {
  try { const previous = await readFile(path), hash = createHash('sha256').update(previous).digest('hex').slice(0, 12); retained.push(path.replace(/\/([^/]+)\.json$/, (_match, name) => '/iterations/' + name + '-' + hash + '.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const files = [...new Set([...git('diff', '--name-only', baseline).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n'), evidencePath, gatePath, ...retained])].filter(Boolean).sort();
assert.ok(files.every(path => !path.startsWith('artifacts/') && !path.startsWith('.env')));
await saveEvidence(evidencePath, { checkedAt: new Date().toISOString(), result: 'PASS', branch: 'feat/v1.3-rule-based-routing', head: baseline, remoteM20: baseline, release,
  stagedFiles: 0, committed: false, pushed: false, tagged: false, merged: false, deployment: 'NOT RUN', repositoryMigrations: 11,
  developerMigrations, developerDatabaseModified: false, testDatabaseRemoved, isolatedPortsReleased: isolatedPorts, normalStack,
  historicalEvidencePreserved: true, historicalMigrationsPreserved: true, files, inventoryNote: 'Includes final evidence/capture and retained prior metadata. Ignored local screenshots/traces/logs/fixture credentials are excluded.' });
console.log(JSON.stringify({ event: 'm21.final-sanity', result: 'PASS', stagedFiles: 0, files: files.length, developerMigrations, testDatabaseRemoved, isolatedPortsReleased: isolatedPorts }));
