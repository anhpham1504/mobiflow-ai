import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TextEncoder } from 'node:util';
import { argon2id, hash, needsRehash } from 'argon2';
import { SignJWT } from 'jose';
import { parseApiEnvironment } from '@mobiflow/config';
import { createApplication } from '../dist/app.js';
import { AuthorizationPolicyService } from '../dist/authorization/authorization-policy.service.js';

const databaseUrl = process.env.M2_INTEGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error('M2_INTEGRATION_DATABASE_URL is required for this real PostgreSQL test.');
const origin = 'http://localhost:3000';
const demoPassword = 'MobiFlowDemo!2026';
const env = parseApiEnvironment({
  NODE_ENV: 'test', DATABASE_URL: databaseUrl, WEB_ORIGIN: origin,
  JWT_SECRET: 'integration-jwt-secret-'.padEnd(48, 'a'), REFRESH_TOKEN_SECRET: 'integration-refresh-secret-'.padEnd(48, 'b'),
  OLLAMA_BASE_URL: 'http://127.0.0.1:1', OLLAMA_MODEL: 'fixture:1', OLLAMA_EMBEDDING_MODEL: 'unconfigured', AUTH_COOKIE_SECURE: 'false',
});

function csrfHeaders(extra = {}) { return { Origin: origin, 'X-CSRF-Protection': '1', ...extra }; }
function cookieFrom(response) { return response.headers.get('set-cookie'); }
function parseSetCookie(value) {
  const [pair, ...attributes] = value.split(';').map((part) => part.trim());
  const separator = pair.indexOf('=');
  const parsed = { name: pair.slice(0, separator), value: decodeURIComponent(pair.slice(separator + 1)) };
  for (const attribute of attributes) {
    const [name, raw] = attribute.split('=');
    if (name.toLowerCase() === 'httponly') parsed.httpOnly = true;
    else if (name.toLowerCase() === 'secure') parsed.secure = true;
    else if (name.toLowerCase() === 'samesite') parsed.sameSite = raw.toLowerCase();
    else if (name.toLowerCase() === 'path') parsed.path = raw;
    else if (name.toLowerCase() === 'domain') parsed.domain = raw;
  }
  return parsed;
}
async function body(response) { return response.status === 204 ? undefined : response.json(); }

