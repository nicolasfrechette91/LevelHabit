import { defineConfig, devices } from '@playwright/test';

const appBaseUrl = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  testIgnore: './production/**',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  use: {
    baseURL: appBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'firefox',
      testMatch: 'qa-regressions.spec.ts',
      use: {
        ...devices['Desktop Firefox']
      }
    },
    {
      name: 'webkit',
      testMatch: 'qa-regressions.spec.ts',
      use: {
        ...devices['Desktop Safari']
      }
    }
  ],
  ...(process.env['E2E_SKIP_WEB_SERVER'] === '1'
    ? {}
    : {
        webServer: {
          command: 'ng serve --host localhost --port 4200',
          url: appBaseUrl,
          reuseExistingServer: !process.env['CI'],
          timeout: 120_000
        }
      })
});
