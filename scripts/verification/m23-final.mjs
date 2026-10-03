import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { saveEvidence } from './evidence.mjs';
import { developerContainers } from './m23-runtime.mjs';
import { sourceInventory } from './m23-source.mjs';
const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', windowsHide: true }).trim();
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true }).trim();
const read = path => JSON.parse(readFileSync(path)), preflight = read('artifacts/m23/preflight.json'), runtime = read('artifacts/m23/runtime-baseline.json');
assert.equal(git('rev-parse', 'HEAD'), preflight.previousCheckpointSha); assert.equal(git('branch', '--show-current'), 'feat/v1.3-saved-views-filters'); assert.equal(git('diff', '--cached', '--name-only'), '');
assert.equal(git('rev-parse', 'main'), preflight.main); assert.equal(git('rev-parse', 'origin/main'), preflight.originMain); assert.equal(git('show-ref', '--tags', '-d'), preflight.tags);
const live = new Map(git('ls-remote', 'origin').split('\n').map(line => { const [sha, ref] = line.split(/\s+/); return [ref, sha]; }));
assert.equal(live.get('refs/heads/main'), preflight.main);
for (const checkpoint of preflight.checkpoints) { assert.equal(git('rev-parse', checkpoint.branch), checkpoint.sha); assert.equal(live.get('refs/heads/' + checkpoint.branch), checkpoint.sha); }
for (const line of preflight.tags.split('\n')) { const [sha, ref] = line.split(' '); assert.equal(live.get(ref), sha); }
assert.equal(git('diff', '--check'), '');
for (const name of ['M23_LINT', 'M23_TYPECHECK', 'M23_UNIT', 'M23_BUILD', 'M23_DATABASE', 'M23_API', 'M23_E2E', 'M23_SECURITY']) {
  const report = read('docs/v1.3/evidence/gates/' + name + '.json'); assert.equal(report.result, 'PASS', name); assert.equal(report.exitCode, 0, name);
}
const coverage = read('docs/v1.3/evidence/M23_SOURCE_COVERAGE.json'); assert.equal(coverage.result, 'PASS'); assert.equal(coverage.source.fingerprint, sourceInventory().fingerprint);
assert.deepEqual(developerContainers(), runtime.developerContainers);
const developer = new Client({ connectionString: process.env.DATABASE_URL }); await developer.connect(); let developerMigrations;
try {
  developerMigrations = (await developer.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
  assert.deepEqual(developerMigrations, runtime.developerMigrations);
  assert.equal(Number((await developer.query("SELECT count(*) FROM pg_database WHERE datname='mobiflow_m23_test'")).rows[0].count), 0);
} finally { await developer.end(); }
for (const name of ['mobiflow-m23-verification-postgres', 'mobiflow-m23-verification-runner']) assert.equal(docker('ps', '-aq', '--filter', 'name=^/' + name + '$'), '');
for (const name of ['mobiflow-m23-verification_m23_postgres', 'mobiflow-m23-verification-work']) assert.equal(docker('volume', 'ls', '-q', '--filter', 'name=^' + name + '$'), '');
for (const port of [55423, 33023, 33500, 33501]) {
  const server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
const historicalPaths = git('ls-tree', '-r', '--name-only', preflight.previousCheckpointSha, 'docs/v1.3').split('\n').filter(path => /^docs\/v1\.3\/(?:M(?:18|19|20|21|22)_|evidence\/)/.test(path));
for (const path of historicalPaths) assert.equal(git('hash-object', '--path=' + path, path), git('rev-parse', preflight.previousCheckpointSha + ':' + path), 'Historical record unchanged: ' + path);
const paths = [...new Set([...git('diff', '--name-only', preflight.previousCheckpointSha).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean).sort();
const excludedFromRecursiveManifest = ['docs/v1.3/evidence/M23_FINAL.json', 'docs/v1.3/evidence/gates/M23_FINAL.json'];
function category(path) { return path.includes('/prisma/') ? 'database' : path.startsWith('apps/api/src') ? 'backend' : path.startsWith('apps/web/src') ? 'frontend' : /\/test\/|\/e2e\/|^playwright/.test(path) ? 'tests' : path.startsWith('docs/') || path === 'README.md' ? path.endsWith('.json') ? 'sanitized-evidence' : 'documentation' : 'verification'; }
for (const path of paths) {
  assert.ok(/^(?:apps\/(?:api|web)\/|packages\/contracts\/|scripts\/verification\/(?:m23-|docker-compose\.m23)|docs\/(?:specs\/|v1\.3\/|verification\/MILESTONE_23|IMPLEMENTATION_PLAN)|playwright\.m23|package\.json|README\.md)/.test(path), 'Allowed M23 scope: ' + path);
  assert.ok(!/(?:^|\/)(?:node_modules|\.next|storage|coverage)(?:\/|$)|^artifacts\/|(?:^|\/)\.env(?:\.|$)|\.(?:log|png|zip)$/.test(path), 'Private/runtime excluded: ' + path);
}
const reviewedFiles = paths.filter(path => !excludedFromRecursiveManifest.includes(path)).map(path => ({ path, category: category(path), disposition: 'INCLUDE', gitBlob: git('hash-object', '--path=' + path, path) }));
await saveEvidence('docs/v1.3/evidence/M23_FINAL.json', {
  checkedAt: new Date().toISOString(), result: 'PASS', previousCheckpointSha: preflight.previousCheckpointSha, branch: 'feat/v1.3-saved-views-filters', closureAuthorization: 'RECEIVED — explicit user execution prompt', technicalSelfReview: 'PASS', independentExternalHumanReview: 'NOT RUN',
  sourceFingerprint: coverage.source.fingerprint, productFingerprint: coverage.productFingerprint, reviewedFiles, inventoryFingerprint: createHash('sha256').update(JSON.stringify(reviewedFiles)).digest('hex'), excludedFromRecursiveManifest,
  developerMigrations: developerMigrations.length, developerDatabaseModified: false, developerStack: 'Original running container identities/start times/ports preserved; no normal-stack restart/build/migrate/reset/reseed',
  ownedTestContainersAndVolumes: 'REMOVED; synthetic databases dropped by owning harness', portsReleased: [55423, 33023, 33500, 33501], mainUnchanged: true, historicalTagsAndCheckpointsUnchanged: true, historicalDocumentsAndEvidenceFrozen: historicalPaths.length,
  m24: 'NOT STARTED', deployment: 'NOT RUN', gitClosure: 'Evaluate live refs after commit/push; no prospective SHA or publication assertion',
});
console.log(JSON.stringify({ event: 'm23.final', result: 'PASS', reviewedFiles: reviewedFiles.length, developerMigrations: developerMigrations.length, cleanup: 'PASS', publication: 'PENDING ordinary commit/push/live verification' }));
