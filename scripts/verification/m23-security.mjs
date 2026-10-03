import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { saveEvidence } from './evidence.mjs';
import { sourceInventory } from './m23-source.mjs';
const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', windowsHide: true }).trim();
const baseline = '58aae141ee2a4e8d9af341fd88dce370106a8c16', read = path => readFile(path, 'utf8');
assert.equal(git('rev-parse', 'HEAD'), baseline); assert.equal(git('branch', '--show-current'), 'feat/v1.3-saved-views-filters');
const preserved = ['apps/api/src/ai', 'apps/api/src/knowledge', 'apps/api/src/analytics', 'apps/api/src/dashboard', 'apps/api/src/routing', 'apps/api/src/templates', 'apps/api/src/auth', 'apps/api/src/authorization',
  'apps/api/src/requests/request-state-machine.service.ts', 'apps/api/src/requests/transition-rules.ts', 'apps/api/src/requests/internal-note.service.ts', 'apps/api/src/requests/request-collaboration.service.ts', 'apps/api/src/requests/collaboration-notifications.ts',
  'apps/api/src/requests/sla-clock.ts', 'apps/api/src/requests/sla-sql.ts', 'apps/api/src/requests/sla-alert.service.ts', 'apps/api/src/requests/sla-alert-policy.ts', 'apps/api/src/requests/sla-monitor.service.ts', 'apps/api/src/requests/workflow.guard.ts', 'scripts/demo', 'package-lock.json', 'docker-compose.yml', 'compose.yaml'];
assert.equal(git('diff', baseline, '--', ...preserved), '');
const old = git('ls-tree', '-r', '--name-only', baseline, 'apps/api/prisma/migrations').split('\n').filter(path => path.endsWith('/migration.sql'));
assert.equal(old.length, 12);
const migrationFreeze = old.map(path => ({ path, baseline: git('rev-parse', baseline + ':' + path), current: git('hash-object', '--path=' + path, path) }));
assert.ok(migrationFreeze.every(row => row.baseline === row.current));
const api = JSON.parse(await read('docs/v1.3/evidence/M23_API.json')), browser = JSON.parse(await read('docs/v1.3/evidence/M23_BROWSER.json')), db = JSON.parse(await read('docs/v1.3/evidence/M23_DATABASE.json'));
for (const report of [api, browser, db]) assert.equal(report.result, 'PASS');
assert.equal(Object.keys(api.checks).length, 9); assert.ok(Object.values(api.checks).every(value => value === 'PASS')); assert.equal(api.aiCalls, 0);
assert.equal(api.metrics.cap.blockedWaitersObserved, 2); assert.equal(api.metrics.cap.finalViews, 50); assert.equal(api.metrics.cap.independentOwnerProgress, true);
assert.equal(browser.stats.expected, 4); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0); assert.equal(browser.aiCalls, 0);
const scans = browser.checks.flatMap(check => check.scans ?? []); assert.equal(scans.length, 24); assert.ok(scans.every(scan => scan.serious === 0 && scan.critical === 0 && !scan.overflow));
assert.equal(db.migrationCount, 13); assert.equal(db.checks.length, 3); assert.ok(db.checks.every(check => check.result === 'PASS' && check.runtimeDdlDenied));
const diagnostics = browser.checks.find(check => check.scans); assert.equal(diagnostics.applicationPageErrors, 0); assert.equal(diagnostics.applicationConsoleErrors, 0); assert.equal(diagnostics.failedNetwork, 0);
const [service, controller, filters, query, ui, migration] = await Promise.all(['apps/api/src/saved-views/saved-view.service.ts', 'apps/api/src/saved-views/saved-view.controller.ts', 'packages/contracts/src/request-filters.ts',
  'apps/api/src/requests/request-query.service.ts', 'apps/web/src/components/saved-views.tsx', 'apps/api/prisma/migrations/20261004010000_m23_saved_request_views/migration.sql'].map(read));
