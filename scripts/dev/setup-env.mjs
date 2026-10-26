import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) throw new Error('.env already exists; refusing to overwrite local configuration.');
if(process.argv[2])throw new Error('V1.3 DeepSeek/lexical setup takes no model argument. Configure the documented rollback profile manually when needed.');
const ownerPassword = randomBytes(24).toString('hex');
const appPassword = randomBytes(24).toString('hex');
const content = [
  'NODE_ENV=development', 'API_HOST=127.0.0.1', 'API_PORT=3001', 'WEB_ORIGIN=http://localhost:3000',
  'NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1',
  `POSTGRES_PASSWORD=${ownerPassword}`, `POSTGRES_APP_PASSWORD=${appPassword}`,
  `DATABASE_URL=postgresql://mobiflow_app:${appPassword}@localhost:5432/mobiflow`,
  `MIGRATION_DATABASE_URL=postgresql://mobiflow_owner:${ownerPassword}@localhost:5432/mobiflow`,
  `JWT_SECRET=${randomBytes(32).toString('hex')}`, `REFRESH_TOKEN_SECRET=${randomBytes(32).toString('hex')}`,
  'JWT_ISSUER=mobiflow-ai', 'JWT_AUDIENCE=mobiflow-web', 'ACCESS_TOKEN_TTL_SECONDS=900', 'REFRESH_SESSION_TTL_SECONDS=604800', 'AUTH_COOKIE_SECURE=false', 'DEMO_MODE=true',
  'AI_GENERATION_PROVIDER=deepseek','RAG_RETRIEVAL_MODE=lexical','AI_LIVE_CALLS_ENABLED=false','DEEPSEEK_API_KEY=',
  'DEEPSEEK_BASE_URL=https://api.deepseek.com/','DEEPSEEK_MODEL=deepseek-flash','DEEPSEEK_BUDGET_USD=0.25','DEEPSEEK_MAX_CALLS_PER_PROCESS=3','DEEPSEEK_MAX_REQUESTS_PER_MINUTE=2','DEEPSEEK_MAX_CONCURRENT_REQUESTS=1',
  'DEEPSEEK_PRICE_CACHE_HIT_INPUT_PER_MILLION_USD=0.006','DEEPSEEK_PRICE_CACHE_MISS_INPUT_PER_MILLION_USD=0.30','DEEPSEEK_PRICE_OUTPUT_PER_MILLION_USD=1.20','DEEPSEEK_PRICING_EFFECTIVE_DATE=2026-10-23',
  'AI_RAG_ENABLED=true','HEALTH_TIMEOUT_MS=2000','',
].join('\n');
writeFileSync('.env', content, { flag: 'wx', mode: 0o600 });
console.log('Created ignored .env with generated local secrets. DeepSeek live calls remain disabled and no Ollama/model process was inspected or started.');
