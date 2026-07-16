import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env['LEVELHABIT_BASE_URL'] ??
  'https://nicolasfrechette91.github.io/LevelHabit/';

export default defineConfig({
  testDir: './e2e/production',
  outputDir: './test-results/production-audit/artifacts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/production-audit', open: 'never' }],
    ['json', { outputFile: 'test-results/production-audit/results.json' }]
  ],
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'off',
    // Production credentials and bearer tokens must not be persisted in traces/videos.
    trace: 'off',
    video: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
