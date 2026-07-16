import {
  expect,
  test as base,
  type Locator,
  type Page,
  type Request,
  type Response,
  type TestInfo
} from '@playwright/test';

export const PROTECTED_ROUTES = [
  'dashboard', 'habits', 'progress', 'achievements', 'analytics'
] as const;
export const PRODUCTION_API_URL = 'https://level-habit-api.onrender.com/api';
export const WEBKIT_CROSS_SITE_REFRESH_COOKIE_REASON =
  'WebKit blocks the cross-site refresh cookie between github.io and onrender.com.';
const API_RESPONSE_TIMEOUT = 45_000;
const PRODUCTION_API_ORIGIN = new URL(PRODUCTION_API_URL).origin;

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
      if (response.url().startsWith(`${PRODUCTION_API_URL}/`)) {
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

export function hasConfirmedWebKitCrossSiteCookieLimitation(
  browserName: string
): boolean {
  const frontendHostname = new URL(
    process.env['LEVELHABIT_BASE_URL']
      ?? 'https://nicolasfrechette91.github.io/LevelHabit/'
  ).hostname;
  const apiHostname = new URL(PRODUCTION_API_URL).hostname;

  return browserName === 'webkit'
    && frontendHostname.endsWith('.github.io')
    && apiHostname.endsWith('.onrender.com');
}

export function skipForWebKitCrossSiteRefreshCookie(
  browserName: string,
  reason: string
): void {
  test.skip(
    hasConfirmedWebKitCrossSiteCookieLimitation(browserName),
    `WebKit: ${reason} ${WEBKIT_CROSS_SITE_REFRESH_COOKIE_REASON} `
      + 'Remove this skip when the frontend and API are same-site or WebKit permits the cookie.'
  );
}

export function productionRouteUrl(route: string): string {
  const baseUrl = process.env['LEVELHABIT_BASE_URL'];
  if (!baseUrl) {
    throw new Error('LEVELHABIT_BASE_URL is required.');
  }

  return new URL(`./#/${route}`, baseUrl).toString();
}

export function assertPageUsable(page: Page): void {
  if (page.isClosed()) {
    throw new Error('The Playwright page is already closed.');
  }

  const browser = page.context().browser();
  if (browser && !browser.isConnected()) {
    throw new Error('The Playwright browser is disconnected.');
  }
}

export async function waitForApiResponse(
  page: Page,
  method: string,
  path: string,
  timeout = API_RESPONSE_TIMEOUT
): Promise<Response> {
  const expectedMethod = method.toUpperCase();
  const expectedPathname = normalizePathname(path);
  const response = await page.waitForResponse(
    (candidate) => isMatchingApiResponse(candidate, expectedMethod, expectedPathname),
    { timeout }
  );

  if (!response.ok()) {
    const responseBody = sanitize(
      await response.text().catch(() => '<response body unavailable>')
    ).slice(0, 1_000);
    throw new Error(
      `${expectedMethod} ${expectedPathname} returned `
        + `${response.status()} ${response.statusText()}: ${responseBody}`
    );
  }

  return response;
}

export async function waitForAppShell(
  page: Page,
  route?: (typeof PROTECTED_ROUTES)[number]
): Promise<void> {
  assertPageUsable(page);
  await expect(page.getByTestId('logout-button')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();

  if (route) {
    await expect(page).toHaveURL((url) => url.hash === `#/${route}`);
    await expect(page.getByTestId(`page-${route}`)).toBeVisible();
  }
}

export async function ensureAuthenticated(page: Page): Promise<boolean> {
  assertPageUsable(page);
  const logoutButton = page.getByTestId('logout-button');
  const loginButton = page.getByTestId('login-submit-button');

  if (await logoutButton.isVisible().catch(() => false)) {
    await waitForAppShell(page);
    return false;
  }

  await expect(logoutButton.or(loginButton)).toBeVisible();
  if (await logoutButton.isVisible().catch(() => false)) {
    await waitForAppShell(page);
    return false;
  }

  await new LevelHabitPage(page).login();
  return true;
}

export async function gotoProtectedRoute(
  page: Page,
  route: (typeof PROTECTED_ROUTES)[number]
): Promise<void> {
  assertPageUsable(page);
  const routePage = page.getByTestId(`page-${route}`);
  const logoutButton = page.getByTestId('logout-button');

  if (await logoutButton.isVisible().catch(() => false)) {
    if (
      new URL(page.url()).hash !== `#/${route}`
      || !(await routePage.isVisible().catch(() => false))
    ) {
      await page.getByTestId(`nav-${route}`).click();
    }
    await waitForAppShell(page, route);
    return;
  }

  await page.goto(productionRouteUrl(route), { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL((url) =>
    url.hash === `#/${route}` || url.hash.startsWith('#/login')
  );
  await ensureAuthenticated(page);

  if (
    new URL(page.url()).hash !== `#/${route}`
    || !(await routePage.isVisible().catch(() => false))
  ) {
    await page.getByTestId(`nav-${route}`).click();
  }
  await waitForAppShell(page, route);
}

export async function warmBackend(page: Page): Promise<void> {
  await expect.poll(async () => {
    try {
      const response = await page.request.get(
        `${PRODUCTION_API_URL}/health`,
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
    assertPageUsable(this.page);
    await this.page.goto(productionRouteUrl('login'), { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL((url) => url.hash.startsWith('#/login'));
    await expect(this.page).toHaveTitle(/Sign in \| LevelHabit/);
  }

  async login(email = credentials().email, password = credentials().password): Promise<void> {
    await this.openLogin();
    if (await this.page.getByTestId('logout-button').isVisible().catch(() => false)) {
      await this.page.getByTestId('logout-button').click();
    }
    await this.page.getByTestId('login-email-input').fill(email);
    await this.page.getByTestId('login-password-input').fill(password);
    const loginResponsePromise = waitForApiResponse(
      this.page,
      'POST',
      '/api/auth/login'
    );
    await this.page.getByTestId('login-submit-button').click();
    await loginResponsePromise;
    await waitForAppShell(this.page, 'dashboard');
  }

  async logout(): Promise<Response> {
    const logoutResponsePromise = this.page.waitForResponse((response) =>
      isMatchingApiResponse(response, 'POST', '/api/auth/logout')
    );
    await this.page.getByTestId('logout-button').click();
    const logoutResponse = await logoutResponsePromise;
    await expect(this.page.getByTestId('login-submit-button')).toBeVisible();

    return logoutResponse;
  }

  async openRoute(route: (typeof PROTECTED_ROUTES)[number]): Promise<void> {
    await gotoProtectedRoute(this.page, route);
  }
}

function normalizePathname(path: string): string {
  const pathname = path.startsWith('http')
    ? new URL(path).pathname
    : path.split('?')[0] ?? path;
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;

  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, '')
    : withLeadingSlash;
}

function isMatchingApiResponse(
  response: Response,
  method: string,
  path: string
): boolean {
  const url = new URL(response.url());

  return url.origin === PRODUCTION_API_ORIGIN
    && normalizePathname(url.pathname) === normalizePathname(path)
    && response.request().method().toUpperCase() === method.toUpperCase();
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
