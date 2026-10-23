import { z } from 'zod';

const httpUrl = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
}, 'Expected an HTTP origin without credentials, query or path');
const secret = z.string().min(32).refine((value) => !/change[_-]?me|placeholder|example|demo.?secret|test.?secret/i.test(value), 'Replace placeholder');
const model = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.:/-]+$/);
const explicitBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');
const usdRate = z.coerce.number().finite().nonnegative().max(100);

const apiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: httpUrl.default('http://localhost:3000'),
  DATABASE_URL: z.url().refine((value) => URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol), 'Expected PostgreSQL URL'),
  JWT_SECRET: secret, REFRESH_TOKEN_SECRET: secret,
  JWT_ISSUER: z.string().min(1).max(100).default('mobiflow-ai'),
  JWT_AUDIENCE: z.string().min(1).max(100).default('mobiflow-web'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_SESSION_TTL_SECONDS: z.coerce.number().int().min(3600).max(604800).default(604800),
  AUTH_COOKIE_SECURE: explicitBoolean.default(false),
  AI_GENERATION_PROVIDER: z.enum(['deepseek','ollama']).default('deepseek'),
  // Kept only as an explicit migration guard. Runtime code uses
  // AI_GENERATION_PROVIDER so two independent provider switches cannot drift.
  AI_PROVIDER: z.enum(['deepseek','ollama']).optional(),
  RAG_RETRIEVAL_MODE: z.enum(['lexical','vector']).default('lexical'),
  AI_LIVE_CALLS_ENABLED: explicitBoolean.default(false),
  AI_AUTO_ANALYZE: explicitBoolean.default(true),
  AI_RAG_ENABLED: explicitBoolean.default(false),
  EMBEDDING_PROVIDER: z.literal('ollama').default('ollama'),
  EMBEDDING_BASE_URL: httpUrl.optional(),
  EMBEDDING_DIMENSION: z.coerce.number().int().min(1).max(2000).optional(),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(16).default(16),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(30000),
  EMBEDDING_INDEX_REVISION: z.string().regex(/^[a-zA-Z0-9_.-]{1,40}$/).default('m5.v1'),
  KNOWLEDGE_STORAGE_ROOT: z.string().min(1).default('storage/knowledge'),
  KNOWLEDGE_JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(600000),
  RAG_TOP_K: z.coerce.number().int().min(1).max(5).default(5),
  RAG_MAX_DISTANCE: z.coerce.number().min(0).max(2).default(0.50),
  RAG_CONTEXT_CHARS: z.coerce.number().int().min(1200).max(6000).default(6000),
  AI_ATTEMPT_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(120000),
  AI_RUN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(300000),
  AI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(4096).default(1200),
  DEEPSEEK_BASE_URL: httpUrl.default('https://api.deepseek.com/'),
  DEEPSEEK_MODEL: model.default('deepseek-flash'),
  DEEPSEEK_API_KEY: z.preprocess(value=>value===''?undefined:value,z.string().min(20).max(500).regex(/^\S+$/).optional()),
  DEEPSEEK_BUDGET_USD: z.coerce.number().positive().max(0.25).default(0.25),
  DEEPSEEK_MAX_CALLS_PER_PROCESS: z.coerce.number().int().min(1).max(20).default(3),
  DEEPSEEK_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(10).default(2),
  DEEPSEEK_MAX_CONCURRENT_REQUESTS: z.coerce.number().int().min(1).max(1).default(1),
  DEEPSEEK_PRICE_CACHE_HIT_INPUT_PER_MILLION_USD: usdRate.default(0.006),
  DEEPSEEK_PRICE_CACHE_MISS_INPUT_PER_MILLION_USD: usdRate.default(0.30),
  DEEPSEEK_PRICE_OUTPUT_PER_MILLION_USD: usdRate.default(1.20),
  DEEPSEEK_PRICING_EFFECTIVE_DATE: z.iso.date().default('2026-10-23'),
  OLLAMA_BASE_URL: httpUrl.default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: model.default('qwen2.5:7b-instruct'), OLLAMA_EMBEDDING_MODEL: model.default('bge-m3:latest'),
  HEALTH_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
  SLA_ALERT_ENABLED: explicitBoolean.default(true),
  SLA_ALERT_EARLY_RATIO: z.coerce.number().gt(0).lt(0.8).default(0.5),
  SLA_ALERT_AT_RISK_ENABLED: explicitBoolean.default(true),
  SLA_ALERT_BREACH_ENABLED: explicitBoolean.default(true),
  SLA_ALERT_INTERVAL_SECONDS: z.coerce.number().int().min(30).max(3600).default(60),
  SLA_ALERT_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(100),
  SLA_ALERT_TIME_BUDGET_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
}).superRefine((env,context)=>{
  if(env.JWT_SECRET===env.REFRESH_TOKEN_SECRET)context.addIssue({code:'custom',path:['REFRESH_TOKEN_SECRET'],message:'Secrets must be distinct'});
  if(env.NODE_ENV==='production')for(const key of ['JWT_SECRET','REFRESH_TOKEN_SECRET'] as const)if(new Set(env[key]).size<8)context.addIssue({code:'custom',path:[key],message:'Production secret lacks entropy'});
  if(env.AI_PROVIDER!==undefined&&env.AI_PROVIDER!==env.AI_GENERATION_PROVIDER)context.addIssue({code:'custom',path:['AI_PROVIDER'],message:'Legacy provider guard must match AI_GENERATION_PROVIDER'});
  if(env.AI_GENERATION_PROVIDER==='deepseek'&&env.RAG_RETRIEVAL_MODE!=='lexical')context.addIssue({code:'custom',path:['RAG_RETRIEVAL_MODE'],message:'DeepSeek profile requires lexical retrieval'});
  if(env.AI_GENERATION_PROVIDER==='ollama'&&env.RAG_RETRIEVAL_MODE!=='vector')context.addIssue({code:'custom',path:['RAG_RETRIEVAL_MODE'],message:'Ollama rollback profile requires vector retrieval'});
  if(env.AI_LIVE_CALLS_ENABLED&&env.AI_GENERATION_PROVIDER==='deepseek'&&!env.DEEPSEEK_API_KEY)context.addIssue({code:'custom',path:['DEEPSEEK_API_KEY'],message:'Required when DeepSeek live calls are enabled'});
  if(env.AI_GENERATION_PROVIDER==='deepseek'){
    const endpoint=new URL(env.DEEPSEEK_BASE_URL);
    const official=endpoint.protocol==='https:'&&endpoint.hostname==='api.deepseek.com'&&endpoint.port===''&&endpoint.pathname==='/';
    const testLoopback=env.NODE_ENV==='test'&&endpoint.protocol==='http:'&&['127.0.0.1','localhost'].includes(endpoint.hostname);
    if(!official&&!testLoopback)context.addIssue({code:'custom',path:['DEEPSEEK_BASE_URL'],message:'Only the official DeepSeek origin is allowed outside tests'});
  }
})
  .refine((env) => env.AUTH_COOKIE_SECURE || !URL.canParse(env.WEB_ORIGIN) || (() => {
    const origin = new URL(env.WEB_ORIGIN);
    return origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
  })(), { path: ['AUTH_COOKIE_SECURE'], message: 'Insecure auth cookies are limited to the explicit loopback HTTP demo' });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export function parseApiEnvironment(input: Record<string, unknown>): ApiEnvironment {
  const result = apiEnvironmentSchema.safeParse(input);
  if (!result.success) {
    // Never include supplied values or Zod's input diagnostics in startup logs.
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'environment'))];
    throw new Error(`Invalid environment keys: ${keys.join(', ')}`);
  }
  return result.data;
}
