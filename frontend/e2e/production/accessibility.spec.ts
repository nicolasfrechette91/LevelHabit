import { LevelHabitPage, expect, test, warmBackend } from './support/production-fixture';

test.describe('production accessibility', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('associates login labels and validation errors and provides keyboard focus', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.openLogin();
    await expect(page.getByLabel('Email')).toHaveCount(1);
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(1);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const style = element ? getComputedStyle(element) : null;
      return { tag: element?.tagName ?? null, visibleIndicator: Boolean(style && (style.outlineStyle !== 'none' || style.boxShadow !== 'none')) };
    });
    expect(focused.tag).not.toBe('BODY');
    expect(focused.visibleIndicator).toBe(true);
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('login-email-input')).toHaveAttribute('aria-describedby', 'login-email-error');
    await expect(page.getByTestId('login-password-input')).toHaveAttribute('aria-describedby', 'login-password-error');
  });

  test('exposes headings, landmarks, active navigation, and progress names', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByTestId('progress-level-progress')).toHaveAttribute('aria-label', /progress/i);
    await app.openRoute('achievements');
    await expect(page.getByText('Loading achievements...')).toHaveCount(0);
    const cards = page.getByTestId('achievement-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(cards.nth(index).getByRole('progressbar')).toHaveAttribute('aria-label', /progress/i);
    }
  });

  test('remains usable at 200 percent equivalent zoom', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await page.setViewportSize({ width: 640, height: 568 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await expect(page.getByTestId('logout-button')).toBeVisible();
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
