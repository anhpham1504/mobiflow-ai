import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./apps/web/e2e',testMatch:'m10.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:120000,
  reporter:[['list'],['json',{outputFile:'artifacts/m10/browser-results.json'}]],outputDir:'artifacts/m10/browser',
  use:{baseURL:process.env.MOBIFLOW_WEB_BASE_URL??'http://localhost:3000',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'retain-on-failure'},
});
