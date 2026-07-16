import type { Page } from '@playwright/test';

import {
  LevelHabitPage,
  attachLocatorScreenshot,
  expect,
  skipForWebKitCrossSiteRefreshCookie,
  test,
  warmBackend
} from './support/production-fixture';

test.describe('production habit lifecycle', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('enforces accessible backend length limits for create and edit, then saves corrections', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await app.openRoute('habits');
    let createRequests = 0;
    let updateRequests = 0;
    const fakeHabitId = '11111111-1111-4111-8111-111111111111';
    await page.route('**/api/habits{,/*}', async (route) => {
      const request = route.request();
      const isCreate = request.method() === 'POST' && request.url().endsWith('/api/habits');
      const isUpdate = request.method() === 'PUT' && request.url().endsWith(`/api/habits/${fakeHabitId}`);
      const isReminderRead = request.method() === 'GET'
        && request.url().endsWith(`/api/habits/${fakeHabitId}/reminder`);

      if (isReminderRead) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          json: {
            id: null,
            habitId: fakeHabitId,
            isEnabled: false,
            time: null,
            timeZoneId: null,
            daysOfWeek: [],
            lastTriggeredAtUtc: null,
            nextTriggerAtUtc: null,
            createdAtUtc: null,
            updatedAtUtc: null
          }
        });
        return;
      }

      if (!isCreate && !isUpdate) {
        await route.continue();
        return;
      }

      if (isCreate) {
        createRequests += 1;
      } else {
        updateRequests += 1;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: isCreate ? 201 : 200,
        contentType: 'application/json',
        json: {
          id: fakeHabitId,
          userId: '22222222-2222-4222-8222-222222222222',
          ...body,
          xpReward: 10,
          isArchived: false,
          completedToday: false,
          completedTodayXpAwarded: null,
          completedTodayAtUtc: null,
          currentStreak: 0,
          bestStreak: 0,
          lastCompletedDateUtc: null,
          lastCompletedAtUtc: null,
          createdAtUtc: '2026-07-15T12:00:00Z',
          updatedAtUtc: '2026-07-15T12:00:00Z'
        }
      });
    });

    const maximumTitle = 'T'.repeat(140);
    const maximumDescription = 'D'.repeat(1000);
    await page.getByTestId('habit-title-input').fill(maximumTitle);
    await page.getByTestId('habit-description-input').fill(maximumDescription);
    const createResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/habits')
      && response.request().method() === 'POST'
    );
    await page.getByTestId('habit-submit-button').click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    expect(createRequests).toBe(1);
    const fakeCard = page.getByTestId('habit-card').filter({ hasText: maximumTitle });
    await expect(fakeCard).toBeVisible();
    await fakeCard.getByRole('button', { name: 'Edit' }).click();

    await page.getByTestId('habit-title-input').fill('T'.repeat(141));
    await page.getByTestId('habit-description-input').fill('D'.repeat(1001));
    await page.getByTestId('habit-submit-button').click();
    await page.getByTestId('habit-form').screenshot({
      path: 'test-results/production-audit/evidence/LH-HABIT-002-overlength-validation.png'
    });
    await expect(page.getByText('Title must be 140 characters or fewer.')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Description must be 1000 characters or fewer.')).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveAttribute('aria-describedby', 'habit-title-error');
    await expect(page.getByLabel('Description')).toHaveAttribute(
      'aria-describedby',
      'habit-description-error'
    );
    expect(updateRequests).toBe(0);

    const correctedTitle = 'Corrected mocked habit';
    await page.getByTestId('habit-title-input').fill(correctedTitle);
    await page.getByTestId('habit-description-input').fill('Corrected description');
    const updateResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith(`/api/habits/${fakeHabitId}`)
      && response.request().method() === 'PUT'
    );
    await page.getByTestId('habit-submit-button').click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.ok()).toBeTruthy();
    expect(updateRequests).toBe(1);
    await expect(page.getByTestId('habit-card').filter({ hasText: correctedTitle })).toBeVisible();
  });

  test('validates, creates, edits, completes, and archives only its own record', async ({ page }, testInfo) => {
    test.skip(
      process.env['LEVELHABIT_SKIP_DESTRUCTIVE'] === '1',
      'Skipped when a non-mutating production rerun is requested.'
    );
    const app = new LevelHabitPage(page);
    const title = `E2E-CODEX-${Date.now()} lifecycle`;
    const editedTitle = `${title} edited`;
    let habitId: string | null = null;
    try {
      await app.login();
      await app.openRoute('habits');
      await page.getByTestId('habit-submit-button').click();
      await expect(page.getByText('Title is required.')).toBeVisible();
      await page.getByTestId('habit-title-input').fill(`  ${title}  `);
      await page.getByTestId('habit-description-input').fill('  QA description with punctuation: !?  ');
      await page.getByLabel('Category').selectOption('Coding');
      await page.getByLabel('Difficulty').selectOption('Medium');
      await page.getByLabel('Frequency').selectOption('Daily');
      const createResponsePromise = waitForHabitMutation(page, 'POST', '/api/habits');
      await page.getByTestId('habit-submit-button').click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBeTruthy();
      habitId = ((await createResponse.json()) as { id: string }).id;
      let card = page.getByTestId('habit-card').filter({ hasText: title });
      await expect(card).toHaveCount(1);
      await card.getByRole('button', { name: 'Edit' }).click();
      await page.getByTestId('habit-title-input').fill(editedTitle);
      const updateResponsePromise = waitForHabitMutation(
        page,
        'PUT',
        `/api/habits/${habitId}`
      );
      await page.getByTestId('habit-submit-button').click();
      expect((await updateResponsePromise).ok()).toBeTruthy();
      card = page.getByTestId('habit-card').filter({ hasText: editedTitle });
      await expect(card).toHaveCount(1);
      const completionResponsePromise = waitForHabitMutation(
        page,
        'POST',
        `/api/habits/${habitId}/complete`
      );
      await card.getByTestId('habit-complete-button').click();
      expect((await completionResponsePromise).ok()).toBeTruthy();
      await expect(card).toContainText('Done today');
      await expect(card.getByTestId('habit-complete-button')).toBeDisabled();
      await archiveHabitCard(page, habitId, editedTitle);
      await page.getByRole('button', { name: 'Archived' }).click();
      await expect(page.getByTestId('habit-card').filter({ hasText: editedTitle })).toContainText('Archived');
      await attachLocatorScreenshot(
        page.locator('.app-card-grid--habits'),
        testInfo,
        'LH-HABIT-ARCHIVED-CLEANUP-LIMITATION'
      );
    } finally {
      await safelyArchiveE2EHabit(page, habitId, title);
    }
  });

  test('persists a completed habit and XP after reload', async ({ browserName, page }) => {
    test.skip(
      process.env['LEVELHABIT_SKIP_DESTRUCTIVE'] === '1',
      'Skipped when a non-mutating production rerun is requested.'
    );
    skipForWebKitCrossSiteRefreshCookie(browserName);
    const app = new LevelHabitPage(page);
    const title = `E2E-CODEX-${Date.now()} persistence`;
    let habitId: string | null = null;
    try {
      await app.login();
      await app.openRoute('habits');
      await page.getByTestId('habit-title-input').fill(title);
      const createResponsePromise = waitForHabitMutation(page, 'POST', '/api/habits');
      await page.getByTestId('habit-submit-button').click();
      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBeTruthy();
      habitId = ((await createResponse.json()) as { id: string }).id;
      const card = page.getByTestId('habit-card').filter({ hasText: title });
      const completionResponsePromise = waitForHabitMutation(
        page,
        'POST',
        `/api/habits/${habitId}/complete`
      );
      await card.getByTestId('habit-complete-button').click();
      expect((await completionResponsePromise).ok()).toBeTruthy();
      await expect(card).toContainText('Done today');
      const xpAfterCompletion = await page.getByTestId('progress-total-xp').innerText();

      await page.reload();

      await expect(page.getByTestId('habit-card').filter({ hasText: title })).toContainText('Done today');
      await expect(page.getByTestId('progress-total-xp')).toHaveText(xpAfterCompletion);
    } finally {
      await safelyArchiveE2EHabit(page, habitId, title);
    }
  });
});

