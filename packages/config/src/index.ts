import { z } from 'zod';

const httpUrl = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
}, 'Expected an HTTP origin without credentials, query or path');
const secret = z.string().min(32).refine((value) => !value.includes('CHANGE_ME'), 'Replace placeholder');
const model = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.:/-]+$/);

const apiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: httpUrl.default('http://localhost:3000'),
  DATABASE_URL: z.url().refine((value) => URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol), 'Expected PostgreSQL URL'),
  JWT_SECRET: secret, REFRESH_TOKEN_SECRET: secret,
  AI_PROVIDER: z.literal('ollama').default('ollama'),
  OLLAMA_BASE_URL: httpUrl,
  OLLAMA_MODEL: model, OLLAMA_EMBEDDING_MODEL: model,
  HEALTH_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
}).refine((env) => env.JWT_SECRET !== env.REFRESH_TOKEN_SECRET, { path: ['REFRESH_TOKEN_SECRET'], message: 'Secrets must be distinct' });

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
