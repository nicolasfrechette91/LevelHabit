import { defineConfig, devices } from '@playwright/test';

const requiredEnvironmentVariables = [
  'LEVELHABIT_BASE_URL',
  'LEVELHABIT_TEST_EMAIL',
  'LEVELHABIT_TEST_PASSWORD'
] as const;
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]?.trim()
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Production Playwright requires: ${missingEnvironmentVariables.join(', ')}.`
  );
}

const baseURL = process.env['LEVELHABIT_BASE_URL'] as string;
const productionUrl = new URL(baseURL);

if (
  productionUrl.protocol !== 'https:'
  || productionUrl.hostname !== 'nicolasfrechette91.github.io'
  || !productionUrl.pathname.startsWith('/LevelHabit')
) {
  throw new Error(
    'LEVELHABIT_BASE_URL must target the production GitHub Pages LevelHabit URL.'
  );
}

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
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
