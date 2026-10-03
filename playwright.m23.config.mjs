import {defineConfig} from '@playwright/test';
const directory='artifacts/m23/browser-runs/'+(process.env.M23_BROWSER_RUN_ID??'unmanaged');
export default defineConfig({testDir:'./apps/web/e2e',testMatch:'saved-views.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:180000,
  reporter:[['list'],['json',{outputFile:directory+'/browser-results.json'}]],outputDir:directory+'/results',
  use:{baseURL:'http://localhost:33500',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},timezoneId:'Asia/Ho_Chi_Minh',actionTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure'}});
