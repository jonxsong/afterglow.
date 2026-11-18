import { defineConfig, devices } from "@playwright/test";

const port = process.env.AFTERGLOW_TEST_PORT || "3000";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL, trace: "on-first-retry" },
  webServer: {
    command: "pnpm --dir ../.. build:site && node ../../scripts/serve-site-worker.mjs",
    env: { PORT: port },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});

