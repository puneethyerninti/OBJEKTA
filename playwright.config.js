// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node backend/server.js",
      port: 5000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        PORT: "5000",
        JWT_SECRET: "test-jwt-secret-e2e",
        MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/objekta_e2e",
        PAYMENT_PROVIDER: "mock",
        FRONTEND_ORIGIN: "http://localhost:5173",
      },
    },
    {
      command: "npx vite --port 5173",
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
