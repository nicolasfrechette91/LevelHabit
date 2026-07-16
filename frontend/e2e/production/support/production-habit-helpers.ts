import { randomUUID } from 'node:crypto';

import type { Locator, Page, TestInfo } from '@playwright/test';

import {
  assertPageUsable,
  expect,
  gotoProtectedRoute,
  waitForApiResponse
} from './production-fixture';

type HabitFilter = 'Active' | 'All' | 'Archived';

export function createUniqueHabitTitle(
  browserName: string,
  testPrefix: string,
  testInfo: TestInfo
): string {
  return [
    'E2E-TESTER',
    testPrefix,
    browserName,
    `retry-${testInfo.retry}`,
    Date.now(),
    randomUUID().slice(0, 8)
  ].join('-');
}

export async function waitForHabitList(page: Page): Promise<void> {
  await expect(page.getByTestId('page-habits')).toBeVisible();
  await expect(page.getByText('Loading habits...', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Habit filter' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
}

export async function setHabitFilter(
  page: Page,
  filter: HabitFilter
): Promise<void> {
  const filterGroup = page.getByRole('group', { name: 'Habit filter' });
  const button = filterGroup.getByRole('button', { name: filter, exact: true });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  if (await button.getAttribute('aria-pressed') === 'true') {
    return;
  }

  await button.scrollIntoViewIfNeeded();
  await button.click({ trial: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

export function habitCard(page: Page, title: string): Locator {
  return page.getByTestId('habit-card').filter({
    has: page.getByRole('heading', { level: 2, name: title, exact: true })
  });
}

export async function archiveHabitCard(
  page: Page,
  habitId: string,
  title: string
): Promise<void> {
  const card = habitCard(page, title);
  await expect(card).toHaveCount(1);
  const archiveResponsePromise = waitForApiResponse(
    page,
    'DELETE',
    `/api/habits/${habitId}`
  );
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: 'Archive', exact: true }).click();
  await archiveResponsePromise;
  await expect.poll(async () => {
    if (await card.count() === 0) {
      return 'removed';
    }

    return await card.getByText('Archived', { exact: true }).isVisible().catch(() => false)
      ? 'archived'
      : 'pending';
  }).not.toBe('pending');
}

export async function safelyArchiveTestHabit(
  page: Page,
  habitId: string | null,
  title: string,
  testInfo: TestInfo,
  originalTestFailed: boolean
): Promise<void> {
  if (!habitId || !title.startsWith('E2E-TESTER-')) {
    return;
  }

  try {
    assertPageUsable(page);
    await gotoProtectedRoute(page, 'habits');
    await waitForHabitList(page);
    await setHabitFilter(page, 'All');

    const card = habitCard(page, title);
    if (await card.count() === 0) {
      return;
    }

    if (await card.getByText('Archived', { exact: true }).isVisible().catch(() => false)) {
      return;
    }

    await archiveHabitCard(page, habitId, title);
  } catch (error: unknown) {
    await attachCleanupDiagnostics(page, testInfo, habitId, title, error);
    if (!originalTestFailed) {
      throw new Error(
        `Could not archive test habit "${title}" (${habitId}).`,
        { cause: error }
      );
    }
  }
}

async function attachCleanupDiagnostics(
  page: Page,
  testInfo: TestInfo,
  habitId: string,
  title: string,
  error: unknown
): Promise<void> {
  const pageClosed = page.isClosed();
  const browser = page.context().browser();
  const diagnostics = {
    browserConnected: browser?.isConnected() ?? null,
    contextPageCount: page.context().pages().length,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    habitId,
    pageClosed,
    title,
    url: pageClosed ? null : page.url()
  };

  await testInfo.attach('habit-cleanup-diagnostics', {
    body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
    contentType: 'application/json'
  });

  if (!pageClosed && (browser?.isConnected() ?? true)) {
    const screenshotPath = testInfo.outputPath('habit-cleanup-failed.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: 'disabled'
    }).catch(() => undefined);
    await testInfo.attach('habit-cleanup-failed', {
      path: screenshotPath,
      contentType: 'image/png'
    }).catch(() => undefined);
  }
}
