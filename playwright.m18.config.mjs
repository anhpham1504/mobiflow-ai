import { defineConfig } from '@playwright/test';
const runDirectory = 'artifacts/m18/browser-runs/' + (process.env.M18_BROWSER_RUN_ID ?? 'unmanaged');
export default defineConfig({
  testDir: './apps/web/e2e', testMatch: 'internal-notes.spec.mjs', fullyParallel: false, workers: 1, retries: 0, timeout: 120000,
  reporter: [['list'], ['json', { outputFile: runDirectory + '/browser-results.json' }]], outputDir: runDirectory + '/results',
  use: { baseURL: 'http://localhost:3000', browserName: 'chromium', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh', actionTimeout: 15000, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
