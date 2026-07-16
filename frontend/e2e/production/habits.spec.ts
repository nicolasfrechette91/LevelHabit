import { LevelHabitPage, attachLocatorScreenshot, expect, test, warmBackend } from './support/production-fixture';

test.describe('production habit lifecycle', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('explains overlength title and description validation without submitting', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await app.openRoute('habits');
    let createRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/habits')) {
        createRequests += 1;
      }
    });
    await page.getByTestId('habit-title-input').fill('T'.repeat(141));
    await page.getByTestId('habit-description-input').fill('D'.repeat(1001));
    await page.getByTestId('habit-submit-button').click();
    expect(createRequests).toBe(0);
    await page.getByTestId('habit-form').screenshot({
      path: 'test-results/production-audit/evidence/LH-HABIT-002-overlength-validation.png'
    });
    await expect(page.getByText('Title must be 140 characters or fewer.')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Description must be 1000 characters or fewer.')).toBeVisible();
  });

  test('validates, creates, edits, completes, persists, and archives only its own record', async ({ page }, testInfo) => {
    test.skip(
      process.env['LEVELHABIT_SKIP_DESTRUCTIVE'] === '1',
      'Skipped when a non-mutating production rerun is requested.'
    );
    const app = new LevelHabitPage(page);
    const title = `E2E-CODEX-${Date.now()} Café's 🚀`;
    const editedTitle = `${title} edited`;
    await app.login();
    await app.openRoute('habits');
    await page.getByTestId('habit-submit-button').click();
    await expect(page.getByText('Title is required.')).toBeVisible();
    await page.getByTestId('habit-title-input').fill(`  ${title}  `);
    await page.getByTestId('habit-description-input').fill('  QA description with punctuation: !? — é 😀  ');
    await page.getByLabel('Category').selectOption('Coding');
    await page.getByLabel('Difficulty').selectOption('Medium');
    await page.getByLabel('Frequency').selectOption('Daily');
    await page.getByTestId('habit-submit-button').click();
    let card = page.getByTestId('habit-card').filter({ hasText: title });
    await expect(card).toHaveCount(1);
    await card.getByRole('button', { name: 'Edit' }).click();
    await page.getByTestId('habit-title-input').fill(editedTitle);
    await page.getByTestId('habit-submit-button').click();
    card = page.getByTestId('habit-card').filter({ hasText: editedTitle });
    await expect(card).toHaveCount(1);
    await card.getByTestId('habit-complete-button').click();
    await expect(card).toContainText('Done today');
    await expect(card.getByTestId('habit-complete-button')).toBeDisabled();
    const xpAfterCompletion = await page.getByTestId('progress-total-xp').innerText();
    await page.reload();
    await expect(page.getByTestId('habit-card').filter({ hasText: editedTitle })).toContainText('Done today');
    await expect(page.getByTestId('progress-total-xp')).toHaveText(xpAfterCompletion);
    card = page.getByTestId('habit-card').filter({ hasText: editedTitle });
    page.once('dialog', (dialog) => dialog.accept());
    await card.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByTestId('habit-card').filter({ hasText: editedTitle })).toHaveCount(0);
    await page.getByRole('button', { name: 'Archived' }).click();
    await expect(page.getByTestId('habit-card').filter({ hasText: editedTitle })).toContainText('Archived');
    await attachLocatorScreenshot(
      page.locator('.app-card-grid--habits'),
      testInfo,
      'LH-HABIT-ARCHIVED-CLEANUP-LIMITATION'
    );
  });
});
