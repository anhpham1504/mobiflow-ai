import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) throw new Error('.env already exists; refusing to overwrite local configuration.');
const origin = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const requested = process.argv[2];
let llm = 'unconfigured';
let embedding = 'unconfigured';
try {
  const response = await fetch(`${origin}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('tags failed');
  const { models } = await response.json();
  for (const model of models) {
    const show = await fetch(`${origin}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model.name }), signal: AbortSignal.timeout(5000) });
    const details = await show.json();
    if (model.name === requested && details.capabilities?.includes('completion')) llm = model.name;
    if (details.capabilities?.includes('embedding') && embedding === 'unconfigured') embedding = model.name;
  }
} catch { console.warn('Ollama could not be inspected; missing models remain explicitly unconfigured.'); }
if (requested && llm !== requested) throw new Error('Requested LLM is not a verified installed completion model; .env was not written.');
const ownerPassword = randomBytes(24).toString('hex');
const appPassword = randomBytes(24).toString('hex');
const content = [
  'NODE_ENV=development', 'API_HOST=127.0.0.1', 'API_PORT=3001', 'WEB_ORIGIN=http://localhost:3000',
  'NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1',
  `POSTGRES_PASSWORD=${ownerPassword}`, `POSTGRES_APP_PASSWORD=${appPassword}`,
  `DATABASE_URL=postgresql://mobiflow_app:${appPassword}@localhost:5432/mobiflow`,
  `MIGRATION_DATABASE_URL=postgresql://mobiflow_owner:${ownerPassword}@localhost:5432/mobiflow`,
  `JWT_SECRET=${randomBytes(32).toString('hex')}`, `REFRESH_TOKEN_SECRET=${randomBytes(32).toString('hex')}`,
  'AI_PROVIDER=ollama', `OLLAMA_BASE_URL=${origin}`, `OLLAMA_MODEL=${llm}`, `OLLAMA_EMBEDDING_MODEL=${embedding}`, 'HEALTH_TIMEOUT_MS=2000', '',
].join('\n');
writeFileSync('.env', content, { flag: 'wx', mode: 0o600 });
console.log(`Created ignored .env with generated local secrets. LLM: ${llm}; embedding: ${embedding}. No models downloaded.`);
