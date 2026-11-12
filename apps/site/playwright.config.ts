import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

// A Chromium installed outside Playwright can be used instead of
// downloading one: PLAYWRIGHT_CHROMIUM=/path/to/chromium.
const executablePath = process.env['PLAYWRIGHT_CHROMIUM'];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  // The production build, served as a static host would serve it.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env['CI'],
  },
});
