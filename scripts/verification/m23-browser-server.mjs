import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, createWriteStream, cpSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { SAVED_REQUEST_VIEW_SCHEMA_VERSION } from '@mobiflow/contracts';
import { withM23Database } from './m23-database.mjs';
import { createSavedViewsHarness } from '../../apps/api/test/helpers/saved-views-fixture.mjs';
import { sourceInventory } from './m23-source.mjs';
const runId = process.argv[2]; assert.match(runId, /^[0-9a-f-]{36}$/);
const directory = 'artifacts/m23/browser-runs/' + runId; mkdirSync(directory, { recursive: true });
assert.ok(existsSync('apps/web/.next/BUILD_ID'), 'Production build required');
await withM23Database(async ({ databaseUrl, database }) => {
  const s = await createSavedViewsHarness(databaseUrl, { port: 33501, webOrigin: 'http://localhost:33500', listenHost: '0.0.0.0' });
  const output = createWriteStream(directory + '/web-runtime.log'); let web;
  try {
    const f = { runId, database, tokens: { manager: s.manager.token, staff: s.staff.token, user: s.user.token }, staffId: s.staff.actor.id, otherStaffId: s.otherStaff.actor.id, literal: '<img src=x onerror=window.M23_XSS=true>', sourceFingerprint: sourceInventory().fingerprint };
    const foreignUser = await s.prisma.user.create({ data: { id: randomUUID(), email: 'foreign-m23@synthetic.local', displayName: 'Synthetic foreign owner', role: 'USER', passwordHash: (await s.prisma.user.findUniqueOrThrow({ where: { id: s.user.actor.id } })).passwordHash } });
    f.foreignRequest = randomUUID();
    const base = { description: 'Synthetic M23 browser fixture.', createdById: s.user.actor.id, status: 'IN_PROGRESS', currentAssigneeId: s.staff.actor.id, teamId: s.decision.teamId };
    const now = Date.now();
    const rows = Array.from({ length: 34 }, (_, i) => ({ ...base, id: randomUUID(), title: 'M23 visible ' + i, publicCode: 'M23-BROWSER-' + i, priority: i < 32 ? 'HIGH' : 'MEDIUM', createdAt: new Date(now + i * 1000) }));
    await s.prisma.request.createMany({ data: [...rows, { ...base, id: f.foreignRequest, title: 'M23 foreign secret request', publicCode: 'M23-FOREIGN', priority: 'HIGH', createdById: foreignUser.id, currentAssigneeId: s.otherStaff.actor.id }] });
    f.ownRequestIds = rows.map(r => r.id);
    const views = await s.prisma.savedRequestView.createManyAndReturn({ data: [
      { id: randomUUID(), ownerUserId: s.staff.actor.id, name: 'View riêng tư', normalizedName: 'view riêng tư', schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION, filters: {} },
      { id: randomUUID(), ownerUserId: s.staff.actor.id, name: 'Không khả dụng', normalizedName: 'không khả dụng', schemaVersion: 'unsupported', filters: { internalMetadata: 'never-client' } },
      { id: randomUUID(), ownerUserId: s.staff.actor.id, name: 'Tất cả bộ lọc', normalizedName: 'tất cả bộ lọc', schemaVersion: SAVED_REQUEST_VIEW_SCHEMA_VERSION, filters: {} },
    ] });
    f.staffViewId = views[0].id; f.unavailableId = views[1].id; f.emptyId = views[2].id;
    writeFileSync(directory + '/fixtures.json', JSON.stringify(f, null, 2));
    cpSync('apps/web/.next/static', 'apps/web/.next/standalone/apps/web/.next/static', { recursive: true });
    web = spawn(process.execPath, ['apps/web/.next/standalone/apps/web/server.js'], { env: { ...process.env, NODE_ENV: 'production', PORT: '33500', HOSTNAME: '0.0.0.0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    web.stdout.pipe(output); web.stderr.pipe(output);
    let ready = false;
    for (let i = 0; i < 80; i++) { if (web.exitCode !== null) throw Error('Production web failed'); try { ready = (await fetch('http://localhost:33500/login', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* bounded readiness */ } if (ready) break; await delay(500); }
    assert.ok(ready); writeFileSync(directory + '/server-ready.json', JSON.stringify({ runId, result: 'READY' }));
    let done = false;
    for (let i = 0; i < 2400; i++) { done = existsSync('/source/' + directory + '/client-done.json'); if (done) break; await delay(500); }
    assert.ok(done, 'Browser client timeout');
    const aiCalls = Object.values(s.captured).reduce((n, entries) => n + entries.length, 0); assert.equal(aiCalls, 0);
    assert.equal(await s.prisma.request.count({ where: { id: { in: f.ownRequestIds }, version: 1, status: 'IN_PROGRESS' } }), 34);
    writeFileSync(directory + '/server-report.json', JSON.stringify({ runId, result: 'PASS', aiCalls, database, businessVersionsUnchanged: 34, sourceFingerprint: f.sourceFingerprint }, null, 2));
  } finally { if (web && web.exitCode === null) { web.kill(); await once(web, 'exit'); } output.end(); await s.close(); }
});