test('M2 auth, RBAC, ownership, refresh lifecycle, seed and audit work against real PostgreSQL', async (t) => {
  const created = await createApplication(env, { quiet: true, log: (entry) => { if (entry.status === 500) console.log(JSON.stringify(entry)); }, database: { check: async () => ({ database: { status: 'UP', code: 'OK' }, vector: { status: 'UP', code: 'OK' } }), close: async () => {} } });
  await created.app.listen(0, '127.0.0.1');
  const baseUrl = await created.app.getUrl();
  t.after(async () => { await created.app.close(); await created.database.close(); await created.prisma.$disconnect(); });

  const login = (email, password = demoPassword, headers = {}) => fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST', headers: csrfHeaders({ 'Content-Type': 'application/json', ...headers }), body: JSON.stringify({ email, password }),
  });
  const refresh = (cookie) => fetch(`${baseUrl}/api/v1/auth/refresh`, { method: 'POST', headers: csrfHeaders({ Cookie: cookie }) });
  const bearer = (token) => ({ Authorization: `Bearer ${token}`, Origin: origin });

  const missingCsrf = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email: 'user@mobiflow.local', password: demoPassword }) });
  assert.equal(missingCsrf.status, 403);
  const wrongOrigin = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:9999', 'X-CSRF-Protection': '1' }, body: JSON.stringify({ email: 'user@mobiflow.local', password: demoPassword }) });
  assert.equal(wrongOrigin.status, 403);

  const userLogin = await login('  USER@MOBIFLOW.LOCAL  ');
  assert.equal(userLogin.status, 200);
  const userCookie1 = cookieFrom(userLogin);
  const parsedCookie = parseSetCookie(userCookie1);
  const firstSessionId = parsedCookie.value.split('.')[0];
  assert.equal(parsedCookie.name, 'mobiflow_refresh');
  assert.equal(parsedCookie.httpOnly, true); assert.equal(parsedCookie.sameSite, 'lax');
  assert.equal(parsedCookie.path, '/api/v1/auth'); assert.equal(parsedCookie.secure, undefined); assert.equal(parsedCookie.domain, undefined);
  const userBody = await body(userLogin);
  assert.equal(userBody.data.user.role, 'USER'); assert.equal(userBody.data.expiresIn, 900);
  assert.equal('passwordHash' in userBody.data.user, false); assert.equal('refreshToken' in userBody.data, false);
  assert.ok(!JSON.stringify(userBody).includes(demoPassword));

  const managerLogin = await login('manager@mobiflow.local');
  assert.equal(managerLogin.status, 200);
  const managerBody = await body(managerLogin);
  assert.equal(managerBody.data.user.role, 'MANAGER');
  const staffLogin = await login('staff.iot@mobiflow.local');
  assert.equal(staffLogin.status, 200); assert.equal((await body(staffLogin)).data.user.role, 'STAFF');

  const unknown = await login('unknown@mobiflow.local', 'BadPassword!');
  const incorrect = await login('user@mobiflow.local', 'BadPassword!');
  assert.equal(unknown.status, 401); assert.equal(incorrect.status, 401);
  assert.deepEqual((await body(unknown)).error, (await body(incorrect)).error);

  const userMe = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: bearer(userBody.data.accessToken) });
  assert.equal(userMe.status, 200); assert.equal((await body(userMe)).data.email, 'user@mobiflow.local');
  const noToken = await fetch(`${baseUrl}/api/v1/auth/me`);
  assert.equal(noToken.status, 401);
  const invalidToken = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: bearer('not-a-valid-token') });
  assert.equal(invalidToken.status, 401);
  const expiredToken = await new SignJWT({ sid: firstSessionId, role: 'USER' }).setProtectedHeader({ alg: 'HS256' }).setSubject(userBody.data.user.id).setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).setExpirationTime(Math.floor(Date.now() / 1000) - 1).sign(new TextEncoder().encode(env.JWT_SECRET));
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/me`, { headers: bearer(expiredToken) })).status, 401);
  const deniedDirectory = await fetch(`${baseUrl}/api/v1/users/staff`, { headers: bearer(userBody.data.accessToken) });
  assert.equal(deniedDirectory.status, 403);
  const directory = await fetch(`${baseUrl}/api/v1/users/staff`, { headers: bearer(managerBody.data.accessToken) });
  assert.equal(directory.status, 200); const directoryBody = await body(directory);
  assert.equal(directoryBody.data.length, 4); assert.ok(directoryBody.data.every((entry) => !('passwordHash' in entry)));

  const originalSession = await created.prisma.refreshSession.findUniqueOrThrow({ where: { id: firstSessionId } });
  const rotated = await refresh(userCookie1);
  assert.equal(rotated.status, 200);
  const userCookie2 = cookieFrom(rotated);
  const secondSessionId = parseSetCookie(userCookie2).value.split('.')[0];
  assert.notEqual(secondSessionId, firstSessionId);
  const replacement = await created.prisma.refreshSession.findUniqueOrThrow({ where: { id: secondSessionId } });
  assert.equal(replacement.expiresAt.toISOString(), originalSession.expiresAt.toISOString());
  assert.equal((await created.prisma.refreshSession.findUniqueOrThrow({ where: { id: firstSessionId } })).consumedAt instanceof Date, true);
  const replay = await refresh(userCookie1);
  assert.equal(replay.status, 401); assert.equal((await body(replay)).error.code, 'REFRESH_REPLAY');
  assert.match(cookieFrom(replay), /Max-Age=0/);
  assert.equal((await refresh(userCookie2)).status, 401);

  const concurrentLogin = await login('staff.billing@mobiflow.local');
  const concurrentCookie = cookieFrom(concurrentLogin);
  const concurrentResults = await Promise.all([refresh(concurrentCookie), refresh(concurrentCookie)]);
  assert.deepEqual(concurrentResults.map(({ status }) => status).sort(), [200, 401]);
  const concurrentWinnerCookie = cookieFrom(concurrentResults.find(({ status }) => status === 200));
  assert.equal((await refresh(concurrentWinnerCookie)).status, 401);

  const logoutLogin = await login('staff.support@mobiflow.local');
  const logoutBody = await body(logoutLogin); const logoutCookie = cookieFrom(logoutLogin);
  const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: csrfHeaders({ Cookie: logoutCookie }) });
  assert.equal(logout.status, 204); assert.match(cookieFrom(logout), /Max-Age=0/);
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/me`, { headers: bearer(logoutBody.data.accessToken) })).status, 401);
  assert.equal((await refresh(logoutCookie)).status, 401);
  const repeatLogout = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: csrfHeaders({ Cookie: logoutCookie }) });
  assert.equal(repeatLogout.status, 204);

  const invalidRefresh = await refresh('mobiflow_refresh=11111111-1111-4111-8111-111111111111.invalid');
  assert.equal(invalidRefresh.status, 401); assert.match(cookieFrom(invalidRefresh), /Max-Age=0/);

  const expiredLogin = await login('staff.network@mobiflow.local');
  const expiredCookie = cookieFrom(expiredLogin); const expiredId = parseSetCookie(expiredCookie).value.split('.')[0];
  await created.prisma.refreshSession.update({ where: { id: expiredId }, data: { createdAt: new Date(Date.now() - 172_800_000), expiresAt: new Date(Date.now() - 86_400_000) } });
  assert.equal((await refresh(expiredCookie)).status, 401);

  const inactiveId = '10000000-0000-4000-8000-000000000099';
  const inactiveHash = await hash('InactiveDemo!2026', { type: argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  await created.prisma.user.create({ data: { id: inactiveId, email: 'inactive@mobiflow.local', displayName: 'Inactive Test User', role: 'USER', active: false, passwordHash: inactiveHash } });
  const inactiveLogin = await login('inactive@mobiflow.local', 'InactiveDemo!2026');
  assert.equal(inactiveLogin.status, 401);

  const activeThenDisabledId = '10000000-0000-4000-8000-000000000098';
  await created.prisma.user.create({ data: { id: activeThenDisabledId, email: 'disabled-after-login@mobiflow.local', displayName: 'Disabled Session User', role: 'USER', active: true, passwordHash: inactiveHash } });
  const activeLogin = await login('disabled-after-login@mobiflow.local', 'InactiveDemo!2026');
  const activeBody = await body(activeLogin); const activeCookie = cookieFrom(activeLogin);
  await created.prisma.user.update({ where: { id: activeThenDisabledId }, data: { active: false } });
  assert.equal((await fetch(`${baseUrl}/api/v1/auth/me`, { headers: bearer(activeBody.data.accessToken) })).status, 401);
  assert.equal((await refresh(activeCookie)).status, 401);

  const userBId = '10000000-0000-4000-8000-000000000097';
  await created.prisma.user.create({ data: { id: userBId, email: 'owner-b@test.local', displayName: 'Owner B', role: 'USER', passwordHash: inactiveHash } });
  const requestA = await created.prisma.request.create({ data: { publicCode: 'MF-2026-900001', createdById: '10000000-0000-4000-8000-000000000001', title: 'Owner A request', description: 'Synthetic ownership boundary request A' } });
  const requestB = await created.prisma.request.create({ data: { publicCode: 'MF-2026-900002', createdById: userBId, title: 'Owner B request', description: 'Synthetic ownership boundary request B' } });
  const policy = created.app.get(AuthorizationPolicyService);
  const ownerA = { ...userBody.data.user, sessionId: firstSessionId };
  const unassignedStaff = { ...(await created.prisma.user.findUniqueOrThrow({ where: { email: 'staff.billing@mobiflow.local' }, select: { id: true, email: true, displayName: true, role: true, active: true, available: true } })), sessionId: 'test' };
  const manager = { ...managerBody.data.user, sessionId: 'test' };
  assert.equal((await created.prisma.request.findFirst({ where: { id: requestA.id, ...policy.requestScope(ownerA) } }))?.id, requestA.id);
  assert.equal(await created.prisma.request.findFirst({ where: { id: requestB.id, ...policy.requestScope(ownerA) } }), null);
  assert.equal(await created.prisma.request.findFirst({ where: { id: requestA.id, ...policy.requestScope(unassignedStaff) } }), null);
  assert.equal((await created.prisma.request.findFirst({ where: { id: requestB.id, ...policy.requestScope(manager) } }))?.id, requestB.id);

  const seeded = {
    users: await created.prisma.user.count({ where: { id: { in: ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006'] } } }),
    teams: await created.prisma.team.count(), skills: await created.prisma.skill.count(), policies: await created.prisma.slaPolicy.findMany({ where: { category: null, active: true }, orderBy: { targetMinutes: 'desc' }, select: { priority: true, targetMinutes: true } }),
  };
  assert.equal(seeded.users, 6); assert.equal(seeded.teams, 4); assert.equal(seeded.skills, 5);
  assert.deepEqual(Object.fromEntries(seeded.policies.map((row) => [row.priority, row.targetMinutes])), { LOW: 480, MEDIUM: 240, HIGH: 120, URGENT: 60 });
  const seededHashes = await created.prisma.user.findMany({ where: { id: { in: ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006'] } }, select: { passwordHash: true } });
  assert.equal(new Set(seededHashes.map(({ passwordHash }) => passwordHash)).size, 6);
  assert.ok(seededHashes.every(({ passwordHash }) => passwordHash.startsWith('$argon2id$v=19$') && !needsRehash(passwordHash, { memoryCost: 65_536, timeCost: 3, parallelism: 1 })));

  const auditActions = await created.prisma.auditLog.findMany({ select: { action: true, safeBeforeJson: true, safeAfterJson: true } });
  const actions = new Set(auditActions.map(({ action }) => action));
  for (const expected of ['AUTH_LOGIN_SUCCEEDED', 'AUTH_LOGIN_DENIED', 'AUTH_REFRESH_ROTATED', 'AUTH_REFRESH_REPLAY_REVOKED', 'AUTH_REFRESH_INVALID_DENIED', 'AUTH_REFRESH_EXPIRED_REVOKED', 'AUTH_REFRESH_INACTIVE_REVOKED', 'AUTH_LOGOUT_REVOKED']) assert.ok(actions.has(expected));
  assert.ok(!JSON.stringify(auditActions).includes(demoPassword));
  const openapi = await (await fetch(`${baseUrl}/api/docs-json`)).json();
  assert.ok(openapi.paths['/api/v1/auth/login']); assert.ok(!JSON.stringify(openapi).includes('passwordHash'));
});
