import { cpSync } from 'node:fs';

// Next's standalone server needs the static directory alongside its traced output.
cpSync(new URL('../.next/static/', import.meta.url), new URL('../.next/standalone/apps/web/.next/static/', import.meta.url), { recursive: true });
process.env.HOSTNAME = '127.0.0.1';
process.env.PORT ??= '3000';
await import('../.next/standalone/apps/web/server.js');
