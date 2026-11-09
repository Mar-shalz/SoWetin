import { defineConfig, devices } from '@playwright/test';

const port = 3200;

// Android Chrome at the 360 px baseline (doc 02) and iPhone Safari (doc 15). Locally the Android run uses the installed Chrome.
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}` },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: `pnpm start --port ${port}`, port, reuseExistingServer: true },
});
