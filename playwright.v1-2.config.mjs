import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./apps/web/e2e',testMatch:'dashboard-sla-v1-2.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:180000,
  reporter:[['list'],['json',{outputFile:'artifacts/v1-2/browser-results.json'}]],outputDir:'artifacts/v1-2/browser',
  use:{baseURL:process.env.MOBIFLOW_WEB_BASE_URL??'http://localhost:3000',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'retain-on-failure'},
});
