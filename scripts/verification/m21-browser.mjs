import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, createWriteStream, writeFileSync, readFileSync } from 'node:fs';
import { withM21Database } from './m21-database.mjs';
import { createRoutingHarness } from '../../apps/api/test/helpers/routing-fixture.mjs';
import { RoutingService } from '../../apps/api/dist/routing/routing.service.js';
import { TemplateService } from '../../apps/api/dist/templates/template.service.js';
import { saveEvidence } from './evidence.mjs';
if (!existsSync('apps/web/.next/BUILD_ID')) throw new Error('Build with NEXT_PUBLIC_API_BASE_URL=http://localhost:33301/api/v1 before M21 browser gate');
for (const port of [33300,33301]) { const probe = createServer(); await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); }); await new Promise(resolve => probe.close(resolve)); }
const runId = randomUUID(), directory = 'artifacts/m21/browser-runs/' + runId; mkdirSync(directory, { recursive: true });
await withM21Database(async ({ databaseUrl, database }) => {
  const s = await createRoutingHarness(databaseUrl, { port: 33301, webOrigin: 'http://localhost:33300' });
  const output = createWriteStream(directory + '/web-runtime.log'); let web;
  try {
    const routing = s.app.get(RoutingService), targets = await routing.targets(s.manager.actor, {});
    const fixtures = { runId, requests: {}, rules: {}, tokens: { manager: s.manager.token, staff: s.staff.token, user: s.user.token }, teamId: s.decision.teamId, staffId: s.staff.actor.id, otherStaffId: s.otherStaff.actor.id, targets,
      literalName: '<img src="/m21-xss-image" onerror="window.M21_XSS=true">', literal: '<script>window.M21_XSS=true</script>\nTiếng Việt 🙂', longToken: 'RoutingLongToken'.repeat(25) };
    for (const name of ['draft','stale','states']) fixtures.requests[name] = await s.create('browser-' + name);
    for (const name of ['reassign','responsive']) fixtures.requests[name] = await s.assign(await s.create('browser-' + name));
    for (const [name,priority] of [['medium','MEDIUM'],['high','HIGH']]) {
      const rule = await routing.create(s.manager.actor, { name: 'M21 gợi ý ' + priority, priority: 10, target: { type: 'TEAM', id: s.decision.teamId }, conditions: [{ field: 'priority', operator: 'EQ', values: [priority] }] }, randomUUID());
      fixtures.rules[name] = await routing.lifecycle(rule.id, s.manager.actor, { expectedRevision: 1, expectedRuleVersion: 1 }, 'ACTIVE', randomUUID());
    }
    const other = targets.find(target => target.id !== s.decision.teamId); fixtures.otherTeamId = other.id;
    fixtures.otherTeamStaffId = (await s.prisma.teamMember.findFirstOrThrow({ where: { teamId: other.id, active: true, user: { role: 'STAFF', active: true, available: true } } })).userId;
    await s.prisma.team.update({ where: { id: s.decision.teamId }, data: { name: fixtures.literalName } });
    fixtures.template = await s.app.get(TemplateService).create(s.manager.actor, { type: 'CHECKLIST', name: 'M21 kiểm tra mẫu M20', content: { items: [{ text: 'Kiểm tra do người dùng xác nhận', required: false }] } }, randomUUID());
    writeFileSync(directory + '/fixtures.json', JSON.stringify(fixtures, null, 2) + '\n');
    web = spawn(process.execPath, ['apps/web/scripts/start.mjs'], { env: { ...process.env, NODE_ENV: 'production', PORT: '33300' }, stdio: ['ignore','pipe','pipe'], windowsHide: true }); web.stdout.pipe(output); web.stderr.pipe(output);
    let ready = false;
    for (let i = 0; i < 80; i++) { if (web.exitCode !== null) throw new Error('M21 production startup failed'); try { ready = (await fetch('http://localhost:33300/login', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* bounded readiness */ } if (ready) break; await delay(500); }
    if (!ready) throw new Error('M21 readiness timeout');
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.m21.config.mjs'], { env: { ...process.env, M21_BROWSER_RUN_ID: runId }, stdio: 'inherit', windowsHide: true }); const [code] = await once(child, 'exit');
    const results = JSON.parse(readFileSync(directory + '/browser-results.json', 'utf8')), checks = ['management','human','states','responsive'].flatMap(name => existsSync(directory + '/' + name + '.json') ? [JSON.parse(readFileSync(directory + '/' + name + '.json', 'utf8'))] : []);
    const success = code === 0 && checks.length === 4 && results.stats.unexpected === 0 && results.stats.skipped === 0;
    const aiCalls = Object.values(s.captured).reduce((n, list) => n + list.length, 0);
    await saveEvidence('docs/v1.3/evidence/M21_BROWSER.json', { checkedAt: new Date().toISOString(), runId, result: success ? 'PASS' : 'FAIL', synthetic: true, database, browser: 'Microsoft Edge / Playwright', productionBuild: true, isolatedPorts: [33300,33301], stats: results.stats, checks, aiCalls, artifactDirectory: directory,
      limitations: 'Real PostgreSQL/API and production Next;503/delay transport fixtures explicitly labeled. No live AI or full WCAG certification.' });
    if (!success) throw new Error('M21 browser gate failed'); assert.equal(aiCalls, 0);
  } finally { if (web && web.exitCode === null) { web.kill(); await once(web, 'exit'); } output.end(); await s.close(); }
});
