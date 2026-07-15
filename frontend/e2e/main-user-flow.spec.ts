import { expect, test } from '@playwright/test';

import {
  completeHabit,
  createHabit,
  createTestUser,
  loginUser,
  logout,
  openAnalytics,
  openHabits,
  habitCard,
  registerUser,
  uniqueRunId,
  waitForApiHealth
} from './support/levelhabit-e2e';

test.describe('main authenticated user journey', () => {
  test.beforeEach(async ({ request }) => {
    await waitForApiHealth(request);
  });

  test('registers, completes a habit, verifies progress, and persists after login', async ({
    page
  }) => {
    const runId = uniqueRunId('main');
    const user = createTestUser(runId, 'Main');
    const habitTitle = `E2E Hard Habit ${runId}`;

    await registerUser(page, user);

    await openHabits(page);
    await createHabit(page, {
      title: habitTitle,
      description: 'Complete a deterministic browser-driven habit.',
      category: 'Coding',
      difficulty: 'Hard',
      frequency: 'Daily'
    });

    const completedCard = await completeHabit(page, habitTitle);
    await expect(completedCard).toContainText('+35 XP awarded');
    await expect(completedCard).toContainText('1-day streak');
    await expect(page.getByTestId('progress-total-xp')).toHaveText('35');
    await expect(page.getByTestId('progress-xp-progress')).toContainText('35/100 XP');
    await expect(page.getByTestId('progress-today-count')).toHaveText('1/1');

    await page.getByTestId('nav-achievements').click();
    await expect(page.getByTestId('page-achievements')).toBeVisible();

    const firstStep = page.getByTestId('achievement-card').filter({
      hasText: 'First Step'
    });
    await expect(firstStep).toContainText('Unlocked');
    await expect(firstStep).toContainText('1/1 habit completions');

    const hardMode = page.getByTestId('achievement-card').filter({
      hasText: 'Hard Mode'
    });
    await expect(hardMode).toContainText('Unlocked');

    await openAnalytics(page);
    await expect(page.getByTestId('analytics-habit-library')).toContainText('1 habit');
    await expect(page.getByTestId('analytics-completions')).toContainText('1');
    await expect(page.getByTestId('analytics-progress-growth')).toContainText('35 XP');
    await expect(page.getByTestId('analytics-achievements')).toContainText('2/9');
    await expect(page.getByTestId('analytics-current-streak-max')).toContainText('1d');
    await expect(page.getByTestId('analytics-recent-completion')).toContainText(habitTitle);
    await expect(page.getByTestId('analytics-recent-completion')).toContainText('+35 XP');

    await logout(page);
    await loginUser(page, user);

    await openHabits(page);
    await expect(habitCard(page, habitTitle)).toContainText('Done today');
    await expect(habitCard(page, habitTitle)).toContainText('1-day streak');
    await expect(page.getByTestId('progress-total-xp')).toHaveText('35');
  });
});
