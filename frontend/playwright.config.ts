import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',workers:1,use:{baseURL:process.env.STOREFRONT_URL||'http://localhost:3000',headless:true},reporter:[['list'],['json',{outputFile:'../docs/storefront/playwright-after.json'}]]});
