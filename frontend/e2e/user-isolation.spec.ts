import { expect, test } from '@playwright/test';

import {
  completeQuest,
  createQuest,
  createTestUser,
  expectNoQuestCard,
  logout,
  openAnalytics,
  openQuests,
  registerUser,
  uniqueRunId,
  waitForApiHealth
} from './support/levelhabit-e2e';

test.describe('user data isolation', () => {
  test.beforeEach(async ({ request }) => {
    await waitForApiHealth(request);
  });

  test('keeps quests, analytics, and achievements scoped to the signed-in user', async ({
    page
  }) => {
    const runId = uniqueRunId('isolation');
    const userA = createTestUser(runId, 'User A');
    const userB = createTestUser(runId, 'User B');
    const userAQuestTitle = `E2E User A Quest ${runId}`;

    await registerUser(page, userA);
    await openQuests(page);
    await createQuest(page, {
      title: userAQuestTitle,
      description: 'A quest that must stay private to User A.',
      category: 'Health',
      difficulty: 'Hard',
      frequency: 'Daily'
    });
    await completeQuest(page, userAQuestTitle);
    await logout(page);

    await registerUser(page, userB);
    await openQuests(page);
    await expectNoQuestCard(page, userAQuestTitle);

    await openAnalytics(page);
    await expect(page.getByText('No persisted activity yet')).toBeVisible();
    await expect(page.getByTestId('analytics-quest-library')).toContainText('0 quests');
    await expect(page.getByTestId('analytics-completions')).toContainText('0');
    await expect(page.getByTestId('analytics-hero-growth')).toContainText('0 XP');
    await expect(page.getByTestId('analytics-achievements')).toContainText('0/9');

    await page.getByTestId('nav-achievements').click();
    await expect(page.getByTestId('page-achievements')).toBeVisible();

    const firstStep = page.getByTestId('achievement-card').filter({
      hasText: 'First Step'
    });
    await expect(firstStep).toContainText('Locked');
    await expect(firstStep).toContainText('0/1 quest completions');
  });
});
