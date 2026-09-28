import { parseApiEnvironment } from '@mobiflow/config';
import { createApplication } from './app.js';

async function main() {
  const env = parseApiEnvironment(process.env);
  const { app, database } = await createApplication(env);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close().then(() => database.close()).finally(() => process.exit(0)); });
  await app.listen(env.API_PORT, env.API_HOST);
}
main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'startup.failed', message: error instanceof Error && error.message.startsWith('Invalid environment keys:') ? error.message : 'API startup failed; check local configuration.' }));
  process.exitCode = 1;
});
