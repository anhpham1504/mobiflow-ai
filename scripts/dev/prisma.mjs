import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const args = process.argv.slice(2);
const childEnvironment = { ...process.env };
// Client generation parses prisma.config.ts but does not connect to a database.
if (args[0] === 'generate' && !childEnvironment.MIGRATION_DATABASE_URL) childEnvironment.MIGRATION_DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:5432/unused';
const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], { stdio: 'inherit', env: childEnvironment });
process.exitCode = result.status ?? 1;
