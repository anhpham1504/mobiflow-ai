import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, createWriteStream, writeFileSync, readFileSync } from 'node:fs';
import { withM20Database } from './m20-database.mjs';
import { createTemplatesHarness } from '../../apps/api/test/helpers/templates-fixture.mjs';
import { TemplateService } from '../../apps/api/dist/templates/template.service.js';
import { saveEvidence } from './evidence.mjs';
if (!existsSync('apps/web/.next/BUILD_ID')) throw new Error('Build with NEXT_PUBLIC_API_BASE_URL=http://localhost:33201/api/v1 before M20 browser verification');
for (const port of [33200, 33201]) { const probe = createServer(); await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); }); await new Promise(resolve => probe.close(resolve)); }
const runId = randomUUID(), directory = 'artifacts/m20/browser-runs/' + runId; mkdirSync(directory, { recursive: true });
await withM20Database(async ({ databaseUrl, database }) => {
  const s = await createTemplatesHarness(databaseUrl, { port: 33201, webOrigin: 'http://localhost:33200' });
  const output = createWriteStream(directory + '/web-runtime.log'); let web;
  try {
    const fixtures = { runId, requests: {}, templates: {}, tokens: { manager: s.manager.token, staff: s.staff.token, user: s.user.token }, teamId: s.decision.teamId, staffId: s.staff.actor.id,
      literal: '<img src="/m20-xss-image" onerror="window.M20_XSS=true">\n<script>window.M20_XSS=true</script>\nTiếng Việt 🙂',
      literalName: '<img src="/m20-xss-image" onerror="window.M20_XSS=true">', longToken: 'LongToken'.repeat(400) };
    for (const name of ['response', 'states', 'responsive']) fixtures.requests[name] = await s.assign(await s.create('browser-' + name));
    for (const name of ['checklist', 'draftResponsive', 'stale']) fixtures.requests[name] = await s.create('browser-' + name);
    const service = s.app.get(TemplateService);
    fixtures.templates.response = await service.create(s.manager.actor, { type: 'RESPONSE', name: 'M20 phản hồi khả dụng', content: { body: 'Chúng tôi đã tiếp nhận yêu cầu và đang kiểm tra.' } }, randomUUID());
    fixtures.templates.checklist = await service.create(s.manager.actor, { type: 'CHECKLIST', name: 'M20 checklist khả dụng', content: { items: [{ text: 'Kiểm tra APN', required: true }, { text: 'Ghi nhận kết quả', required: false }] } }, randomUUID());
    fixtures.templates.race = await service.create(s.manager.actor, { type: 'RESPONSE', name: 'M20 mẫu để lưu trữ đồng thời', content: { body: 'Bản nháp mẫu trước lưu trữ.' } }, randomUUID());
    fixtures.templates.xss = await service.create(s.manager.actor, { type: 'RESPONSE', name: fixtures.literalName, description: fixtures.literal, content: { body: fixtures.literal + '\n' + fixtures.longToken } }, randomUUID());
    writeFileSync(directory + '/fixtures.json', JSON.stringify(fixtures, null, 2) + '\n');
    web = spawn(process.execPath, ['apps/web/scripts/start.mjs'], { env: { ...process.env, NODE_ENV: 'production', PORT: '33200' }, stdio: ['ignore','pipe','pipe'], windowsHide: true }); web.stdout.pipe(output); web.stderr.pipe(output);
    let ready = false;
    for (let i = 0; i < 80; i++) { if (web.exitCode !== null) throw new Error('M20 production startup failed; inspect owned log'); try { ready = (await fetch('http://localhost:33200/login', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* bounded readiness */ } if (ready) break; await delay(500); }
    if (!ready) throw new Error('M20 web readiness timeout');
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.m20.config.mjs'], { env: { ...process.env, M20_BROWSER_RUN_ID: runId }, stdio: 'inherit', windowsHide: true }); const [code] = await once(child, 'exit');
    const results = JSON.parse(readFileSync(directory + '/browser-results.json', 'utf8')), checks = ['management','response','checklist','states-responsive'].flatMap(name => existsSync(directory + '/' + name + '.json') ? [JSON.parse(readFileSync(directory + '/' + name + '.json', 'utf8'))] : []);
    const success = code === 0 && checks.length === 4 && results.stats.unexpected === 0 && results.stats.skipped === 0;
    const evidence = { checkedAt: new Date().toISOString(), runId, result: success ? 'PASS' : 'FAIL', synthetic: true, database, browser: 'Microsoft Edge / Playwright', productionBuild: true, isolatedPorts: [33200,33201], stats: results.stats, checks, artifactDirectory: directory,
      limitations: 'Real PostgreSQL/API and production Next. 503/delay/empty are explicit transport fixtures only; successful business actions use real API. No live AI or full WCAG certification.' };
    await saveEvidence('docs/v1.3/evidence/M20_BROWSER.json', evidence); if (!success) throw new Error('M20 browser/Axe/responsive gate failed');
    assert.equal(s.captured.intake.length + s.captured.structured.length + s.captured.embedding.length, 0);
  } finally { if (web && web.exitCode === null) { web.kill(); await once(web, 'exit'); } output.end(); await s.close(); }
});
