import { LevelHabitPage, credentials, expect, test, warmBackend } from './support/production-fixture';

test.describe('production profile and account surface', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('shows the signed-in account consistently without exposing identifiers in the URL', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await app.openRoute('progress');
    await expect(page.getByText(credentials().email, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Your progress' })).toBeVisible();
    expect(page.url()).not.toContain(credentials().email);
    expect(page.url()).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
    await page.reload();
    await expect(page.getByText(credentials().email, { exact: true })).toBeVisible();
  });

  test('keeps profile data after logout and login', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await app.openRoute('progress');
    const totalXp = await page.getByTestId('progress-total-xp').innerText();
    const email = credentials().email;
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await app.logout();
    await app.login();
    await app.openRoute('progress');
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByTestId('progress-total-xp')).toHaveText(totalXp);
  });
});
