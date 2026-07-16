import {
  LevelHabitPage,
  PRODUCTION_API_URL,
  PROTECTED_ROUTES,
  expect,
  hasConfirmedWebKitCrossSiteCookieLimitation,
  skipForWebKitCrossSiteRefreshCookie,
  test,
  warmBackend
} from './support/production-fixture';

test.describe('production navigation and authorization', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('opens and navigates to every protected route before reload', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    for (const route of PROTECTED_ROUTES) {
      await app.openRoute(route);
      await expect(page.getByTestId(`nav-${route}`)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('restores every protected route after reload and direct navigation', async ({
    browserName,
    page
  }) => {
    skipForWebKitCrossSiteRefreshCookie(browserName);
    const app = new LevelHabitPage(page);
    await app.login();
    for (const route of PROTECTED_ROUTES) {
      await page.goto(`./#/${route}`);
      await expect(page.getByTestId(`page-${route}`)).toBeVisible();
      await page.reload();
      await expect(page.getByTestId(`page-${route}`)).toBeVisible();
    }
  });

  test('supports Back and Forward without blank or mismatched pages', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await app.openRoute('habits');
    await app.openRoute('progress');
    await page.goBack();
    await expect(page.getByTestId('page-habits')).toBeVisible();
    await page.goForward();
    await expect(page.getByTestId('page-progress')).toBeVisible();
  });

  test('logout removes content and guards every protected route', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await app.logout();
    await page.goBack();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    await expect(page.getByTestId('page-dashboard')).toHaveCount(0);
    for (const route of PROTECTED_ROUTES) {
      await page.goto(`./#/${route}`);
      await expect(page.getByTestId('login-submit-button')).toBeVisible();
      await expect(page.getByTestId(`page-${route}`)).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId('login-submit-button')).toBeVisible();
    }
  });

  test('redirects login and registration full-page loads when a session is active', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await page.goto('./#/login');
    await expect(page.getByTestId('page-dashboard')).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByTestId('login-submit-button')).toHaveCount(0);
    await page.goto('./#/register');
    await expect(page.getByTestId('page-dashboard')).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByTestId('register-submit-button')).toHaveCount(0);
  });

  test('clears the authentication cookie and rejects session restoration after logout', async ({
    browserName,
    page
  }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    expect(await page.evaluate(() => localStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    const logoutResponse = await app.logout();
    const cookiesAfterLogout = await page.context().cookies();
    expect(cookiesAfterLogout.some((cookie) => cookie.name === 'LevelHabit.Refresh')).toBe(false);
    expect(cookiesAfterLogout.some((cookie) => cookie.name === 'LevelHabit.Csrf')).toBe(false);
    if (!hasConfirmedWebKitCrossSiteCookieLimitation(browserName)) {
      expect(logoutResponse.status()).toBe(204);
      const setCookie = (await logoutResponse.allHeaders())['set-cookie'] ?? '';
      expect(setCookie).toContain('LevelHabit.Refresh=');
      expect(setCookie).toContain('LevelHabit.Csrf=');
      expect(setCookie.match(/Max-Age=0/gi)).toHaveLength(2);
      expect(setCookie.match(/Path=\/api\/auth/gi)).toHaveLength(2);
    }
    await page.reload();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    await page.goto('./#/register');
    await expect(page.getByTestId('register-submit-button')).toBeVisible();
    const refreshStatus = await page.evaluate(async ({ apiUrl, csrfHeader }) => {
      const csrfResponse = await fetch(`${apiUrl}/auth/csrf`, {
        credentials: 'include'
      });
      const csrfBody = await csrfResponse.json() as { csrfToken: string };
      const refreshResponse = await fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { [csrfHeader]: csrfBody.csrfToken }
      });

      return refreshResponse.status;
    }, { apiUrl: PRODUCTION_API_URL, csrfHeader: 'X-LevelHabit-CSRF' });
    expect(refreshStatus).toBe(
      hasConfirmedWebKitCrossSiteCookieLimitation(browserName) ? 403 : 401
    );
  });

  test('allows credentialed CORS from GitHub Pages', async ({ page }) => {
    await page.goto('./#/login');
    const result = await page.evaluate(async (apiUrl) => {
      const response = await fetch(
        `${apiUrl}/health`,
        { credentials: 'include' }
      );
      return { ok: response.ok, status: response.status };
    }, PRODUCTION_API_URL);

    expect(result).toEqual({ ok: true, status: 200 });
  });
});