function waitForHabitMutation(page: Page, method: string, path: string) {
  return page.waitForResponse((response) =>
    response.url().endsWith(path) && response.request().method() === method
  );
}

async function archiveHabitCard(
  page: Page,
  habitId: string,
  title: string
): Promise<void> {
  const card = page.getByTestId('habit-card').filter({ hasText: title });
  const archiveResponsePromise = waitForHabitMutation(
    page,
    'DELETE',
    `/api/habits/${habitId}`
  );
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: 'Archive' }).click();
  expect((await archiveResponsePromise).ok()).toBeTruthy();
  await expect(card).toHaveCount(0);
}

async function safelyArchiveE2EHabit(
  page: Page,
  habitId: string | null,
  title: string
): Promise<void> {
  if (!habitId || !title.startsWith('E2E-CODEX-')) {
    return;
  }

  if (!(await page.getByTestId('logout-button').isVisible().catch(() => false))) {
    await new LevelHabitPage(page).login();
  }
  await page.goto('./#/habits');
  await expect(page.getByTestId('page-habits')).toBeVisible();
  await page.getByRole('button', { name: 'Active' }).click();
  const card = page.getByTestId('habit-card').filter({ hasText: title });
  if (await card.count() === 0) {
    return;
  }

  await archiveHabitCard(page, habitId, title);
}
