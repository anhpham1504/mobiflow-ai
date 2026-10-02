import { defineConfig } from '@playwright/test';
const runDirectory = 'artifacts/m19/browser-runs/' + (process.env.M19_BROWSER_RUN_ID ?? 'unmanaged');
export default defineConfig({
  testDir: './apps/web/e2e', testMatch: 'mentions-watchers.spec.mjs', fullyParallel: false, workers: 1, retries: 0, timeout: 150000,
  reporter: [['list'], ['json', { outputFile: runDirectory + '/browser-results.json' }]], outputDir: runDirectory + '/results',
  use: { baseURL: 'http://localhost:33100', browserName: 'chromium', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh', actionTimeout: 15000, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
