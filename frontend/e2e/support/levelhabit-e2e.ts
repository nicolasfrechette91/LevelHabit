import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

export type TestUser = Readonly<{
  email: string;
  password: string;
  displayName: string;
  progressDisplayName: string;
}>;

export type QuestDraft = Readonly<{
  title: string;
  description: string;
  category?: string;
  difficulty?: string;
  frequency?: string;
}>;

const apiBaseUrl = process.env['E2E_API_URL'] ?? 'http://localhost:5118/api';

export async function waitForApiHealth(request: APIRequestContext): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          const response = await request.get(`${apiBaseUrl}/health`, {
            timeout: 5_000
          });

          return response.ok();
        } catch {
          return false;
        }
      },
      {
        intervals: [1_000, 2_000, 5_000],
        timeout: 60_000,
        message: `Expected LevelHabit API health endpoint to respond at ${apiBaseUrl}/health`
      }
    )
    .toBe(true);
}

export function uniqueRunId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTestUser(runId: string, label: string): TestUser {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    email: `levelhabit-e2e+${runId}-${safeLabel}@example.test`,
    password: 'LevelHabitE2E123!',
    displayName: `E2E ${label}`,
    progressDisplayName: `Progress ${label}`
  };
}

export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/#/register');
  await expectAnonymousHeader(page);

  await page.getByTestId('register-email-input').fill(user.email);
  await page.getByTestId('register-password-input').fill(user.password);
  await page.getByTestId('register-display-name-input').fill(user.displayName);
  await page.getByTestId('register-progress-display-name-input').fill(user.progressDisplayName);
  await page.getByTestId('register-submit-button').click();

  await expect(page.getByTestId('page-dashboard')).toBeVisible();
  await expect(page.getByText(user.progressDisplayName)).toBeVisible();
  await expectAuthenticatedHeader(page);
}

export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/#/login');
  await expectAnonymousHeader(page);

  await page.getByTestId('login-email-input').fill(user.email);
  await page.getByTestId('login-password-input').fill(user.password);
  await page.getByTestId('login-submit-button').click();

  await expect(page.getByTestId('page-dashboard')).toBeVisible();
  await expect(page.getByText(user.progressDisplayName)).toBeVisible();
  await expectAuthenticatedHeader(page);
}

export async function logout(page: Page): Promise<void> {
  await page.getByTestId('logout-button').click();
  await expectAnonymousHeader(page);
  await expect(page.getByTestId('login-submit-button')).toBeVisible();
}

export async function openQuests(page: Page): Promise<void> {
  await page.getByTestId('nav-quests').click();
  await expect(page.getByTestId('page-quests')).toBeVisible();
  await waitForQuestsLoaded(page);
}

export async function openAnalytics(page: Page): Promise<void> {
  await page.getByTestId('nav-analytics').click();
  await expect(page.getByTestId('page-analytics')).toBeVisible();
  await expect(page.locator('text=Loading analytics...')).toHaveCount(0);
}

export async function createQuest(page: Page, draft: QuestDraft): Promise<Locator> {
  await page.getByTestId('quest-title-input').fill(draft.title);
  await page.getByTestId('quest-description-input').fill(draft.description);
  await page.getByLabel('Category').selectOption(draft.category ?? 'Coding');
  await page.getByLabel('Difficulty').selectOption(draft.difficulty ?? 'Hard');
  await page.getByLabel('Frequency').selectOption(draft.frequency ?? 'Daily');
  await page.getByTestId('quest-submit-button').click();

  const card = questCard(page, draft.title);
  await expect(card).toBeVisible();

  return card;
}

export async function completeQuest(page: Page, title: string): Promise<Locator> {
  const card = questCard(page, title);
  await card.getByTestId('quest-complete-button').click();

  await expect(card).toContainText('Done today');
  await expect(card.getByTestId('quest-complete-button')).toBeDisabled();

  return card;
}

export function questCard(page: Page, title: string): Locator {
  return page.getByTestId('quest-card').filter({ hasText: title });
}

export async function expectNoQuestCard(page: Page, title: string): Promise<void> {
  await waitForQuestsLoaded(page);
  await expect(questCard(page, title)).toHaveCount(0);
}

async function waitForQuestsLoaded(page: Page): Promise<void> {
  await expect(page.locator('text=Loading quests...')).toHaveCount(0);
}

async function expectAnonymousHeader(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'LevelHabit' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(0);
  await expect(page.getByTestId('logout-button')).toHaveCount(0);
  await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
}

async function expectAuthenticatedHeader(page: Page): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByTestId('nav-dashboard')).toBeVisible();
  await expect(page.getByTestId('nav-quests')).toBeVisible();
  await expect(page.getByTestId('nav-progress')).toBeVisible();
  await expect(page.getByTestId('nav-achievements')).toBeVisible();
  await expect(page.getByTestId('nav-analytics')).toBeVisible();
  await expect(page.getByTestId('logout-button')).toBeVisible();
}
