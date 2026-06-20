import { expect, test } from '@playwright/test';

import {
  completeQuest,
  createQuest,
  createTestUser,
  loginUser,
  logout,
  openAnalytics,
  openQuests,
  questCard,
  registerUser,
  uniqueRunId,
  waitForApiHealth
} from './support/levelhabit-e2e';

test.describe('main authenticated user journey', () => {
  test.beforeEach(async ({ request }) => {
    await waitForApiHealth(request);
  });

  test('registers, completes a quest, verifies progress, and persists after login', async ({
    page
  }) => {
    const runId = uniqueRunId('main');
    const user = createTestUser(runId, 'Main');
    const questTitle = `E2E Hard Quest ${runId}`;

    await registerUser(page, user);

    await openQuests(page);
    await createQuest(page, {
      title: questTitle,
      description: 'Complete a deterministic browser-driven habit.',
      category: 'Coding',
      difficulty: 'Hard',
      frequency: 'Daily'
    });

    const completedCard = await completeQuest(page, questTitle);
    await expect(completedCard).toContainText('+35 XP awarded');
    await expect(completedCard).toContainText('1-day streak');
    await expect(page.getByTestId('hero-total-xp')).toHaveText('35');
    await expect(page.getByTestId('hero-xp-progress')).toContainText('35/100 XP');
    await expect(page.getByTestId('hero-today-count')).toHaveText('1/1');

    await page.getByTestId('nav-achievements').click();
    await expect(page.getByTestId('page-achievements')).toBeVisible();

    const firstStep = page.getByTestId('achievement-card').filter({
      hasText: 'First Step'
    });
    await expect(firstStep).toContainText('Unlocked');
    await expect(firstStep).toContainText('1/1 quest completions');

    const hardMode = page.getByTestId('achievement-card').filter({
      hasText: 'Hard Mode'
    });
    await expect(hardMode).toContainText('Unlocked');

    await openAnalytics(page);
    await expect(page.getByTestId('analytics-quest-library')).toContainText('1 quest');
    await expect(page.getByTestId('analytics-completions')).toContainText('1');
    await expect(page.getByTestId('analytics-hero-growth')).toContainText('35 XP');
    await expect(page.getByTestId('analytics-achievements')).toContainText('2/9');
    await expect(page.getByTestId('analytics-current-streak-max')).toContainText('1d');
    await expect(page.getByTestId('analytics-recent-completion')).toContainText(questTitle);
    await expect(page.getByTestId('analytics-recent-completion')).toContainText('+35 XP');

    await logout(page);
    await loginUser(page, user);

    await openQuests(page);
    await expect(questCard(page, questTitle)).toContainText('Done today');
    await expect(questCard(page, questTitle)).toContainText('1-day streak');
    await expect(page.getByTestId('hero-total-xp')).toHaveText('35');
  });
});
