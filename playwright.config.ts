import { defineConfig, devices } from "@playwright/test";

/**
 * Not yet run in this sandbox (no network access to install browsers or
 * start the dev server — see DECISIONS.md's first entry). `webServer`
 * below starts apps/web itself via `pnpm dev:web`, so `pnpm test:e2e`
 * should work standalone once dependencies are installed and .env is
 * filled in; it still needs Postgres/Redis/MinIO up (infra/docker-compose.yml)
 * since apps/web's own startup depends on them.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev:web",
    url: process.env.APP_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
