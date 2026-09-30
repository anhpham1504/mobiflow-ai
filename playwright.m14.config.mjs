import {defineConfig} from '@playwright/test';
const runDirectory='artifacts/m14/browser-runs/'+(process.env.M14_BROWSER_RUN_ID??'unmanaged');
export default defineConfig({
  testDir:'./apps/web/e2e',testMatch:'recommendation-v2.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:180000,
  reporter:[['list'],['json',{outputFile:runDirectory+'/browser-results.json'}]],outputDir:runDirectory+'/results',
  use:{baseURL:'http://localhost:3000',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},actionTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure'},
});
