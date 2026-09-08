import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".playwright");
if (!process.env.OWNER_PASSWORD) process.loadEnvFile(".env.local");
// A dedicated port so the suite always starts its own production server and can
// never silently test a development server left running on the usual port 3000.
const port = 3100;
export const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 12000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120000,
    env: { APP_ORIGIN: origin, COOKIE_SECURE: "false" },
  },
});
