import {defineConfig} from '@playwright/test';
const directory='artifacts/m24/browser-runs/'+process.env.M24_BROWSER_RUN_ID;
export default defineConfig({testDir:'./apps/web/e2e',testMatch:'release-hardening.spec.mjs',workers:1,fullyParallel:false,retries:0,timeout:240000,reporter:[['list'],['json',{outputFile:directory+'/results.json'}]],outputDir:directory+'/results',use:{baseURL:'http://localhost:33600',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1440,height:1000},actionTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure'}});
