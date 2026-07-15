import { expect, test } from '@playwright/test';

import {
  completeHabit,
  createHabit,
  createTestUser,
  expectNoHabitCard,
  logout,
  openAnalytics,
  openHabits,
  registerUser,
  uniqueRunId,
  waitForApiHealth
} from './support/levelhabit-e2e';

test.describe('user data isolation', () => {
  test.beforeEach(async ({ request }) => {
    await waitForApiHealth(request);
  });

  test('keeps habits, analytics, and achievements scoped to the signed-in user', async ({
    page
  }) => {
    const runId = uniqueRunId('isolation');
    const userA = createTestUser(runId, 'User A');
    const userB = createTestUser(runId, 'User B');
    const userAHabitTitle = `E2E User A Habit ${runId}`;

    await registerUser(page, userA);
    await openHabits(page);
    await createHabit(page, {
      title: userAHabitTitle,
      description: 'A habit that must stay private to User A.',
      category: 'Health',
      difficulty: 'Hard',
      frequency: 'Daily'
    });
    await completeHabit(page, userAHabitTitle);
    await logout(page);

    await registerUser(page, userB);
    await openHabits(page);
    await expectNoHabitCard(page, userAHabitTitle);

    await openAnalytics(page);
    await expect(page.getByText('No persisted activity yet')).toBeVisible();
    await expect(page.getByTestId('analytics-habit-library')).toContainText('0 habits');
    await expect(page.getByTestId('analytics-completions')).toContainText('0');
    await expect(page.getByTestId('analytics-progress-growth')).toContainText('0 XP');
    await expect(page.getByTestId('analytics-achievements')).toContainText('0/9');

    await page.getByTestId('nav-achievements').click();
    await expect(page.getByTestId('page-achievements')).toBeVisible();

    const firstStep = page.getByTestId('achievement-card').filter({
      hasText: 'First Step'
    });
    await expect(firstStep).toContainText('Locked');
    await expect(firstStep).toContainText('0/1 habit completions');
  });
});
