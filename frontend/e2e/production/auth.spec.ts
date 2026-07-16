import { LevelHabitPage, credentials, expect, test, warmBackend } from './support/production-fixture';

test.describe('production authentication', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('loads directly and validates empty and malformed submissions', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.openLogin();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByTestId('login-password-input')).toHaveAttribute('type', 'password');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByText('Email is required.')).toBeVisible();
    await expect(page.getByText('Password is required.')).toBeVisible();
    await expect(page.getByTestId('login-email-input')).toHaveAttribute('aria-invalid', 'true');
    await page.getByTestId('login-email-input').fill('not-an-email');
    await page.getByTestId('login-password-input').fill('wrong-value');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  });

  test('uses a generic error for an unknown account and an incorrect password', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.openLogin();
    await page.getByTestId('login-email-input').fill(`e2e-codex-unknown-${Date.now()}@example.com`);
    await page.getByTestId('login-password-input').fill('incorrect-password');
    await page.getByTestId('login-submit-button').click();
    const firstMessage = await page.getByRole('alert').innerText();
    expect(firstMessage.toLowerCase()).not.toContain('account exists');
    await page.getByTestId('login-email-input').fill(credentials().email);
    await page.getByTestId('login-password-input').fill('incorrect-password');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByRole('alert')).toHaveText(firstMessage);
  });

  test('submits with Enter, prevents duplicate requests, refreshes, and keeps secrets out of the URL', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.openLogin();
    let loginRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/auth/login')) loginRequests += 1;
    });
    await page.getByTestId('login-email-input').fill(credentials().email);
    await page.getByTestId('login-password-input').fill(credentials().password);
    await page.getByTestId('login-password-input').press('Enter');
    await expect(page.getByTestId('page-dashboard')).toBeVisible({ timeout: 3_000 });
    expect(loginRequests).toBe(1);
    expect(page.url()).not.toContain(credentials().password);
    await page.reload();
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('page-dashboard')).toBeVisible({ timeout: 3_000 });
  });

  test('normalizes email casing and surrounding spaces', async ({ page }) => {
    const app = new LevelHabitPage(page);
    const email = credentials().email;
    await app.login(`  ${email.toUpperCase()}  `, credentials().password);
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
  });

  test('prevents duplicate login requests from a rapid double click', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.openLogin();
    let loginRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/auth/login')) loginRequests += 1;
    });
    await page.getByTestId('login-email-input').fill(credentials().email);
    await page.getByTestId('login-password-input').fill(credentials().password);
    await page.getByTestId('login-submit-button').dblclick();
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    expect(loginRequests).toBe(1);
  });

  test('prevents duplicate login requests from rapid Enter submissions', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.openLogin();
    let loginRequests = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/auth/login')) loginRequests += 1;
    });
    await page.getByTestId('login-email-input').fill(credentials().email);
    await page.getByTestId('login-password-input').fill(credentials().password);
    await Promise.all([
      page.getByTestId('login-password-input').press('Enter'),
      page.getByTestId('login-password-input').press('Enter')
    ]);
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    expect(loginRequests).toBe(1);
  });

  test('keeps refresh tokens out of login JSON and browser storage', async ({ page }) => {
    const app = new LevelHabitPage(page);
    const loginResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/login') && response.status() === 200
    );

    await app.login();
    const responseJson = await (await loginResponse).json() as Record<string, unknown>;

    expect(responseJson).not.toHaveProperty('refreshToken');
    expect(responseJson).not.toHaveProperty('refreshTokenExpiresAtUtc');
    expect(await page.evaluate(() => localStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    const refreshCookie = (await page.context().cookies()).find((cookie) =>
      cookie.name === 'LevelHabit.Refresh'
    );
    expect(refreshCookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    });
  });
});
