import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const STORAGE_STATE = path.join(process.cwd(), "playwright/.auth/user.json");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "https://aura-read.lovable.app",
    trace: "retain-on-failure",
  },
  projects: [
    // 1) Setup: login uma única vez e persiste storageState.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },

    // 2) Specs públicos (sem sessão) — home, GlobalFooter, etc.
    {
      name: "chromium-public",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/auth\.setup\.ts/, /authenticated\//],
    },

    // 3) Specs autenticados — Library, Reader.
    //    Coloque seus specs autenticados em e2e/authenticated/*.spec.ts
    {
      name: "chromium-auth",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
      testMatch: /authenticated\/.*\.spec\.ts/,
    },
  ],
});
