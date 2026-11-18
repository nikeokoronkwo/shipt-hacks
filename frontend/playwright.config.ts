import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Workers inherit this directory. Never use a developer's auth or application DB.
const testDirectory = process.env.SHELTERCONNECT_E2E_DIRECTORY ??
  mkdtempSync(path.join(tmpdir(), "shelterconnect-e2e-"));
process.env.SHELTERCONNECT_E2E_DIRECTORY = testDirectory;
process.env.SHELTERCONNECT_E2E_SMS_FILE = path.join(testDirectory, "sms.jsonl");

const databaseFile = path.join(testDirectory, "shelterconnect.sqlite3");
const environment = {
  DATABASE_FILE: databaseFile,
  DATABASE_URL: `sqlite:///${databaseFile}`,
  BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
  NEXT_PUBLIC_BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_API_URL: "http://localhost:8000",
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "",
  AUTH_JWKS_URL: "http://localhost:3000/api/auth/jwks",
  AUTH_ISSUER: "http://localhost:3000",
  AUTH_AUDIENCE: "shelterconnect-api",
  BACKEND_CORS_ORIGINS: "http://localhost:3000",
  TWILIO_ACCOUNT_SID: `AC${"0".repeat(32)}`,
  TWILIO_AUTH_TOKEN: "test-transport-only",
  TWILIO_FROM_NUMBER: "+12055550199",
  SHELTERCONNECT_E2E_SMS_FILE: process.env.SHELTERCONNECT_E2E_SMS_FILE,
  PYTHONPATH: path.resolve(__dirname, "../backend/src"),
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  globalTeardown: "./tests/support/cleanup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/support/start-frontend.mjs",
      url: "http://localhost:3000/api/auth/get-session",
      env: environment,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "uv run --directory ../backend uvicorn main:app --host 127.0.0.1 --port 8000",
      url: "http://localhost:8000/health",
      env: environment,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
