import {defineConfig} from '@playwright/test';
const mode=process.env.M4_E2E_MODE??'online';
if(!['online','offline'].includes(mode))throw new Error('Invalid M4 browser mode');
export default defineConfig({testDir:'./apps/web/e2e',testMatch:'m4-'+mode+'.spec.mjs',fullyParallel:false,workers:1,retries:0,timeout:360000,
  reporter:[['list'],['json',{outputFile:'artifacts/m4/browser-'+mode+'.json'}]],outputDir:'artifacts/m4/browser-'+mode,
  use:{baseURL:'http://localhost:3000',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'off'},
});
