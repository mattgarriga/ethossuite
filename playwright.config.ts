import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// .env.local is optional: without it the DB-backed specs skip themselves.
const envFile = path.resolve(__dirname, ".env.local");
if (existsSync(envFile)) dotenv.config({ path: envFile });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Without Supabase env the app's proxy 500s on every request, so the server can never
  // become ready; every spec skips in that case, so don't start it at all.
  webServer: !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ? undefined
    : {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...(process.env as Record<string, string>), AI_MODE: "mock" },
  },
});