const sourceReview = {
  ownerPredicates: service.includes('ownerUserId: actor.id') && service.includes('lockCollaborationIdentity(tx, actor)'),
  ownerSerialization: service.includes('FOR UPDATE') && service.includes('tx.savedRequestView.count') && service.includes('MAX_SAVED_REQUEST_VIEWS'),
  atomicVersionedPreferences: service.includes('version: input.expectedVersion') && service.includes('version: expectedVersion') && service.includes('version: { increment: 1 }') && service.includes('this.prisma.$transaction'),
  schemaAndCurrentRoleReads: service.includes('row.schemaVersion !== SAVED_REQUEST_VIEW_SCHEMA_VERSION') && service.includes('requestFilterSchema.safeParse') && service.includes('requestFiltersAllowed(result.data, actor.role)'),
  unavailableWithoutFilters: service.includes("availability: 'UNAVAILABLE', reasonCode") && service.includes('availableAssignees(tx'),
  strictCanonicalQuery: filters.includes('}).strict().refine') && query.includes('parse(requestListQuerySchema,input)') && query.includes('assertRequestFilters(this.prisma,validated,actor.role)'),
  scopeBeforeFilters: query.includes('AND:[this.policy.requestScope(actor),filters,scope,where]'),
  transportGuards: controller.includes('UseGuards(AccessGuard, RolesGuard, WorkflowGuard)') && controller.includes('parse(contracts.savedViewQuerySchema, query)'),
  minimalHumanAudit: service.includes('actorType: actor.role') && service.includes('safeAfterJson: { viewId: id, version }') && !service.includes('requestId:'),
  noBusinessWritesOrAi: !/(?:tx|this\.prisma)\.(?:request|assignment|slaInstance|notification|requestWatcher|requestInternalNote|checklist)\.(?:create|update|delete|upsert)/.test(service) && !/RawUnsafe|eval\(|new Function|child_process|AiProvider|fetch\(/.test(service),
  escapedNativeModal: !/dangerouslySetInnerHTML|innerHTML|DOMParser/.test(ui) && ui.includes('<dialog') && ui.includes('expectedVersion: editing.version'),
  leastPrivilege: migration.includes('GRANT SELECT, INSERT, DELETE') && migration.includes('GRANT UPDATE ("name", "normalizedName", "schemaVersion", "filters", "version", "updatedAt")') && migration.includes('ON DELETE RESTRICT'),
};
for (const [name, passed] of Object.entries(sourceReview)) assert.equal(passed, true, name);
const paths = [...new Set([...git('diff', '--name-only', baseline).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
const privateRuntime = JSON.parse(await read('artifacts/m23/runtime-private.json'));
const names = ['DATABASE_URL', 'MIGRATION_DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'POSTGRES_PASSWORD', 'POSTGRES_APP_PASSWORD', 'M23_OWNER_PASSWORD', 'M23_APP_PASSWORD'];
const values = names.flatMap(key => [process.env[key], privateRuntime[key]].filter(Boolean));
for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) for (const env of [process.env, privateRuntime]) try { values.push(decodeURIComponent(new URL(env[key]).password)); } catch { /* no credential output */ }
for (const line of (await read('artifacts/m23/linux.env')).split('\n')) if (/^(?:JWT_SECRET|REFRESH_TOKEN_SECRET)=/.test(line)) values.push(line.slice(line.indexOf('=') + 1));
const secrets = [...new Set(values)].filter(value => value.length >= 12), findings = [];
async function scan(path, patterns = true) {
  const text = await read(path);
  if (secrets.some(secret => text.includes(secret))) findings.push({ path, kind: 'configured-secret' });
  if (patterns) for (const [kind, expression] of [['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/], ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/], ['provider-token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/], ['jwt', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/]]) if (expression.test(text)) findings.push({ path, kind });
}
for (const path of paths) if (/\.(?:[cm]?js|tsx?|json|md|txt|sql|ya?ml)$/.test(path)) await scan(path);
const bundleRoot = 'artifacts/m23/production-static'; await mkdir(bundleRoot, { recursive: true });
execFileSync('docker', ['cp', 'mobiflow-m23-verification-runner:/work/apps/web/.next/static/.', resolve(bundleRoot)], { windowsHide: true });
let bundleFilesScanned = 0;
async function bundles(folder) { for (const entry of await readdir(folder, { withFileTypes: true })) { const path = join(folder, entry.name); if (entry.isDirectory()) await bundles(path); else if (/\.js$/.test(entry.name)) { await scan(path, false); bundleFilesScanned++; } } }
await bundles(bundleRoot); assert.ok(bundleFilesScanned > 0); assert.deepEqual(findings, [], 'Credential findings require review; values are never printed');
const runtime = JSON.parse(await read('artifacts/m23/runtime-baseline.json')), developer = new Client({ connectionString: process.env.DATABASE_URL }); await developer.connect(); let developerMigrations;
try { developerMigrations = (await developer.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows; } finally { await developer.end(); }
assert.deepEqual(developerMigrations, runtime.developerMigrations);
await saveEvidence('docs/v1.3/evidence/M23_SECURITY.json', { checkedAt: new Date().toISOString(), result: 'PASS', scope: 'Technical self-review backed by real HTTP/PG and production browser; independent human review NOT RUN', source: sourceInventory(), sourceReview, preservedOwners: preserved, migrationFreeze, filesScanned: paths.length, bundleFilesScanned, findings, developerMigrations: developerMigrations.length, developerDatabaseModified: false, apiCheckedAt: api.checkedAt, browserRunId: browser.runId, ollama: 'NOT RUN', limitations: 'No penetration-test, full WCAG certification, enterprise SLO or production deployment claim.' });
console.log(JSON.stringify({ event: 'm23.security', result: 'PASS', filesScanned: paths.length, bundleFilesScanned, findings: 0 }));
