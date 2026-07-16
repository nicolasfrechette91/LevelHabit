import { LevelHabitPage, PROTECTED_ROUTES, expect, test, warmBackend } from './support/production-fixture';

test.describe('production navigation and authorization', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('opens, refreshes, and directly navigates to every protected route', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    for (const route of PROTECTED_ROUTES) {
      await app.openRoute(route);
      await expect(page.getByTestId(`nav-${route}`)).toHaveAttribute('aria-current', 'page');
      await page.reload();
      await expect(page.getByTestId(`page-${route}`)).toBeVisible();
      await page.goto(`./#/${route}`);
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

  test('clears the authentication cookie and rejects session restoration after logout', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    expect(await page.evaluate(() => localStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    await app.logout();
    expect(
      (await page.context().cookies()).some((cookie) => cookie.name === 'LevelHabit.Refresh')
    ).toBe(false);
    await page.reload();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    await page.goto('./#/register');
    await expect(page.getByTestId('register-submit-button')).toBeVisible();
    const status = await page.evaluate(async () => {
      const response = await fetch('https://level-habit-api.onrender.com/api/habits');
      return response.status;
    });
    expect(status).toBe(401);
  });

  test('allows credentialed CORS from GitHub Pages', async ({ page }) => {
    await page.goto('./#/login');
    const result = await page.evaluate(async () => {
      const response = await fetch(
        'https://level-habit-api.onrender.com/api/health',
        { credentials: 'include' }
      );
      return { ok: response.ok, status: response.status };
    });

    expect(result).toEqual({ ok: true, status: 200 });
  });
});
