import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// A Chromium installed outside Playwright (e.g. a container image's) can be
// used instead of downloading one: PLAYWRIGHT_CHROMIUM=/path/to/chromium.
const executablePath = process.env['PLAYWRIGHT_CHROMIUM'];

export default defineConfig({
  testDir: './tests/e2e',
  // The embedding tests load the standalone bundle; build it first.
  globalSetup: './tests/e2e/build-bundle.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // E2E runs against the production build, not the dev server.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
