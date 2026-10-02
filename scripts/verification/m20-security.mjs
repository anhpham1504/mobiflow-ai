import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { saveEvidence } from './evidence.mjs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const baseline = '35e4b1c41165fa04348871dee31bd20c28386b47', release = '31b445caf07dad606601a1e38e8ed39836d9f825';
assert.equal(git('rev-parse', 'HEAD'), baseline); assert.equal(git('branch', '--show-current'), 'feat/v1.3-response-checklist-templates'); assert.equal(git('rev-parse', 'v1.2.0^{commit}'), release);
const migrationPaths = git('ls-tree','-r','--name-only',baseline,'apps/api/prisma/migrations').split('\n').filter(path => path.endsWith('/migration.sql')); assert.equal(migrationPaths.length, 9);
const migrationFreeze = migrationPaths.map(path => ({ path, baseline: git('rev-parse', baseline + ':' + path), current: git('hash-object','--path=' + path,path) })); assert.ok(migrationFreeze.every(row => row.baseline === row.current));
const preserved = ['apps/api/src/ai','apps/api/src/knowledge','apps/api/src/analytics','apps/api/src/dashboard','apps/api/src/requests/sla-clock.ts','apps/api/src/requests/sla-monitor.service.ts','apps/api/src/requests/transition-rules.ts','apps/api/src/requests/internal-note.service.ts','apps/api/src/requests/request-collaboration.service.ts','apps/api/src/requests/collaboration-notifications.ts','packages/contracts/src/internal-notes.ts','scripts/demo','packages/config','package-lock.json'];
assert.equal(git('diff',baseline,'--',...preserved), '');
const read = path => readFile(path,'utf8');
const api = JSON.parse(await read('docs/v1.3/evidence/M20_API.json')), browser = JSON.parse(await read('docs/v1.3/evidence/M20_BROWSER.json')), database = JSON.parse(await read('docs/v1.3/evidence/M20_DATABASE.json'));
for (const evidence of [api,browser,database]) assert.equal(evidence.result,'PASS'); assert.ok(Object.values(api.checks).every(value => value === 'PASS')); assert.equal(browser.stats.expected,4); assert.equal(browser.stats.unexpected,0); assert.equal(browser.stats.skipped,0);
assert.equal(database.developerMigrations,7); assert.ok(database.checks.every(check => check.historicalHashes === 'unchanged' && check.immutableIncludingHistoricalAppend && check.runtimeDdlDenied && check.contiguousRevisionSequence));
const ui = await read('apps/web/src/components/template-management.tsx'), selector = await read('apps/web/src/components/template-selector.tsx'), controller = await read('apps/api/src/templates/template.controller.ts'), service = await read('apps/api/src/templates/template.service.ts'), source = await read('apps/api/src/templates/template-provenance.ts'), policy = await read('apps/api/src/authorization/authorization-policy.service.ts'), machine = await read('apps/api/src/requests/request-state-machine.service.ts'), query = await read('apps/api/src/requests/request-query.service.ts'), contracts = await read('packages/contracts/src/templates.ts'), migration = await read('apps/api/prisma/migrations/20261002030000_m20_response_checklist_templates/migration.sql');
const sourceReview = {
  existingGuardsAndRoleScope: controller.includes('@UseGuards(AccessGuard, RolesGuard, WorkflowGuard)') && controller.includes("@Roles('STAFF', 'MANAGER')") && policy.includes("{ type: 'RESPONSE', status: 'ACTIVE' }") && controller.includes("@Roles('MANAGER')"),
  strictSharedAndCompatibleContent: contracts.includes('text(1, 4000)') && contracts.includes('text(1, 500)') && contracts.includes('.min(1).max(30)') && contracts.includes('}).strict()'),
  identityRecheckAndTransactionalConcurrency: service.includes('lockCollaborationIdentity(tx, actor)') && service.includes('FOR UPDATE') && service.includes('t.currentRevision !== expectedRevision') && service.includes("t.status !== 'ACTIVE'") && service.includes('this.prisma.$transaction'),
  boundedSqlPaging: service.includes('take: limit + 1') && service.includes('where: { AND: [scope, where') && !service.includes('.filter('),
  immutableAndHistoricalConstraints: migration.includes('DEFERRABLE INITIALLY DEFERRED') && migration.includes('BEFORE UPDATE OR DELETE') && migration.includes('item_count <> r."itemCount"') && migration.includes('ON DELETE RESTRICT'),
  leastPrivilegeAndNoDelete: migration.includes('REVOKE ALL ON') && migration.includes('GRANT UPDATE (') && !/@Delete|@Patch/.test(controller),
  sourceLockedValidatedAndHumanContentOwned: source.includes('Prisma.sql') && source.includes('FOR SHARE OF t') && source.includes("source.status !== 'ACTIVE'") && source.includes('source.revision !== source.currentRevision') && machine.includes('body:command.body!') && machine.includes('items:{create:decision.actions.map'),
  expectedVersionPrecedesSourceAdoption: machine.indexOf('request.version !== command.expectedVersion') < machine.indexOf('await validateTemplateSource'),
  resourceOnlyBodyFreeAudits: !/requestId:\s*requestId/.test(source) && service.includes("resourceType: 'OperationalTemplate'") && !/safeAfterJson:[^\n]*(?:body|content):/.test(service+source),
  managerOnlyProjectionsAndExplicitMessageProjection: query.includes("actor.role==='MANAGER'?{manualDraft:") && query.includes("actor.role==='MANAGER'?{sourceTemplateRevisionId:true}") && query.includes('messages:{select:{body:true,kind:true}}'),
  noBusinessMutationFromManagement: !/tx\.(?:request|notification|checklist|assignment|slaInstance)\.(?:create|update|delete)/.test(service),
  noUnsafeSqlShellOrRawLogging: !/RawUnsafe|child_process|console\.|\blog\(/.test(service+source),
  escapedTextAndNoStore: !/dangerouslySetInnerHTML|innerHTML|DOMParser/.test(ui+selector) && controller.includes("@Header('Cache-Control', 'no-store')"),
  explicitApplyConfirmAndNoAutoCommand: selector.includes('Xác nhận thay thế bản nháp') && selector.includes('onApply(response.data.current)') && !/['"]POST['"]/.test(selector),
};
assert.ok(Object.values(sourceReview).every(Boolean),'Focused M20 source review invariant failed');
const paths = [...new Set([...git('diff','--name-only',baseline).split('\n'), ...git('ls-files','--others','--exclude-standard').split('\n')])].filter(Boolean);
const configured = ['DATABASE_URL','MIGRATION_DATABASE_URL','JWT_SECRET','REFRESH_TOKEN_SECRET','POSTGRES_PASSWORD','POSTGRES_APP_PASSWORD'].flatMap(key => process.env[key] ? [process.env[key]] : []);
for (const key of ['DATABASE_URL','MIGRATION_DATABASE_URL']) { try { configured.push(decodeURIComponent(new URL(process.env[key]).password)); } catch { /* no credential output */ } }
const secrets = [...new Set(configured)].filter(value => value.length >= 12), findings = [];
async function scan(path, patterns = true) { const content = await read(path); if (secrets.some(secret => content.includes(secret))) findings.push({ path, kind: 'configured-secret' }); if (patterns) for (const [kind, regex] of [['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['github-token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],['openai-token',/\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/],['aws-access-key',/\bAKIA[0-9A-Z]{16}\b/]]) if (regex.test(content)) findings.push({ path, kind }); }
for (const path of paths) if (/\.(?:[cm]?js|tsx?|json|md|txt|sql|ya?ml)$/.test(path)) await scan(path);
let bundleFilesScanned = 0;
async function bundles(folder) { for (const entry of await readdir(folder,{ withFileTypes:true })) { const path = join(folder,entry.name); if(entry.isDirectory()) await bundles(path); else if(/\.js$/.test(entry.name)){await scan(path,false);bundleFilesScanned++;} } }
await bundles('apps/web/.next/static'); assert.deepEqual(findings,[],'Credential scan findings require review; secret values are never emitted');
const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); let developerMigrations;
try { developerMigrations = Number((await db.query('SELECT count(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count); } finally { await db.end(); } assert.equal(developerMigrations,7);
let ollama = 'NOT RUN — no loopback runtime endpoint configured'; const endpoint = new URL(process.env.OLLAMA_BASE_URL);
if (['localhost','127.0.0.1'].includes(endpoint.hostname)) { try { const response = await fetch(new URL('/api/tags',endpoint),{ signal:AbortSignal.timeout(1500) }); ollama = response.ok ? 'AVAILABLE — read-only tags, no generation' : 'UNAVAILABLE — read-only HTTP ' + response.status; } catch { ollama = 'UNAVAILABLE — read-only tags connection/timeout'; } }
await saveEvidence('docs/v1.3/evidence/M20_SECURITY.json',{ checkedAt:new Date().toISOString(),result:'PASS',baseline,scope:'Focused source/credential review and real PostgreSQL/HTTP/race/rollback/XSS/Axe evidence',sourceReview,migrationFreeze,preservedOwners:preserved,apiCheckedAt:api.checkedAt,browserRunId:browser.runId,filesScanned:paths.length,bundleFilesScanned,findings,developerMigrations,developerDatabaseModified:false,ollama,limitations:'Targeted review, not penetration testing/WCAG certification/live AI evaluation/load SLO.' });
console.log(JSON.stringify({event:'m20.security',result:'PASS',filesScanned:paths.length,bundleFilesScanned,findings,developerMigrations,ollama}));
