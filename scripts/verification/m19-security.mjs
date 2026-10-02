import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { saveEvidence } from './evidence.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const baseline = '1f54dce3c8427976763b19ef33f181b4ef9a3337', release = '31b445caf07dad606601a1e38e8ed39836d9f825';
assert.equal(git('rev-parse', 'HEAD'), baseline); assert.equal(git('branch', '--show-current'), 'feat/v1.3-mentions-watchers');
assert.equal(git('rev-parse', 'v1.2.0^{commit}'), release);
const migrationPaths = git('ls-tree', '-r', '--name-only', baseline, 'apps/api/prisma/migrations').split('\n').filter(path => path.endsWith('/migration.sql'));
assert.equal(migrationPaths.length, 8);
const migrationFreeze = migrationPaths.map(path => ({ path, baseline: git('rev-parse', baseline + ':' + path), current: git('hash-object', '--path=' + path, path) }));
assert.ok(migrationFreeze.every(item => item.baseline === item.current));
const preserved = ['apps/api/src/ai', 'apps/api/src/knowledge', 'apps/api/src/analytics', 'apps/api/src/dashboard', 'apps/api/src/requests/sla-clock.ts', 'scripts/demo', 'packages/config', 'package-lock.json'];
assert.equal(git('diff', baseline, '--', ...preserved), '');
const read = path => readFile(path, 'utf8');
const api = JSON.parse(await read('docs/v1.3/evidence/M19_API.json'));
const browser = JSON.parse(await read('docs/v1.3/evidence/M19_BROWSER.json'));
const database = JSON.parse(await read('docs/v1.3/evidence/M19_DATABASE.json'));
for (const evidence of [api, browser, database]) assert.equal(evidence.result, 'PASS');
assert.ok(Object.values(api.checks).every(value => value === 'PASS'));
assert.equal(browser.stats.expected, 5); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0);
const collaboration = browser.checks.find(check => 'userPrivateApiRequests' in check), rendering = browser.checks.find(check => 'xssImageRequests' in check), scope = browser.checks.find(check => 'actualReassignment' in check);
assert.equal(collaboration.userPrivateApiRequests, 0); assert.equal(collaboration.userPayloadCanaryAbsent, true);
assert.equal(rendering.xssImageRequests, 0); assert.equal(rendering.xssDialogs, 0); assert.deepEqual(rendering.consolePageErrors, []); assert.equal(scope.staleDeepLinkDenied, true);
assert.equal(database.developerMigrations, 7); assert.equal(database.developerDatabaseModified, false);
assert.ok(database.checks.every(check => check.result === 'PASS' && check.oldChecksums === 'unchanged'));
const [controller, service, access, fanout, note, policy, query, contracts, ui, selector, watch, middleware, client, migration] = await Promise.all([
  read('apps/api/src/requests/request-collaboration.controller.ts'), read('apps/api/src/requests/request-collaboration.service.ts'), read('apps/api/src/requests/collaboration-access.ts'), read('apps/api/src/requests/collaboration-notifications.ts'),
  read('apps/api/src/requests/internal-note.service.ts'), read('apps/api/src/authorization/authorization-policy.service.ts'), read('apps/api/src/requests/request-query.service.ts'), read('packages/contracts/src/internal-notes.ts'),
  read('apps/web/src/components/internal-notes.tsx'), read('apps/web/src/components/mention-selector.tsx'), read('apps/web/src/components/request-watch.tsx'), read('apps/api/src/http.ts'), read('apps/web/src/lib/session.ts'), read('apps/api/prisma/migrations/20261002020000_m19_mentions_watchers/migration.sql'),
]);
const sourceReview = {
  operationalRolesAndExistingGuards: controller.includes("@Roles('STAFF', 'MANAGER')") && controller.includes('@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)'),
  strictStructuredBounds: contracts.includes('MAX_NOTE_MENTIONS = 10') && contracts.includes('mentionedUserIdsSchema.optional()') && contracts.includes('}).strict()'),
  liveIdentityAndBoundParent: access.includes('Prisma.sql') && access.includes('policy.requestScopeSql(actor)') && access.includes('user.role !== actor.role') && access.includes('revokedAt: null') && access.includes('FOR UPDATE') && access.includes('FOR SHARE'),
  eligibilityNeverUsesWatchForAccess: policy.includes('internalCollaborators') && policy.includes('notificationScope') && !policy.includes('requestWatches'),
  noGlobalDirectoryOrWatcherList: service.includes('lockCollaborationRequest') && service.includes('this.policy.internalCollaborators(request)') && service.includes('select: { id: true, displayName: true, role: true }') && !/@Get\(['"](?:watchers|users)/.test(controller),
  atomicAppendAndNotification: note.includes('this.prisma.$transaction') && note.includes('tx.requestInternalNote.create') && note.includes('notifyCollaboration(tx') && !/tx\.request\.(?:create|update|delete)/.test(note),
  bodyFreeResourceAudit: note.includes('safeAfterJson: { noteId: note.id, requestId: id, authorId: actor.id }') && !fanout.includes('note.body'),
  boundedBatchDedupAndSelfSuppression: fanout.includes('MAX_REQUEST_WATCHERS = 100') && fanout.includes('tx.user.findMany') && fanout.includes('tx.notification.createMany') && fanout.includes('skipDuplicates: true') && fanout.includes('id !== actorId'),
  persistedCrossTypeKeyAndLeastPrivilege: migration.includes('Notification_internal_recipient_event_key') && migration.includes('REVOKE UPDATE, DELETE, TRUNCATE ON "RequestInternalNoteMention"') && migration.includes('REVOKE UPDATE, TRUNCATE ON "RequestWatcher"'),
  deliveryScopeBeforePagingAndUnread: query.includes('this.policy.notificationScope(actor)') && query.includes("query.unreadOnly==='true'") && query.includes('lockCollaborationRequest(tx,this.policy,existing.requestId,actor,false)'),
  watchOnlyOwnSubscriptionAndIdempotent: service.includes('userId: actor.id') && service.includes('Boolean(existing) === desired') && !/tx\.request\.(?:create|update|delete)/.test(service),
  noUnsafeSqlShellOrPrivateLogging: !/RawUnsafe|child_process|console\.|\blog\(/.test(service + access + fanout + note),
  escapedPlainNoteAndNames: ui.includes('{note.body}</p>') && selector.includes('{user.displayName}</span>') && !/dangerouslySetInnerHTML|innerHTML|DOMParser/.test(ui + selector + watch),
  privateNoStore: middleware.includes("res.setHeader('Cache-Control', 'no-store')") && client.includes("cache:'no-store'"),
};
assert.ok(Object.values(sourceReview).every(Boolean), 'Focused source review invariant failed');
const paths = [...new Set([...git('diff', '--name-only', baseline).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
const configured = ['DATABASE_URL', 'MIGRATION_DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'POSTGRES_PASSWORD', 'POSTGRES_APP_PASSWORD'].flatMap(key => process.env[key] ? [process.env[key]] : []);
for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) { try { configured.push(decodeURIComponent(new URL(process.env[key]).password)); } catch { /* Never echo credentials. */ } }
const secrets = [...new Set(configured)].filter(value => value.length >= 12), findings = [];
async function scan(path, tokenPatterns = true) {
  const content = await read(path);
  if (secrets.some(secret => content.includes(secret))) findings.push({ path, kind: 'configured-secret' });
  if (tokenPatterns) for (const [kind, pattern] of [['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/], ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/], ['openai-token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/], ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/]]) if (pattern.test(content)) findings.push({ path, kind });
}
for (const path of paths) if (/\.(?:[cm]?js|tsx?|json|md|txt|sql|ya?ml)$/.test(path)) await scan(path);
let bundleFilesScanned = 0;
async function scanBundle(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name); if (entry.isDirectory()) await scanBundle(path); else if (/\.js$/.test(entry.name)) { await scan(path, false); bundleFilesScanned++; }
  }
}
await scanBundle('apps/web/.next/static'); assert.deepEqual(findings, [], 'Credential scan requires review; values are never reported');
const db = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL }); await db.connect();
let developerMigrations;
try { developerMigrations = Number((await db.query('SELECT count(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count); } finally { await db.end(); }
assert.equal(developerMigrations, 7);
let ollama = 'NOT RUN — endpoint is not loopback';
const endpoint = new URL(process.env.OLLAMA_BASE_URL);
if (['localhost', '127.0.0.1'].includes(endpoint.hostname)) {
  try { const response = await fetch(new URL('/api/tags', endpoint), { signal: AbortSignal.timeout(1500) }); ollama = response.ok ? 'AVAILABLE — read-only tags probe; no generation performed' : 'UNAVAILABLE — read-only tags probe HTTP ' + response.status; } catch { ollama = 'UNAVAILABLE — read-only tags probe connection/timeout'; }
}
await saveEvidence('docs/v1.3/evidence/M19_SECURITY.json', {
  checkedAt: new Date().toISOString(), result: 'PASS', baseline, scope: 'Focused source/credential review plus actual M19 PostgreSQL, HTTP, race, rollback and XSS/Axe browser evidence',
  apiCheckedAt: api.checkedAt, browserRunId: browser.runId, databaseCheckedAt: database.checkedAt, migrationFreeze, preservedOwners: preserved, sourceReview,
  filesScanned: paths.length, bundleFilesScanned, findings, developerMigrations, developerDatabaseModified: false, ollama,
  limitations: 'Targeted review and negative tests; not penetration testing, live AI evaluation, production certification or a load SLO.',
});
console.log(JSON.stringify({ event: 'm19.security', result: 'PASS', filesScanned: paths.length, bundleFilesScanned, findings, developerMigrations, ollama }));
