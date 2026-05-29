import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Mobile App.
 *
 * Runs against Ionic app served at http://localhost:8100.
 * Auth is injected via localStorage (JWT bypass) using the shared fixture.
 * API calls to 192.168.1.176:3000 are intercepted and redirected to localhost:3000.
 *
 * Run:
 *   npx playwright test --config=playwright.config.ts
 */
export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e-results',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'e2e-report', open: 'never' }],
    ['json', { outputFile: 'e2e-report/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:8100',
    headless: !!process.env['CI'],
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // iPhone 14 Pro viewport — matches the mobile-app target device
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  },

  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        // Use system Google Chrome if available (fallback for servers where
        // Playwright's bundled Chromium can't be installed, e.g. Ubuntu 26.04)
        executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] || undefined,
      },
    },
  ],

  // In CI the dev server is started by the workflow — skip webServer to avoid conflicts.
  // Locally: run `npx ng serve --port 8100` first, then `npm run e2e`.
  webServer: process.env['CI'] ? undefined : {
    command: 'npx ng serve --port 8100',
    url: 'http://localhost:8100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
