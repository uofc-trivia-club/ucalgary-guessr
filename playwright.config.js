import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "node tests/start-server.js",
    url: "http://127.0.0.1:3100/api/health",
    env: { PORT: "3100", EMAIL_MODE: "console", SESSION_SECRET: "browser-test-only-secret", NODE_ENV: "test" },
    reuseExistingServer: false,
  },
});
