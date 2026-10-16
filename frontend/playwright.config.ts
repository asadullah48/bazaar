import { defineConfig } from '@playwright/test';
const demoPort = process.env.DEMO_API_PORT || '8000';
export default defineConfig({
 testDir:'./tests',workers:1,
 use:{baseURL:process.env.STOREFRONT_URL||'http://localhost:3000',headless:true},
 reporter:[['list'],['json',{outputFile:'../docs/storefront/playwright-after.json'}]],
 webServer: process.env.STOREFRONT_URL ? undefined : [
  {command:'node scripts/demo-api.cjs',url:`http://127.0.0.1:${demoPort}/v1/products`,reuseExistingServer:false},
  {command:'npm run start',url:'http://localhost:3000/en',reuseExistingServer:false,timeout:120000},
 ],
});
