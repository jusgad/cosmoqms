import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the real app running in Docker, in demo mode:
//   DEMO_ROLE=admin docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
//   pnpm test:e2e
// Each test picks its role with the `cosmoqms-demo-role` cookie (only honored
// in demo mode, which only works on localhost). The suite runs serially: all
// roles share the single demo user, and the production flow depends on the
// order of its steps.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /navegacion\.spec\.ts/ },
  ],
});
