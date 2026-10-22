import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseApiEnvironment } from '@mobiflow/config';
import { requestResponseSchema } from '@mobiflow/contracts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { createApplication } from '../../dist/app.js';
import { AuthService } from '../../dist/auth/auth.service.js';
import { RequestStateMachineService } from '../../dist/requests/request-state-machine.service.js';
import { AiFailure } from '../../dist/ai/provider.js';
import { syntheticAnalysis, syntheticEmbeddings, recommendationFixture } from './recommendation-v2-fixture.mjs';

export const m19AiContextSopText = '# Synthetic M19 SOP\nÁp dụng cho SIM IoT bị mất kết nối. Kiểm tra SIM và cấu hình APN, ghi lại kết quả để quản lý xem xét. Dữ liệu synthetic dùng kiểm tra context.';
export function m19RecommendationFixture(messages) {
  const { evidence, evidenceDecision } = JSON.parse(messages[1].content);
  return recommendationFixture(evidence, undefined, evidenceDecision);
}

export async function createMentionsWatchersHarness(databaseUrl, { port = 33019, webOrigin = 'http://localhost:3000' } = {}) {
  const target = new URL(databaseUrl);
  if (target.pathname !== '/mobiflow_m19_test' || !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Dedicated loopback M19 test target required');
  const logs = [], queries = [], captured = { intake: [], structured: [], embedding: [] };
  let failRecommendationProvider = false;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }), log: [{ level: 'query', emit: 'event' }] });
  prisma.$on('query', event => queries.push({ sql: event.query, durationMs: event.duration }));
  const generation = value => { const raw = JSON.stringify(value); return { raw, outputSize: Buffer.byteLength(raw), identity: { provider: 'test', model: 'm19-context-fixture', digest: 'deterministic-synthetic' } }; };
  const aiProvider = { generate: async input => { captured.intake.push(input); return generation(syntheticAnalysis); } };
  const recommendationProvider = { generateStructured: async messages => {
    captured.structured.push(messages);
    if (messages[0].content.includes('Action=SUMMARIZE_REQUEST')) return generation({ summary: 'Tóm tắt dữ kiện synthetic công khai của yêu cầu.', eventIds: [] });
    if (failRecommendationProvider) throw new AiFailure('AI_PROVIDER_UNAVAILABLE', true);
    return generation(m19RecommendationFixture(messages));
  } };
  const embeddingProvider = { ...syntheticEmbeddings, embedQuery: async (...args) => { captured.embedding.push(args[0]); return syntheticEmbeddings.embedQuery(...args); } };
  const env = parseApiEnvironment({ ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl, WEB_ORIGIN: webOrigin, AI_AUTO_ANALYZE: 'false', AI_RAG_ENABLED: 'false', OLLAMA_BASE_URL: 'http://127.0.0.1:9', KNOWLEDGE_STORAGE_ROOT: 'artifacts/m19/knowledge-storage' });
  const s = await createApplication(env, { prisma, quiet: true, log: entry => logs.push(entry), aiWorker: false, knowledgeWorker: false, aiProvider, recommendationProvider, embeddingProvider });
  try {
    await s.app.listen(port, '127.0.0.1'); const base = await s.app.getUrl();
    const call = async (token, path, body, method = body === undefined ? 'GET' : 'POST', headers = {}) => {
      const began = performance.now();
      const response = await fetch(base + '/api/v1' + path, { method, signal: AbortSignal.timeout(15000), headers: { Connection: 'close', Origin: env.WEB_ORIGIN, 'X-CSRF-Protection': '1', 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers, latencyMs: performance.now() - began };
    };
    const auth = s.app.get(AuthService);
    const login = async email => {
      const response = await call(null, '/auth/login', { email, password: 'MobiFlowDemo!2026' });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return { token: response.body.data.accessToken, actor: await auth.authenticateAccessToken('Bearer ' + response.body.data.accessToken) };
    };
    const [user, staff, manager, otherStaff] = await Promise.all(['user', 'staff.iot', 'manager', 'staff.network'].map(name => login(name + '@mobiflow.local')));
    const command = async (actor, path, body, status = 200) => { const response = await call(actor.token, path, body); assert.equal(response.status, status, JSON.stringify(response.body)); if (response.body.data?.publicCode) requestResponseSchema.parse(response.body); return response.body.data; };
    const create = (name = randomUUID()) => command(user, '/requests', { title: 'Synthetic M19 ' + name, description: '17 SIM IoT tại Amata mất kết nối từ 8 giờ. Synthetic M19 ' + name + '.' }, 201);
    const decision = { category: 'NETWORK', subcategory: 'IOT_CONNECTIVITY', priority: 'HIGH', teamId: '20000000-0000-4000-8000-000000000001', staffId: staff.actor.id, actions: [], acknowledgedMissingFields: [], reason: 'Phương án synthetic do quản lý xác nhận; không có checklist bắt buộc.' };
    const assign = async request => {
      let row = await command(manager, '/manager/requests/' + request.id + '/triage', { expectedVersion: request.version, finalDecision: decision });
      row = await command(manager, '/manager/requests/' + row.id + '/submit-approval', { expectedVersion: row.version, manualDraftRevision: row.manualDraftRevision });
      return command(manager, '/manager/approvals/' + row.id + '/accept', { expectedVersion: row.version, reviewKind: 'MANUAL', manualDraftRevision: row.pendingDraftRevision, acknowledgedMissingFields: [] });
    };
    let closed = false;
    const close = async () => { if (closed) return; closed = true; await s.app.close(); await prisma.$disconnect(); await s.database.close(); };
    const setRecommendationProviderFailure = value => { failRecommendationProvider = value === true; };
    return { ...s, env, base, logs, queries, captured, call, login, command, create, assign, decision, user, staff, manager, otherStaff, machine: s.app.get(RequestStateMachineService), setRecommendationProviderFailure, close };
  } catch (error) { await s.app.close(); await prisma.$disconnect(); await s.database.close(); throw error; }
}

export async function workflowSnapshot(prisma, requestId) {
  const snapshot = { request: await prisma.request.findUniqueOrThrow({ where: { id: requestId } }) };
  for (const table of ['assignment', 'slaInstance', 'checklist', 'requestStatusHistory', 'requestMessage', 'notification']) snapshot[table] = await prisma[table].findMany({ where: { requestId }, orderBy: { id: 'asc' } });
  return snapshot;
}
