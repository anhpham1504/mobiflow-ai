import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./apps/web/e2e',testMatch:'m5.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:180000,
  reporter:[['list'],['json',{outputFile:'artifacts/m5/browser-results.json'}]],outputDir:'artifacts/m5/browser',
  use:{baseURL:'http://localhost:3000',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'off'},
});
