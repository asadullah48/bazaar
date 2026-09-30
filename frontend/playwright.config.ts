import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: { command: "npm run start", url: "http://localhost:3000/en", reuseExistingServer: !process.env.CI },
});
