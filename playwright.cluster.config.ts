import { defineConfig, devices } from '@playwright/test';

/**
 * Cluster smoke-test config (Story 0.11).
 *
 * Targets the live k3d deployment via Traefik ingress on `http://njord.localhost`.
 * No webServer — assumes the cluster is already bootstrapped and the four
 * apps (postgres, backend, frontend, platform) are Synced+Healthy in ArgoCD.
 *
 * Override the base URL via `PLAYWRIGHT_BASE_URL` env var.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://njord.localhost';

export default defineConfig({
  testDir: './e2e-cluster',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
