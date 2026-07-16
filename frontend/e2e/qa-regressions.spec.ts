import { expect, test, type Page, type Route } from '@playwright/test';

const AUTH_RESPONSE = {
  accessToken: 'mock-access-token',
  expiresAtUtc: '2099-01-01T00:00:00Z',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'player@example.com',
    displayName: 'Player One',
    createdAtUtc: '2026-06-17T20:00:00Z'
  },
  progressProfile: {
    id: '22222222-2222-4222-8222-222222222222',
    displayName: 'Morning Warden',
    level: 1,
    totalXp: 0,
    xpInCurrentLevel: 0,
    xpRequiredForNextLevel: 100,
    xpToNextLevel: 100,
    currentStreak: 0,
    createdAtUtc: '2026-06-17T20:00:00Z'
  }
} as const;

test.describe('QA remediation regressions', () => {
  test('guards anonymous routes on navigation and full-page refresh', async ({ page }) => {
    const api = await installMockApi(page);

    await page.goto('/#/login');
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    await page.goto('/#/register');
    await expect(page.getByTestId('register-submit-button')).toBeVisible();

    await login(page);
    expect(api.sessionActive()).toBe(true);
    await page.goto('/#/login');
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    await expect(page.getByTestId('login-submit-button')).toHaveCount(0);
    await page.goto('/#/register');
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    await expect(page.getByTestId('register-submit-button')).toHaveCount(0);
  });

  test('keeps rapid click and Enter login submissions single-flight', async ({ page }) => {
    const api = await installMockApi(page);
    await page.goto('/#/login');
    await fillCredentials(page);
    await page.getByTestId('login-submit-button').dblclick();
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    expect(api.loginRequests()).toBe(1);

    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    await fillCredentials(page);
    await Promise.all([
      page.getByTestId('login-password-input').press('Enter'),
      page.getByTestId('login-password-input').press('Enter')
    ]);
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    expect(api.loginRequests()).toBe(2);
  });

  test('validates habit limits accessibly in create and edit and saves corrections', async ({ page }) => {
    await installMockApi(page);
    await login(page);
    await page.getByTestId('nav-habits').click();
    const title = page.getByLabel('Title');
    const description = page.getByLabel('Description');

    await page.getByTestId('habit-submit-button').click();
    await expect(page.getByText('Title is required.')).toBeVisible();
    await expect(title).toHaveAttribute('aria-describedby', 'habit-title-error');

    await title.fill('T'.repeat(140));
    await description.fill('D'.repeat(1000));
    await page.getByTestId('habit-submit-button').click();
    const card = page.getByTestId('habit-card').filter({ hasText: 'T'.repeat(140) });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Edit' }).click();

    await title.fill('T'.repeat(141));
    await description.fill('D'.repeat(1001));
    await page.getByTestId('habit-submit-button').click();
    await expect(page.getByText('Title must be 140 characters or fewer.')).toBeVisible();
    await expect(page.getByText('Description must be 1000 characters or fewer.')).toBeVisible();
    await expect(title).toHaveAttribute('aria-describedby', 'habit-title-error');
    await expect(description).toHaveAttribute(
      'aria-describedby',
      'habit-description-error'
    );

    await title.fill('Corrected habit');
    await description.fill('Corrected description');
    await page.getByTestId('habit-submit-button').click();
    await expect(page.getByTestId('habit-card').filter({ hasText: 'Corrected habit' })).toBeVisible();
  });

  test('keeps the refresh token out of JavaScript storage and restores then clears sessions', async ({ page }) => {
    const api = await installMockApi(page);
    const loginResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/login')
    );
    await login(page);
    const loginJson = await (await loginResponsePromise).json() as Record<string, unknown>;

    expect(loginJson).not.toHaveProperty('refreshToken');
    expect(await page.evaluate(() => localStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('levelhabit.auth.v1'))).toBeNull();
    const refreshCookie = (await page.context().cookies()).find((cookie) =>
      cookie.name === 'LevelHabit.Refresh.Development'
    );
    expect(refreshCookie?.httpOnly).toBe(true);

    await page.reload();
    await expect(page.getByTestId('page-dashboard')).toBeVisible();
    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    expect(api.sessionActive()).toBe(false);
    await page.reload();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
  });

  test('manages modal notification focus and keyboard containment', async ({ page }) => {
    await installMockApi(page);
    await login(page);
    const trigger = page.getByRole('button', { name: 'Notifications' });
    await trigger.focus();
    await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Notifications' });

    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeFocused();
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

async function installMockApi(page: Page): Promise<{
  loginRequests: () => number;
  sessionActive: () => boolean;
}> {
  let activeSession = false;
  let loginRequestCount = 0;
  let habits: Record<string, unknown>[] = [];

  await page.route('http://localhost:5118/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await fulfill(route, 204, null);
      return;
    }

    if (pathname.endsWith('/health')) {
      await fulfill(route, 200, 'Healthy', 'text/plain');
      return;
    }

    if (pathname.endsWith('/auth/csrf')) {
      await fulfill(route, 200, { csrfToken: 'mock-csrf-token' }, 'application/json', {
        'set-cookie': 'LevelHabit.Csrf.Development=mock-csrf-token; Path=/api/auth; HttpOnly; SameSite=Lax'
      });
      return;
    }

    if (pathname.endsWith('/auth/login')) {
      loginRequestCount += 1;
      activeSession = true;
      await fulfill(route, 200, AUTH_RESPONSE, 'application/json', {
        'set-cookie': 'LevelHabit.Refresh.Development=mock-refresh-token; Path=/api/auth; HttpOnly; SameSite=Lax'
      });
      return;
    }

    if (pathname.endsWith('/auth/refresh')) {
      await fulfill(
        route,
        activeSession ? 200 : 401,
        activeSession ? AUTH_RESPONSE : { title: 'Unauthorized' }
      );
      return;
    }

    if (pathname.endsWith('/auth/logout')) {
      activeSession = false;
      await page.context().clearCookies();
      await fulfill(route, 204, null);
      return;
    }

    if (pathname.endsWith('/auth/me')) {
      await fulfill(route, activeSession ? 200 : 401, {
        user: AUTH_RESPONSE.user,
        progressProfile: AUTH_RESPONSE.progressProfile
      });
      return;
    }

    if (pathname.endsWith('/habits') && request.method() === 'GET') {
      await fulfill(route, activeSession ? 200 : 401, habits);
      return;
    }

    if (pathname.endsWith('/habits') && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const habit = createHabit(body);
      habits = [...habits, habit];
      await fulfill(route, 201, habit);
      return;
    }

    const habitMatch = pathname.match(/\/habits\/([^/]+)$/);

    if (habitMatch && request.method() === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const habit = createHabit(body, habitMatch[1]);
      habits = habits.map((candidate) => candidate['id'] === habit['id'] ? habit : candidate);
      await fulfill(route, 200, habit);
      return;
    }

    if (pathname.endsWith('/reminder') && request.method() === 'GET') {
      await fulfill(route, 200, {
        id: null,
        habitId: pathname.split('/').at(-2),
        isEnabled: false,
        time: null,
        timeZoneId: null,
        daysOfWeek: [],
        lastTriggeredAtUtc: null,
        nextTriggerAtUtc: null,
        createdAtUtc: null,
        updatedAtUtc: null
      });
      return;
    }

    if (pathname.endsWith('/notifications/unread-count')) {
      await fulfill(route, 200, { unreadCount: 0 });
      return;
    }

    if (pathname.endsWith('/notifications')) {
      await fulfill(route, 200, { notifications: [], unreadCount: 0 });
      return;
    }

    if (pathname.endsWith('/achievements')) {
      await fulfill(route, 200, []);
      return;
    }

    await fulfill(route, activeSession ? 200 : 401, {});
  });

  return {
    loginRequests: () => loginRequestCount,
    sessionActive: () => activeSession
  };
}

async function login(page: Page): Promise<void> {
  await page.goto('/#/login');
  await fillCredentials(page);
  await page.getByTestId('login-submit-button').click();
  await expect(page.getByTestId('page-dashboard')).toBeVisible();
}

async function fillCredentials(page: Page): Promise<void> {
  await page.getByTestId('login-email-input').fill('player@example.com');
  await page.getByTestId('login-password-input').fill('CorrectHorse123!');
}

async function fulfill(
  route: Route,
  status: number,
  body: unknown,
  contentType = 'application/json',
  headers: Record<string, string> = {}
): Promise<void> {
  await route.fulfill({
    status,
    contentType,
    body: body === null
      ? ''
      : typeof body === 'string'
        ? body
        : JSON.stringify(body),
    headers: {
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'authorization,content-type,x-levelhabit-csrf',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-origin': 'http://localhost:4200',
      ...headers
    }
  });
}

function createHabit(
  body: Record<string, unknown>,
  id = '33333333-3333-4333-8333-333333333333'
): Record<string, unknown> {
  return {
    id,
    userId: AUTH_RESPONSE.user.id,
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
  };
}
