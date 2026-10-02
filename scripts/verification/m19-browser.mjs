import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, createWriteStream, writeFileSync, readFileSync } from 'node:fs';
import { withM19Database } from './m19-database.mjs';
import { createMentionsWatchersHarness } from '../../apps/api/test/helpers/mentions-watchers-fixture.mjs';
import { saveEvidence } from './evidence.mjs';

if (!existsSync('apps/web/.next/BUILD_ID')) throw new Error('Build with NEXT_PUBLIC_API_BASE_URL=http://localhost:33101/api/v1 before M19 browser verification');
// Fixed, isolated loopback services; never kill/restart an existing listener.
for (const port of [33100, 33101]) {
  const probe = createServer(); await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); }); await new Promise(resolve => probe.close(resolve));
}
const runId = randomUUID(), directory = 'artifacts/m19/browser-runs/' + runId;
mkdirSync(directory, { recursive: true });
await withM19Database(async ({ databaseUrl, database }) => {
  const s = await createMentionsWatchersHarness(databaseUrl, { port: 33101, webOrigin: 'http://localhost:33100' });
  let web; const output = createWriteStream(directory + '/web-runtime.log');
  try {
    const fixtures = { runId, requests: {}, staffId: s.staff.actor.id, managerId: s.manager.actor.id, otherStaffId: s.otherStaff.actor.id, teamId: s.decision.teamId,
      literal: '<img src="/m19-xss-image" onerror="window.M19_XSS=true">\n<script>window.M19_XSS=true</script>\nTiếng Việt 🙂\n' + 'LongToken'.repeat(350),
      longName: '<img src="/m19-xss-image" onerror="window.M19_XSS=true">' + 'VeryLongName'.repeat(8),
    };
    // Existing role, synthetic display-name boundary. No new login role or product endpoint.
    await s.prisma.user.update({ where: { id: s.manager.actor.id }, data: { displayName: fixtures.longName } });
    for (const name of ['collaboration', 'states', 'long', 'scopeLoss', 'closed', 'canceled']) fixtures.requests[name] = await s.assign(await s.create('browser-' + name));
    for (const name of ['long', 'closed', 'canceled']) {
      assert.equal((await s.call(s.staff.token, '/requests/' + fixtures.requests[name].id + '/internal-notes', { body: name === 'long' ? fixtures.literal : 'Synthetic M19 terminal note.', mentionedUserIds: [s.manager.actor.id] })).status, 201);
    }
    let closed = fixtures.requests.closed;
    closed = await s.command(s.staff, '/requests/' + closed.id + '/start', { expectedVersion: closed.version });
    closed = await s.command(s.staff, '/requests/' + closed.id + '/resolve', { expectedVersion: closed.version, rootCause: 'Nguyên nhân synthetic đã được xác định.', resolution: 'Khắc phục synthetic đã được nhân viên thực hiện.', verification: 'Kiểm chứng synthetic đã hoàn tất.' });
    fixtures.requests.closed = await s.command(s.user, '/requests/' + closed.id + '/confirm', { expectedVersion: closed.version });
    fixtures.requests.canceled = await s.command(s.manager, '/requests/' + fixtures.requests.canceled.id + '/cancel', { expectedVersion: fixtures.requests.canceled.version, reason: 'Hủy tình huống synthetic browser.' });
    writeFileSync(directory + '/fixtures.json', JSON.stringify(fixtures, null, 2) + '\n');
    web = spawn(process.execPath, ['apps/web/scripts/start.mjs'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', PORT: '33100' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    web.stdout.pipe(output); web.stderr.pipe(output);
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (web.exitCode !== null) throw new Error('M19 production web startup failed; inspect owned runtime log');
      try { ready = (await fetch('http://localhost:33100/login', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Bounded readiness. */ }
      if (ready) break; await delay(500);
    }
    if (!ready) throw new Error('M19 web readiness timeout');
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.m19.config.mjs'], { cwd: process.cwd(), env: { ...process.env, M19_BROWSER_RUN_ID: runId }, stdio: 'inherit', windowsHide: true });
    const [code] = await once(child, 'exit');
    const results = JSON.parse(readFileSync(directory + '/browser-results.json', 'utf8'));
    const checks = ['collaboration', 'states', 'responsive', 'scope-loss', 'terminal'].flatMap(name => existsSync(directory + '/' + name + '.json') ? [JSON.parse(readFileSync(directory + '/' + name + '.json', 'utf8'))] : []);
    const success = code === 0 && checks.length === 5 && results.stats.unexpected === 0 && results.stats.skipped === 0;
    const evidence = { checkedAt: new Date().toISOString(), runId, result: success ? 'PASS' : 'FAIL', synthetic: true, database, browser: 'Microsoft Edge / Playwright', productionBuild: true, isolatedPorts: [33100, 33101], stats: results.stats, checks, artifactDirectory: directory,
      limitations: 'Actual PostgreSQL/API and production Next build. Delays/503/400 are explicit browser-only transport fixtures; successful writes, scope loss and delivery use real API. No live AI or WCAG certification claim.' };
    await saveEvidence('docs/v1.3/evidence/M19_BROWSER.json', evidence); writeFileSync(directory + '/evidence.json', JSON.stringify(evidence, null, 2) + '\n');
    if (!success) throw new Error('M19 browser/Axe/responsive verification failed');
  } finally {
    if (web && web.exitCode === null) { web.kill(); await once(web, 'exit'); } output.end(); await s.close();
  }
});
