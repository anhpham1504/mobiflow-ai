import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { saveEvidence } from './evidence.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const baseline = '31b445caf07dad606601a1e38e8ed39836d9f825';
assert.equal(git('rev-parse', 'HEAD'), baseline);
assert.equal(git('rev-parse', 'v1.2.0^{commit}'), baseline);
assert.equal(git('branch', '--show-current'), 'feat/v1.3-internal-notes');
const migrationPaths = git('ls-tree', '-r', '--name-only', baseline, 'apps/api/prisma/migrations').split('\n').filter(path => path.endsWith('/migration.sql'));
assert.equal(migrationPaths.length, 7);
const migrationFreeze = migrationPaths.map(path => ({ path, baseline: git('rev-parse', baseline + ':' + path), current: git('hash-object', '--path=' + path, path) }));
assert.ok(migrationFreeze.every(item => item.baseline === item.current));
const preserved = ['apps/api/src/ai', 'apps/api/src/knowledge', 'apps/api/src/analytics', 'apps/api/src/dashboard', 'apps/api/src/requests/request-query.service.ts', 'apps/api/src/requests/request-state-machine.service.ts', 'apps/api/src/requests/sla-clock.ts', 'scripts/demo', 'package-lock.json', 'packages/config'];
assert.equal(git('diff', baseline, '--', ...preserved), '', 'Existing AI, projections, workflow, SLA, demo and dependency owners remain unchanged');
const api = JSON.parse(await readFile('docs/v1.3/evidence/M18_API.json', 'utf8'));
const browser = JSON.parse(await readFile('docs/v1.3/evidence/M18_BROWSER.json', 'utf8'));
const database = JSON.parse(await readFile('docs/v1.3/evidence/M18_DATABASE.json', 'utf8'));
for (const evidence of [api, browser, database]) assert.equal(evidence.result, 'PASS');
assert.equal(api.tests, 11); assert.equal(api.skipped, 0);
for (const check of ['directHttpSecurity', 'creationAuditWorkflow', 'userHistoryNotificationsAnalyticsLogs', 'constraintsImmutabilityAuditRollback', 'terminalReassignmentVersion', 'raceAndLiveIdentity', 'intakeRagRecommendationCopilotIsolation', 'openApiContracts']) assert.equal(api.checks[check], 'PASS');
assert.equal(browser.stats.expected, 4); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0);
const collaboration = browser.checks.find(check => 'userNoteApiRequests' in check), rendering = browser.checks.find(check => 'xssImageRequests' in check);
assert.equal(collaboration.userNoteApiRequests, 0); assert.equal(collaboration.userPayloadCanaryAbsent, true);
assert.equal(rendering.literalHtmlScript, true); assert.equal(rendering.xssImageRequests, 0); assert.equal(rendering.xssDialogs, 0); assert.deepEqual(rendering.consolePageErrors, []);
assert.deepEqual(database.checks[0].runtimePrivileges, { read: true, append: true, edit: false, remove: false, truncate: false });
const read = path => readFile(path, 'utf8');
const [controller, service, contracts, ui, middleware, client] = await Promise.all([
  read('apps/api/src/requests/internal-note.controller.ts'), read('apps/api/src/requests/internal-note.service.ts'), read('packages/contracts/src/internal-notes.ts'), read('apps/web/src/components/internal-notes.tsx'), read('apps/api/src/http.ts'), read('apps/web/src/lib/session.ts'),
]);
const sourceReview = {
  operationalRoleAndExistingGuards: controller.includes("@Roles('STAFF', 'MANAGER')") && controller.includes('@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)'),
  onlyReadAndAppendRoutes: controller.includes('@Get()') && controller.includes('@Post()') && !/@(?:Patch|Delete|Put)\(/.test(controller),
  strictContracts: contracts.includes("body: text(1, INTERNAL_NOTE_MAX_LENGTH) }).strict()") && contracts.includes('}).strict();'),
  boundParentScopeAndLiveIdentity: service.includes('this.policy.requestScopeSql(actor)') && service.includes('this.policy.internalNoteScope(actor)') && service.includes('user.role !== actor.role') && service.includes('revokedAt: null') && service.includes('FOR SHARE') && service.includes('FOR UPDATE'),
  atomicChildAndAuditOnly: service.includes('tx.requestInternalNote.create') && service.includes('tx.auditLog.create') && !/tx\.(?:request|assignment|slaInstance|notification|requestMessage)\.(?:create|update|delete)/.test(service),
  bodyFreeResourceAudit: service.includes("resourceType: 'RequestInternalNote'") && service.includes('safeAfterJson: { noteId: note.id, requestId: id, authorId: actor.id }'),
  noShellUnsafeSqlOrBodyLogging: !/child_process|\$(?:query|execute)RawUnsafe|console\.|\blog\(/.test(service),
  escapedPlainText: ui.includes('{note.body}</p>') && !/dangerouslySetInnerHTML|innerHTML|marked|remark|DOMParser/.test(ui),
  privateNoStore: middleware.includes("res.setHeader('Cache-Control', 'no-store')") && client.includes("cache:'no-store'"),
};
assert.ok(Object.values(sourceReview).every(Boolean), 'Focused source review invariant failed');
const paths = [...new Set([...git('diff', '--name-only', baseline).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
const configured = ['DATABASE_URL', 'MIGRATION_DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'POSTGRES_PASSWORD', 'POSTGRES_APP_PASSWORD'].flatMap(key => process.env[key] ? [process.env[key]] : []);
for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) { try { configured.push(decodeURIComponent(new URL(process.env[key]).password)); } catch { /* Missing/invalid URL is not echoed. */ } }
const secrets = [...new Set(configured)].filter(value => value.length >= 12);
const findings = [];
for (const path of paths) {
  if (!/\.(?:[cm]?js|tsx?|json|md|txt|sql|ya?ml)$/.test(path)) continue;
  const content = await read(path);
  if (secrets.some(secret => content.includes(secret))) findings.push({ path, kind: 'configured-secret' });
  for (const [kind, pattern] of [['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/], ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/], ['openai-token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/], ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/]]) if (pattern.test(content)) findings.push({ path, kind });
}
assert.deepEqual(findings, [], 'Changed-file credential scan requires review; values are never reported');
await saveEvidence('docs/v1.3/evidence/M18_SECURITY.json', {
  checkedAt: new Date().toISOString(), result: 'PASS', scope: 'Focused source/credential review plus actual M18 PostgreSQL, HTTP and XSS browser evidence', baseline,
  apiCheckedAt: api.checkedAt, browserRunId: browser.runId, databaseCheckedAt: database.checkedAt,
  migrationFreeze, preservedOwners: preserved, sourceReview, filesScanned: paths.length, findings,
  limitations: 'Targeted review and negative tests only; not penetration testing, live AI evaluation or production certification.',
});
console.log(JSON.stringify({ event: 'm18.security', result: 'PASS', filesScanned: paths.length, findings, sourceReview }));
