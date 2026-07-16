import { expect, test as base, type Locator, type Page, type Request, type TestInfo } from '@playwright/test';

export const PROTECTED_ROUTES = [
  'dashboard', 'habits', 'progress', 'achievements', 'analytics'
] as const;

type AuditEvent = Readonly<{
  kind: 'console' | 'pageerror' | 'requestfailed' | 'http' | 'api';
  detail: string;
}>;

function sanitize(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/("(?:access|refresh)?token"\s*:\s*")[^"]+/gi, '$1[REDACTED]')
    .replace(/("password"\s*:\s*")[^"]+/gi, '$1[REDACTED]');
}

export const test = base.extend<{ auditEvents: AuditEvent[] }>({
  auditEvents: [async ({ page }, use, testInfo) => {
    const events: AuditEvent[] = [];
    const requestStartedAt = new WeakMap<Request, number>();
    page.on('console', (message) => {
      if (['error', 'warning', 'warn'].includes(message.type())) {
        events.push({ kind: 'console', detail: sanitize(message.text()) });
      }
    });
    page.on('pageerror', (error) => {
      events.push({ kind: 'pageerror', detail: sanitize(error.message) });
    });
    page.on('requestfailed', (request) => {
      events.push({
        kind: 'requestfailed',
        detail: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`
      });
    });
    page.on('request', (request) => requestStartedAt.set(request, Date.now()));
    page.on('response', (response) => {
      const request = response.request();
      if (response.url().startsWith('https://level-habit-api.onrender.com/api/')) {
        const url = new URL(response.url());
        const duration = Date.now() - (requestStartedAt.get(request) ?? Date.now());
        events.push({
          kind: 'api',
          detail: `${request.method()} ${url.origin}${url.pathname} ${response.status()} ${duration}ms ${response.headers()['content-type'] ?? 'no-content-type'}`
        });
      }
      if (response.status() >= 400) {
        events.push({
          kind: 'http',
          detail: `${request.method()} ${response.url()} ${response.status()}`
        });
      }
    });

    await use(events);
    await testInfo.attach('sanitized-browser-events', {
      body: Buffer.from(JSON.stringify(events, null, 2)),
      contentType: 'application/json'
    });
  }, { auto: true }]
});

export { expect } from '@playwright/test';

export function credentials(): Readonly<{ email: string; password: string }> {
  const email = process.env['LEVELHABIT_TEST_EMAIL'];
  const password = process.env['LEVELHABIT_TEST_PASSWORD'];
  if (!email || !password) {
    throw new Error('LEVELHABIT_TEST_EMAIL and LEVELHABIT_TEST_PASSWORD are required.');
  }
  return { email, password };
}

export async function warmBackend(page: Page): Promise<void> {
  await expect.poll(async () => {
    try {
      const response = await page.request.get(
        'https://level-habit-api.onrender.com/api/health',
        { timeout: 15_000 }
      );
      return response.ok();
    } catch {
      return false;
    }
  }, { intervals: [2_000, 5_000, 10_000], timeout: 90_000 }).toBe(true);
}

export class LevelHabitPage {
  constructor(readonly page: Page) {}

  async openLogin(): Promise<void> {
    await this.page.goto('./#/login');
    await expect(this.page).toHaveTitle(/Sign in \| LevelHabit/);
  }

  async login(email = credentials().email, password = credentials().password): Promise<void> {
    await this.openLogin();
    if (await this.page.getByTestId('logout-button').isVisible().catch(() => false)) {
      await this.page.getByTestId('logout-button').click();
    }
    await this.page.getByTestId('login-email-input').fill(email);
    await this.page.getByTestId('login-password-input').fill(password);
    await this.page.getByTestId('login-submit-button').click();
    await expect(this.page.getByTestId('page-dashboard')).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.page.getByTestId('logout-button').click();
    await expect(this.page.getByTestId('login-submit-button')).toBeVisible();
  }

  async openRoute(route: (typeof PROTECTED_ROUTES)[number]): Promise<void> {
    await this.page.getByTestId(`nav-${route}`).click();
    await expect(this.page.getByTestId(`page-${route}`)).toBeVisible();
  }
}

export async function attachLocatorScreenshot(
  locator: Locator,
  testInfo: TestInfo,
  name: string
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await locator.screenshot({ path, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}
