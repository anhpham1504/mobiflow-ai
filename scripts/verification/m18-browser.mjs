import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, createWriteStream, writeFileSync, readFileSync } from 'node:fs';
import { withM18Database } from './m18-database.mjs';
import { createInternalNotesHarness } from '../../apps/api/test/helpers/internal-notes-fixture.mjs';
import { saveEvidence } from './evidence.mjs';

if (!existsSync('apps/web/.next/BUILD_ID')) throw new Error('Run npm run build before M18 browser verification');
if (process.env.NEXT_PUBLIC_API_BASE_URL !== 'http://localhost:3001/api/v1' || process.env.WEB_ORIGIN !== 'http://localhost:3000') throw new Error('M18 browser gate requires established loopback 3000/3001 configuration');
for (const port of [3000, 3001]) {
  const probe = createServer(); await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); }); await new Promise(resolve => probe.close(resolve));
}
const runId = randomUUID(), directory = 'artifacts/m18/browser-runs/' + runId;
mkdirSync(directory, { recursive: true }); mkdirSync('artifacts/m18/screenshots', { recursive: true });
await withM18Database(async ({ databaseUrl, database }) => {
  const s = await createInternalNotesHarness(databaseUrl, { port: 3001 });
  let web; const output = createWriteStream(directory + '/web-runtime.log');
  try {
    const fixtures = { runId, requests: {}, literal: '<img src="/m18-xss-image" onerror="window.M18_XSS=true">\n<script>window.M18_XSS=true</script>\nTiếng Việt 🙂\n' + 'LongToken'.repeat(350) };
    for (const name of ['collaboration', 'states', 'long', 'pagination', 'closed', 'canceled', 'foreign']) fixtures.requests[name] = await s.assign(await s.create('browser-' + name));
    for (const name of ['long', 'closed', 'canceled']) { const result = await s.call(s.manager.token, '/requests/' + fixtures.requests[name].id + '/internal-notes', { body: name === 'long' ? fixtures.literal : 'Ghi chú synthetic trước trạng thái kết thúc.' }); assert.equal(result.status, 201); }
    await s.prisma.requestInternalNote.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ requestId: fixtures.requests.pagination.id, authorId: s.staff.actor.id, body: 'Synthetic M18 page ' + String(i).padStart(2, '0'), createdAt: new Date(Date.UTC(2026, 9, 2, 1, 0, i)) })) });
    let closed = fixtures.requests.closed;
    closed = await s.command(s.staff, '/requests/' + closed.id + '/start', { expectedVersion: closed.version });
    closed = await s.command(s.staff, '/requests/' + closed.id + '/resolve', { expectedVersion: closed.version, rootCause: 'Nguyên nhân synthetic đã được xác định.', resolution: 'Khắc phục synthetic đã được nhân viên thực hiện.', verification: 'Kiểm chứng synthetic đã hoàn tất.' });
    fixtures.requests.closed = await s.command(s.user, '/requests/' + closed.id + '/confirm', { expectedVersion: closed.version });
    fixtures.requests.canceled = await s.command(s.manager, '/requests/' + fixtures.requests.canceled.id + '/cancel', { expectedVersion: fixtures.requests.canceled.version, reason: 'Hủy tình huống synthetic browser.' });
    const foreign = fixtures.requests.foreign;
    await s.command(s.manager, '/manager/requests/' + foreign.id + '/reassign', { expectedVersion: foreign.version, staffId: s.otherStaff.actor.id, teamId: s.decision.teamId, reason: 'Bàn giao synthetic để kiểm tra IDOR UI.' });
    writeFileSync(directory + '/fixtures.json', JSON.stringify(fixtures, null, 2) + '\n');
    web = spawn(process.execPath, ['apps/web/scripts/start.mjs'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    web.stdout.pipe(output); web.stderr.pipe(output);
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (web.exitCode !== null) throw new Error('M18 production web startup failed; inspect owned runtime log');
      try { ready = (await fetch('http://localhost:3000/login', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Bounded readiness polling. */ }
      if (ready) break; await delay(500);
    }
    if (!ready) throw new Error('M18 web readiness timeout');
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.m18.config.mjs'], { cwd: process.cwd(), env: { ...process.env, M18_BROWSER_RUN_ID: runId }, stdio: 'inherit', windowsHide: true });
    const [code] = await once(child, 'exit');
    const results = JSON.parse(readFileSync(directory + '/browser-results.json', 'utf8'));
    const checks = ['collaboration', 'states', 'responsive', 'pagination-terminal'].flatMap(name => existsSync(directory + '/' + name + '.json') ? [JSON.parse(readFileSync(directory + '/' + name + '.json', 'utf8'))] : []);
    const success = code === 0 && checks.length === 4 && results.stats.unexpected === 0 && results.stats.skipped === 0;
    const evidence = { checkedAt: new Date().toISOString(), runId, result: success ? 'PASS' : 'FAIL', synthetic: true, database, browser: 'Microsoft Edge / Playwright', productionBuild: true, stats: results.stats, checks, artifactDirectory: directory, limitations: 'Real PostgreSQL/API and production Next build. Transport delays/errors are explicit browser-only fixtures. No live model generation or WCAG certification claim.' };
    await saveEvidence('docs/v1.3/evidence/M18_BROWSER.json', evidence); writeFileSync(directory + '/evidence.json', JSON.stringify(evidence, null, 2) + '\n');
    if (!success) throw new Error('M18 browser/Axe/responsive verification failed');
  } finally {
    if (web && web.exitCode === null) { web.kill(); await once(web, 'exit'); } output.end(); await s.close();
  }
});
