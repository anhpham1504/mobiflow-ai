import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
if (!existsSync('.env')) throw new Error('Run npm run env:setup first.');
process.loadEnvFile('.env');
const npm = process.env.npm_execpath;
for (const args of [['run', 'build:foundation'], ['run', 'build', '-w', '@mobiflow/api']]) {
  const result = spawnSync(process.execPath, [npm, ...args], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const children = [
  spawn(process.execPath, ['--watch', 'apps/api/dist/main.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'apps/api/tsconfig.json', '--watch', '--preserveWatchOutput'], { stdio: 'inherit' }),
  spawn(process.execPath, [npm, 'run', 'dev', '-w', '@mobiflow/web'], { stdio: 'inherit' }),
];
function stop() { for (const child of children) child.kill(); }
process.once('SIGINT', stop); process.once('SIGTERM', stop);
for (const child of children) child.once('exit', (code) => { if (code) { process.exitCode = code; stop(); } });
