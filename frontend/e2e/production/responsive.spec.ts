import { LevelHabitPage, attachLocatorScreenshot, expect, test, warmBackend } from './support/production-fixture';

const viewports = [
  { width: 320, height: 568 }, { width: 375, height: 667 },
  { width: 390, height: 844 }, { width: 768, height: 1024 },
  { width: 1024, height: 768 }, { width: 1280, height: 720 },
  { width: 1440, height: 900 }, { width: 1920, height: 1080 }
] as const;

test.describe('production responsive layout', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('has no horizontal overflow on login at required viewports', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.openLogin();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth, `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(page.getByTestId('login-submit-button')).toBeInViewport();
    }
  });

  test('keeps authenticated routes usable and header controls aligned', async ({ page }, testInfo) => {
    const app = new LevelHabitPage(page);
    await app.login();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of ['dashboard', 'habits', 'progress'] as const) {
        await page.goto(`./#/${route}`);
        await expect(page.getByTestId(`page-${route}`)).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
      }
      const alignment = await page.evaluate(() => {
        const logout = document.querySelector<HTMLElement>('[data-testid="logout-button"]');
        const language = document.querySelector<HTMLElement>('select[aria-label="Language"]');
        if (!logout || !language) return null;
        const a = logout.getBoundingClientRect();
        const b = language.getBoundingClientRect();
        return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2));
      });
      expect(alignment, `${viewport.width}x${viewport.height}`).not.toBeNull();
      expect(alignment!, `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(4);
      if (viewport.width === 390) {
        await attachLocatorScreenshot(
          page.locator('header.site-header'),
          testInfo,
          'LH-NAV-LOGOUT-ALIGNMENT-390x844'
        );
      }
    }
  });
});
