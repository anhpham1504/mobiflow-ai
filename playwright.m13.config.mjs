import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./apps/web/e2e',testMatch:'analytics-v2.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:180000,
  reporter:[['list'],['json',{outputFile:'artifacts/m13/browser-results.json'}]],outputDir:'artifacts/m13/browser',
  use:{baseURL:'http://localhost:3000',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},actionTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure'},
});
