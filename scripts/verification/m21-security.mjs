import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { saveEvidence } from './evidence.mjs';

const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', windowsHide: true }).trim();
const baseline = 'b75d15acc2dbbb16d00ce47db8ed891af210a48d', release = '31b445caf07dad606601a1e38e8ed39836d9f825';
assert.equal(git('rev-parse', 'HEAD'), baseline);
assert.equal(git('branch', '--show-current'), 'feat/v1.3-rule-based-routing');
assert.equal(git('rev-parse', 'v1.2.0^{commit}'), release);
const migrationPaths = git('ls-tree', '-r', '--name-only', baseline, 'apps/api/prisma/migrations').split('\n').filter(path => path.endsWith('/migration.sql'));
assert.equal(migrationPaths.length, 10);
const migrationFreeze = migrationPaths.map(path => ({ path, baseline: git('rev-parse', baseline + ':' + path), current: git('hash-object', '--path=' + path, path) }));
assert.ok(migrationFreeze.every(row => row.baseline === row.current));
const preserved = ['apps/api/src/requests', 'apps/api/src/templates', 'apps/api/src/ai', 'apps/api/src/knowledge', 'apps/api/src/analytics', 'apps/api/src/dashboard', 'packages/contracts/src/workflow.ts', 'packages/contracts/src/internal-notes.ts', 'packages/contracts/src/templates.ts', 'apps/web/src/components/template-management.tsx', 'apps/web/src/components/template-selector.tsx', 'apps/web/src/components/checklist-draft-editor.tsx', 'scripts/demo', 'packages/config', 'package-lock.json', 'docker-compose.yml', 'compose.yaml'];
assert.equal(git('diff', baseline, '--', ...preserved), '');
const read = path => readFile(path, 'utf8');
const api = JSON.parse(await read('docs/v1.3/evidence/M21_API.json')), browser = JSON.parse(await read('docs/v1.3/evidence/M21_BROWSER.json')), database = JSON.parse(await read('docs/v1.3/evidence/M21_DATABASE.json'));
for (const evidence of [api, browser, database]) assert.equal(evidence.result, 'PASS');
assert.equal(Object.keys(api.checks).length, 11); assert.ok(Object.values(api.checks).every(value => value === 'PASS')); assert.equal(api.aiCalls, 0);
assert.equal(browser.stats.expected, 4); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0); assert.equal(browser.aiCalls, 0);
const scans = browser.checks.flatMap(check => check.scans ?? []); assert.equal(scans.length, 12);
assert.ok(scans.every(scan => !scan.overflow && scan.serious === 0 && scan.critical === 0));
assert.equal(database.developerMigrations, 7); assert.equal(database.migrationCount, 11);
assert.ok(database.checks.every(check => check.result === 'PASS' && check.historicalMigrations === 'byte-identical' && check.runtimeDdlDenied));
const [ui, management, controller, service, facts, evaluator, policy, contracts, migration] = await Promise.all([
  'apps/web/src/components/routing-assignment.tsx', 'apps/web/src/components/routing-management.tsx', 'apps/api/src/routing/routing.controller.ts', 'apps/api/src/routing/routing.service.ts', 'apps/api/src/routing/routing-facts.ts', 'apps/api/src/routing/routing-evaluator.ts', 'apps/api/src/authorization/authorization-policy.service.ts', 'packages/contracts/src/routing.ts', 'apps/api/prisma/migrations/20261002040000_m21_rule_based_routing/migration.sql',
].map(read));
// These checks retain the focused source-review conclusions. Real HTTP, DB and browser
// behavior is independently asserted by the required evidence above.
const sourceReview = {
  backendManagerOnlyAndLiveIdentity: controller.includes('@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)') && controller.includes("@Roles('MANAGER')") && policy.includes("if (actor.role !== 'MANAGER')") && service.includes('lockCollaborationIdentity(tx, actor)'),
  scopedRequestBeforeFacts: service.includes('AND: [{ id }, this.policy.requestScope(actor)]') && service.indexOf('this.policy.assertCanReadRequest(actor, request)') < service.indexOf('this.facts.build(request)'),
  noFactOverridesAndStrictAllowlist: controller.includes('parse(contracts.routingEmptySchema, query)') && service.includes('parse(routingEmptySchema, input === undefined ? {} : input)') && contracts.includes("['category', 'subcategory', 'priority']") && contracts.includes("['EQ', 'IN']") && contracts.includes('.min(1).max(10)') && contracts.includes('}).strict()'),
  narrowFactsNoPrivateContext: facts.includes('category: request.category, subcategory: request.subcategory, priority: request.priority') && !/internalNote|mention|watcher|template|AiAnalysis|manualDraft/.test(facts),
  pureStableEvaluator: !/Prisma|Date|Math\.random|fetch\(|process\.|node:|\.create\(|\.update\(|\.delete\(/.test(evaluator) && evaluator.includes('ruleId < b.ruleId') && evaluator.includes('CONFLICTING_TARGETS') && evaluator.includes('INVALID_TARGET'),
  liveSharedTargetEligibilityAndBoundSql: service.includes('eligibleStaffPredicate()') && service.includes('FOR SHARE OF t,m,u') && service.includes('Prisma.sql') && service.includes('Prisma.join(') && !/RawUnsafe|eval\(|new Function|child_process/.test(service + evaluator),
  versionedAtomicRuleWrites: service.includes('FOR UPDATE') && service.includes('rule.currentRevision !== expected.expectedRevision') && service.includes('rule.version !== expected.expectedRuleVersion') && service.includes('this.prisma.$transaction'),
  immutableRevisionAndTerminalArchive: migration.includes('BEFORE UPDATE OR DELETE') && migration.includes("OLD.\"status\" = 'ARCHIVED'") && migration.includes('revision_count <> current_revision') && migration.includes('DEFERRABLE INITIALLY DEFERRED'),
  leastPrivilegeNoDeleteApi: migration.includes('REVOKE ALL ON') && migration.includes('GRANT UPDATE (') && !/@Delete|@Patch/.test(controller),
  boundedBatchedReadSnapshot: service.includes('take: limit + 1') && service.includes('take: 501') && service.includes('LIMIT 501') && service.includes('RepeatableRead') && !/for\s*\([^)]*rules/.test(service),
  safeResourceAudit: service.includes("resourceType: 'RoutingRule'") && service.includes('safeAfterJson: { ruleId: id, revision, version, priority }') && !/requestId:|console\.|\blog\(/.test(service),
  noBusinessWrites: !/tx\.(?:request|requestHistory|notification|checklist|assignment|slaInstance|requestMessage)\.(?:create|update|delete|upsert)/.test(service),
  noStoreEscapedUi: (controller.match(/@Header\('Cache-Control', 'no-store'\)/g) ?? []).length === 10 && !/dangerouslySetInnerHTML|innerHTML|DOMParser/.test(ui + management),
  prefillRechecksNoAutoStaff: ui.includes('JSON.stringify(next) !== JSON.stringify(result)') && ui.includes('next.requestVersion !== currentVersion.current') && ui.includes("setTeamId(next.suggestedTarget.id); setAssignment('')") && ui.includes("'/routing/evaluate'") && !/api\([^\n]*(?:reassign|accept|triage|submit-approval)/.test(ui),
  boundedFailureRetainsManual: ui.includes('AbortSignal.timeout(15000)') && management.includes('AbortSignal.timeout(15000)') && ui.includes('Bạn vẫn có thể phân công thủ công'),
};
for (const [name, passed] of Object.entries(sourceReview)) assert.equal(passed, true, name);
const paths = [...new Set([...git('diff', '--name-only', baseline).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
const configured = ['DATABASE_URL', 'MIGRATION_DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'POSTGRES_PASSWORD', 'POSTGRES_APP_PASSWORD'].flatMap(key => process.env[key] ? [process.env[key]] : []);
for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) { try { configured.push(decodeURIComponent(new URL(process.env[key]).password)); } catch { /* never print credential values */ } }
const secrets = [...new Set(configured)].filter(value => value.length >= 12), findings = [];
async function scan(path, patterns = true) {
  const content = await read(path);
  if (secrets.some(secret => content.includes(secret))) findings.push({ path, kind: 'configured-secret' });
  if (patterns) for (const [kind, regex] of [['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/], ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/], ['openai-token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/], ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/]]) if (regex.test(content)) findings.push({ path, kind });
}
for (const path of paths) if (/\.(?:[cm]?js|tsx?|json|md|txt|sql|ya?ml)$/.test(path)) await scan(path);
let bundleFilesScanned = 0;
async function bundles(folder) { for (const entry of await readdir(folder, { withFileTypes: true })) { const path = join(folder, entry.name); if (entry.isDirectory()) await bundles(path); else if (/\.js$/.test(entry.name)) { await scan(path, false); bundleFilesScanned++; } } }
await bundles('apps/web/.next/static'); assert.deepEqual(findings, [], 'Credential scan requires review; values are never emitted');
const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); let developerMigrations;
try { developerMigrations = Number((await db.query('SELECT count(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count); } finally { await db.end(); }
assert.equal(developerMigrations, 7);
await saveEvidence('docs/v1.3/evidence/M21_SECURITY.json', { checkedAt: new Date().toISOString(), result: 'PASS', baseline, scope: 'Focused source/credential review backed by real PostgreSQL/HTTP/race/rollback and production-browser evidence', sourceReview, migrationFreeze, preservedOwners: preserved, apiCheckedAt: api.checkedAt, browserRunId: browser.runId, filesScanned: paths.length, bundleFilesScanned, findings, developerMigrations, developerDatabaseModified: false, ollama: 'NOT RUN — no probe/start/generation required', limitations: 'Targeted review, not penetration testing, WCAG certification, live AI evaluation or enterprise load SLO.' });
console.log(JSON.stringify({ event: 'm21.security', result: 'PASS', filesScanned: paths.length, bundleFilesScanned, findings, developerMigrations }));
