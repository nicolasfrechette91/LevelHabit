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

  test('redirects the login URL when a session is already active', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await page.goto('./#/login');
    await expect(page.getByTestId('page-dashboard')).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL(/#\/dashboard$/);
  });

  test('clears stored credentials and rejects API access after logout', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    const storedShape = await page.evaluate(() => {
      const stored = localStorage.getItem('levelhabit.auth.v1');
      return stored ? Object.keys(JSON.parse(stored)).sort() : [];
    });
    expect(storedShape).toEqual([
      'accessToken', 'expiresAtUtc', 'refreshToken', 'refreshTokenExpiresAtUtc'
    ]);
    await app.logout();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    const status = await page.evaluate(async () => {
      const response = await fetch('https://level-habit-api.onrender.com/api/habits');
      return response.status;
    });
    expect(status).toBe(401);
  });
});
