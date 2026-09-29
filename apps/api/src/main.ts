import { parseApiEnvironment } from '@mobiflow/config';
import { createApplication } from './app.js';

async function main() {
  const env = parseApiEnvironment(process.env);
  const { app, database, prisma } = await createApplication(env);
  let shuttingDown=false;
  const shutdown=async(signal:'SIGINT'|'SIGTERM')=>{
    if(shuttingDown){console.error(JSON.stringify({event:'shutdown.forced',signal}));process.exit(1);}
    shuttingDown=true;console.log(JSON.stringify({event:'shutdown.started',signal}));
    const deadline=setTimeout(()=>{console.error(JSON.stringify({event:'shutdown.timeout'}));process.exit(1);},15000);deadline.unref();
    try{await app.close();await Promise.all([database.close(),prisma.$disconnect()]);clearTimeout(deadline);console.log(JSON.stringify({event:'shutdown.complete'}));process.exit(0);}
    catch{clearTimeout(deadline);console.error(JSON.stringify({event:'shutdown.failed'}));process.exit(1);}
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal,()=>{void shutdown(signal);});
  await app.listen(env.API_PORT, env.API_HOST);
}
main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: 'startup.failed', message: error instanceof Error && error.message.startsWith('Invalid environment keys:') ? error.message : 'API startup failed; check local configuration.' }));
  process.exitCode = 1;
});
