import type { Locator } from '@playwright/test';

import {
  LevelHabitPage,
  attachLocatorScreenshot,
  ensureAuthenticated,
  expect,
  gotoProtectedRoute,
  test,
  waitForApiResponse,
  warmBackend
} from './support/production-fixture';
import {
  archiveHabitCard,
  createUniqueHabitTitle,
  habitCard,
  safelyArchiveTestHabit,
  setHabitFilter,
  waitForHabitList
} from './support/production-habit-helpers';

test.describe('production habit lifecycle', () => {
  test.beforeEach(async ({ page }) => warmBackend(page));

  test('enforces accessible backend length limits for create and edit, then saves corrections', async ({ page }) => {
    const app = new LevelHabitPage(page);
    await app.login();
    await app.openRoute('habits');
    await waitForHabitList(page);
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
    const createResponsePromise = waitForApiResponse(page, 'POST', '/api/habits');
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
    const updateResponsePromise = waitForApiResponse(
      page,
      'PUT',
      `/api/habits/${fakeHabitId}`
    );
    await page.getByTestId('habit-submit-button').click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.ok()).toBeTruthy();
    expect(updateRequests).toBe(1);
    await expect(page.getByTestId('habit-card').filter({ hasText: correctedTitle })).toBeVisible();
  });

  test('validates, creates, edits, completes, and archives only its own record', async ({ browserName, page }, testInfo) => {
    const app = new LevelHabitPage(page);
    const title = createUniqueHabitTitle(browserName, 'lifecycle', testInfo);
    const editedTitle = `${title} edited`;
    let cleanupTitle = title;
    let habitId: string | null = null;
    let originalTestFailed = false;
    try {
      await app.login();
      await app.openRoute('habits');
      await waitForHabitList(page);
      await page.getByTestId('habit-submit-button').click();
      await expect(page.getByText('Title is required.')).toBeVisible();
      await page.getByTestId('habit-title-input').fill(`  ${title}  `);
      await page.getByTestId('habit-description-input').fill('  QA description with punctuation: !?  ');
      await page.getByLabel('Category').selectOption('Coding');
      await page.getByLabel('Difficulty').selectOption('Medium');
      await page.getByLabel('Frequency').selectOption('Daily');
      const createResponsePromise = waitForApiResponse(page, 'POST', '/api/habits');
      await page.getByTestId('habit-submit-button').click();
      const createResponse = await createResponsePromise;
      habitId = ((await createResponse.json()) as { id: string }).id;
      let card = habitCard(page, title);
      await expect(card).toHaveCount(1);
      await card.getByRole('button', { name: 'Edit' }).click();
      await page.getByTestId('habit-title-input').fill(editedTitle);
      const updateResponsePromise = waitForApiResponse(
        page,
        'PUT',
        `/api/habits/${habitId}`
      );
      await page.getByTestId('habit-submit-button').click();
      await updateResponsePromise;
      cleanupTitle = editedTitle;
      card = habitCard(page, editedTitle);
      await expect(card).toHaveCount(1);
      const completionResponsePromise = waitForApiResponse(
        page,
        'POST',
        `/api/habits/${habitId}/complete`
      );
      await card.getByTestId('habit-complete-button').click();
      await completionResponsePromise;
      await expect(card).toContainText('Done today');
      await expect(card.getByTestId('habit-complete-button')).toBeDisabled();
      await archiveHabitCard(page, habitId, editedTitle);
      await setHabitFilter(page, 'Archived');
      await expect(habitCard(page, editedTitle)).toContainText('Archived');
      await attachLocatorScreenshot(
        page.locator('.app-card-grid--habits'),
        testInfo,
        'LH-HABIT-ARCHIVED-CLEANUP-LIMITATION'
      );
    } catch (error: unknown) {
      originalTestFailed = true;
      throw error;
    } finally {
      await safelyArchiveTestHabit(
        page,
        habitId,
        cleanupTitle,
        testInfo,
        originalTestFailed
      );
    }
  });

  test('persists a completed habit and XP after reload', async ({ browserName, page }, testInfo) => {
    const app = new LevelHabitPage(page);
    const title = createUniqueHabitTitle(browserName, 'persistence', testInfo);
    let habitId: string | null = null;
    let originalTestFailed = false;
    try {
      await app.login();
      await app.openRoute('habits');
      await waitForHabitList(page);
      await page.getByTestId('habit-title-input').fill(title);
      const createResponsePromise = waitForApiResponse(page, 'POST', '/api/habits');
      await page.getByTestId('habit-submit-button').click();
      const createResponse = await createResponsePromise;
      habitId = ((await createResponse.json()) as { id: string }).id;
      const card = habitCard(page, title);
      await expect(card).toBeVisible();
      const completionResponsePromise = waitForApiResponse(
        page,
        'POST',
        `/api/habits/${habitId}/complete`
      );
      await card.getByTestId('habit-complete-button').click();
      const completionResponse = await completionResponsePromise;
      const completion = await completionResponse.json() as {
        xpAwarded: number;
        progressProfile: { totalXp: number };
      };
      await expect(card).toContainText('Done today');
      await expect(card.getByTestId('habit-complete-button')).toBeDisabled();
      await expect(card.getByText(
        `+${completion.xpAwarded} XP awarded`,
        { exact: true }
      )).toBeVisible();
      await expectDisplayedNumber(
        page.getByTestId('progress-total-xp'),
        completion.progressProfile.totalXp
      );

      await page.reload({ waitUntil: 'domcontentloaded' });
      await ensureAuthenticated(page);
      await gotoProtectedRoute(page, 'habits');
      await waitForHabitList(page);

      const persistedCard = habitCard(page, title);
      await expect(persistedCard).toContainText('Done today');
      await expect(persistedCard.getByTestId('habit-complete-button')).toBeDisabled();
      await expectDisplayedNumber(
        page.getByTestId('progress-total-xp'),
        completion.progressProfile.totalXp
      );
    } catch (error: unknown) {
      originalTestFailed = true;
      throw error;
    } finally {
      await safelyArchiveTestHabit(
        page,
        habitId,
        title,
        testInfo,
        originalTestFailed
      );
    }
  });
});

async function expectDisplayedNumber(
  locator: Locator,
  expectedValue: number
): Promise<void> {
  await expect.poll(async () => {
    const text = await locator.innerText();
    const numericText = text.replace(/[^\d-]/g, '');

    return Number(numericText);
  }).toBe(expectedValue);
}
