import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./apps/web/e2e',testMatch:'release-readiness-m16.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:600000,
  reporter:[['list'],['json',{outputFile:'artifacts/m16/browser-results.json'}]],outputDir:'artifacts/m16/browser',
  use:{baseURL:process.env.WEB_ORIGIN,browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},actionTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure'},
});
