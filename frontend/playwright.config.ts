import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',workers:1,
 use:{baseURL:process.env.STOREFRONT_URL||'http://localhost:3000',headless:true},
 reporter:[['list'],['json',{outputFile:'../docs/storefront/playwright-after.json'}]],
 webServer: process.env.STOREFRONT_URL ? undefined : [
  {command:'node scripts/demo-api.cjs',url:'http://127.0.0.1:8000/v1/products',reuseExistingServer:false},
  {command:'npm run start',url:'http://localhost:3000/en',reuseExistingServer:false,timeout:120000},
 ],
});
