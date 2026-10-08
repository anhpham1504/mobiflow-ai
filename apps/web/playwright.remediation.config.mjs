import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'ui-remediation-*.spec.mjs',
  workers: 1, retries: 0, timeout: 120000,
  reporter: [['list'], ['json', { outputFile: '../../artifacts/ui-remediation/browser-results.json' }]],
  outputDir: '../../artifacts/ui-remediation',
  use: { baseURL: 'http://localhost:33700', browserName: 'chromium', headless: true, screenshot: 'only-on-failure' },
});
