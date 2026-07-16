import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../app.routes';
import {
  AchievementApiService,
  type AchievementResponse
} from '../../achievements/achievement-api.service';
import {
  AnalyticsApiService,
  type AnalyticsSummaryResponse
} from '../../analytics/analytics-api.service';
import { AuthService } from '../../auth/auth.service';
import type { MeResponse } from '../../auth/auth.models';
import { LanguageService } from '../../i18n/language.service';
import {
  HABIT_DESCRIPTION_MAX_LENGTH,
  HABIT_TITLE_MAX_LENGTH,
  HabitApiService,
  type HabitCompletionResponse,
  type HabitResponse,
  type HabitUpsertRequest
} from '../../habits/habit-api.service';
import {
  REMINDER_DAYS,
  HabitReminderApiService,
  type HabitReminderResponse,
  type UpsertHabitReminderRequest
} from '../../reminders/habit-reminder-api.service';
import {
  DEFAULT_COMPLETED_IDS,
  PROTOTYPE_QUESTS
} from '../../state/levelhabit-prototype-data';
import {
  getButtonByText,
  getHabitToggle,
  renderPrototypeRoute,
  resetPrototypeStorage,
  AUTH_ME_RESPONSE,
  textContent
} from '../../test/prototype-test-utils';
import { PrototypePageComponent } from './prototype-page.component';

const API_QUEST: HabitResponse = {
  id: 'f3d9d772-8e0d-47f7-970b-56f757f85f4d',
  userId: AUTH_ME_RESPONSE.user.id,
  title: 'Morning training',
  description: 'Move before work.',
  category: 'Fitness',
  difficulty: 'Medium',
  frequency: 'Daily',
  xpReward: 20,
  isArchived: false,
  completedToday: false,
  completedTodayXpAwarded: null,
  completedTodayAtUtc: null,
  currentStreak: 3,
  bestStreak: 7,
  lastCompletedDateUtc: '2026-06-17',
  lastCompletedAtUtc: '2026-06-17T13:00:00Z',
  createdAtUtc: '2026-06-18T12:00:00Z',
  updatedAtUtc: '2026-06-18T12:00:00Z'
};

const COMPLETED_API_QUEST: HabitResponse = {
  ...API_QUEST,
  completedToday: true,
  completedTodayXpAwarded: 20,
  completedTodayAtUtc: '2026-06-18T13:00:00Z',
  currentStreak: 4,
  lastCompletedDateUtc: '2026-06-18',
  lastCompletedAtUtc: '2026-06-18T13:00:00Z'
};

const QUEST_COMPLETION_RESPONSE: HabitCompletionResponse = {
  id: '889c6254-b88e-4606-98eb-651453c82382',
  habitId: API_QUEST.id,
  userId: API_QUEST.userId,
  completionDateUtc: '2026-06-18',
  completedAtUtc: '2026-06-18T13:00:00Z',
  xpAwarded: 20,
  wasAlreadyCompleted: false,
  progressProfile: {
    ...AUTH_ME_RESPONSE.progressProfile,
    level: 2,
    totalXp: 120,
    xpInCurrentLevel: 20,
    xpRequiredForNextLevel: 200,
    xpToNextLevel: 180
  },
  habit: COMPLETED_API_QUEST
};

const DUPLICATE_QUEST_COMPLETION_RESPONSE: HabitCompletionResponse = {
  ...QUEST_COMPLETION_RESPONSE,
  wasAlreadyCompleted: true,
  progressProfile: {
    ...AUTH_ME_RESPONSE.progressProfile,
    level: 1,
    totalXp: 20,
    xpInCurrentLevel: 20,
    xpRequiredForNextLevel: 100,
    xpToNextLevel: 80
  },
  habit: {
    ...COMPLETED_API_QUEST,
    currentStreak: API_QUEST.currentStreak,
    lastCompletedDateUtc: '2026-06-18',
    lastCompletedAtUtc: '2026-06-18T13:00:00Z'
  }
};

const CREATED_API_QUEST_ID = '12e799df-aeca-4bd1-a548-f69f3fabd7d';

const DISABLED_REMINDER_RESPONSE: HabitReminderResponse = {
  id: null,
  habitId: API_QUEST.id,
  isEnabled: false,
  time: null,
  timeZoneId: null,
  daysOfWeek: [],
  lastTriggeredAtUtc: null,
  nextTriggerAtUtc: null,
  createdAtUtc: null,
  updatedAtUtc: null
};

const ENABLED_REMINDER_RESPONSE: HabitReminderResponse = {
  id: '2f398cae-2401-4d85-a8f9-491030e2bf6f',
  habitId: API_QUEST.id,
  isEnabled: true,
  time: '08:30',
  timeZoneId: 'America/Toronto',
  daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
  lastTriggeredAtUtc: null,
  nextTriggerAtUtc: '2026-06-19T12:30:00Z',
  createdAtUtc: '2026-06-18T12:00:00Z',
  updatedAtUtc: '2026-06-18T12:00:00Z'
};

const API_ACHIEVEMENTS: AchievementResponse[] = [
  {
    key: 'first-step',
    title: 'First Step',
    description: 'Complete your first habit.',
    rule: 'total-completions',
    isUnlocked: true,
    unlockedAtUtc: '2026-06-18T12:00:00Z',
    progress: 1,
    target: 1,
    progressText: '1/1 habit completions'
  },
  {
    key: 'getting-started',
    title: 'Getting Started',
    description: 'Complete 5 habits total.',
    rule: 'total-completions',
    isUnlocked: false,
    unlockedAtUtc: null,
    progress: 1,
    target: 5,
    progressText: '1/5 habit completions'
  }
];

const API_ANALYTICS_SUMMARY: AnalyticsSummaryResponse = {
  totalHabits: 3,
  activeHabits: 2,
  archivedHabits: 1,
  totalCompletions: 6,
  completionsToday: 1,
  completionsThisWeek: 4,
  completionsThisMonth: 5,
  totalXp: 320,
  currentLevel: 3,
  xpToNextLevel: 280,
  currentLevelProgressPercent: 7,
  currentStreakMax: 3,
  bestStreakMax: 5,
  achievementsUnlocked: 2,
  achievementsTotal: 9,
  completionsByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 1 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 1 },
    { dateUtc: '2026-06-18', value: 1 },
    { dateUtc: '2026-06-19', value: 1 }
  ],
  xpByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 35 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 10 },
    { dateUtc: '2026-06-18', value: 10 },
    { dateUtc: '2026-06-19', value: 10 }
  ],
  completionCountByCategory: [
    { name: 'Health', count: 3 },
    { name: 'Coding', count: 2 },
    { name: 'Chores', count: 1 }
  ],
  completionCountByDifficulty: [
    { name: 'Easy', count: 3 },
    { name: 'Hard', count: 2 },
    { name: 'Medium', count: 1 }
  ],
  recentCompletions: [
    {
      id: '889c6254-b88e-4606-98eb-651453c82382',
      habitId: API_QUEST.id,
      habitTitle: 'Morning training',
      category: 'Health',
      difficulty: 'Easy',
      completionDateUtc: '2026-06-19',
      completedAtUtc: '2026-06-19T08:00:00Z',
      xpAwarded: 10
    }
  ]
};

const EMPTY_API_ANALYTICS_SUMMARY: AnalyticsSummaryResponse = {
  totalHabits: 0,
  activeHabits: 0,
  archivedHabits: 0,
  totalCompletions: 0,
  completionsToday: 0,
  completionsThisWeek: 0,
  completionsThisMonth: 0,
  totalXp: 0,
  currentLevel: 1,
  xpToNextLevel: 100,
  currentLevelProgressPercent: 0,
  currentStreakMax: 0,
  bestStreakMax: 0,
  achievementsUnlocked: 0,
  achievementsTotal: 9,
  completionsByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 0 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 0 },
    { dateUtc: '2026-06-18', value: 0 },
    { dateUtc: '2026-06-19', value: 0 }
  ],
  xpByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 0 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 0 },
    { dateUtc: '2026-06-18', value: 0 },
    { dateUtc: '2026-06-19', value: 0 }
  ],
  completionCountByCategory: [],
  completionCountByDifficulty: [],
  recentCompletions: []
};

describe('Prototype routes', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it.each([
    ['/dashboard', 'Habit queue'],
    ['/habits', 'shown'],
    ['/progress', 'Personal progress'],
    ['/achievements', 'Unlocked'],
    ['/analytics', 'XP output']
  ])('renders %s without errors', async (path, expectedContent) => {
    const { nativeElement } = await renderPrototypeRoute(path);

    expect(textContent(nativeElement)).toContain(expectedContent);
  });

  it('renders an authenticated habits page in French after a runtime language change', async () => {
    const { harness, nativeElement } = await renderPrototypeRoute('/habits');

    TestBed.inject(LanguageService).setLanguage('fr');
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain('Habitudes actives');
    expect(textContent(nativeElement)).toContain('Toutes');
    expect(textContent(nativeElement)).toContain('Archivées');
  });
});

describe('Dashboard view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays authenticated progress profile data and the mock habit queue', async () => {
    const { nativeElement, state } = await renderPrototypeRoute('/dashboard');
    const pageText = textContent(nativeElement);

    expect(pageText).toContain(`Level ${AUTH_ME_RESPONSE.progressProfile.level}`);
    expect(pageText).toContain(AUTH_ME_RESPONSE.progressProfile.displayName);
    expect(state.levelTitle()).toBe(AUTH_ME_RESPONSE.progressProfile.displayName);
    expect(pageText).toContain(`${state.completedCount()}/${state.todayHabitCount()}`);

    for (const habit of PROTOTYPE_QUESTS.filter(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    )) {
      expect(pageText).toContain(habit.title);
    }
  });

  it('updates rendered completion when completing a mock habit', async () => {
    const { harness, nativeElement, state } = await renderPrototypeRoute('/dashboard');
    const habit = PROTOTYPE_QUESTS.find(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    );

    expect(habit).toBeDefined();

    getHabitToggle(nativeElement, habit!.title).click();
    harness.detectChanges();

    const pageText = textContent(nativeElement);

    expect(state.habits().find((candidate) => candidate.id === habit!.id)?.completed).toBe(true);
    expect(state.totalXp()).toBe(AUTH_ME_RESPONSE.progressProfile.totalXp);
    expect(pageText).toContain(`${state.completedCount()}/${state.todayHabitCount()}`);
  });
});

describe('Profile view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays authenticated user and progress profile data', async () => {
    const { nativeElement } = await renderPrototypeRoute('/progress');
    const pageText = textContent(nativeElement);

    expect(pageText).toContain(AUTH_ME_RESPONSE.user.displayName);
    expect(pageText).toContain(AUTH_ME_RESPONSE.user.email);
    expect(pageText).toContain(AUTH_ME_RESPONSE.progressProfile.displayName);
    expect(pageText).toContain(`Level ${AUTH_ME_RESPONSE.progressProfile.level}`);
  });
});

describe('Achievements view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays locked and unlocked achievements', async () => {
    const { nativeElement, state } = await renderPrototypeRoute('/achievements');
    const badges = Array.from(nativeElement.querySelectorAll('.achievement-state')).map(textContent);

    expect(state.achievements().some((achievement) => achievement.unlocked)).toBe(true);
    expect(state.achievements().some((achievement) => !achievement.unlocked)).toBe(true);
    expect(badges).toContain('Unlocked');
    expect(badges).toContain('Locked');
  });
});

describe('Achievements API view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('loads achievements from the API', async () => {
    const { achievementApi, nativeElement } = await renderApiAchievementRoute();

    expect(achievementApi.list).toHaveBeenCalled();
    expect(textContent(nativeElement)).toContain('First Step');
    expect(textContent(nativeElement)).toContain('Getting Started');
  });

  it('displays unlocked and locked API achievements', async () => {
    const { nativeElement } = await renderApiAchievementRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Unlocked');
    expect(pageText).toContain('Locked');
    expect(pageText).toContain('1/1 habit completions');
    expect(pageText).toContain('1/5 habit completions');
  });

  it('shows a friendly error when achievements cannot be loaded', async () => {
    const achievementApi = new AchievementApiServiceStub();
    achievementApi.list.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Server Error'
          })
      )
    );

    const { nativeElement } = await renderApiAchievementRoute(achievementApi);

    expect(textContent(nativeElement)).toContain(
      'Achievements could not be loaded.'
    );
  });
});

describe('Analytics API view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('loads the analytics summary from the API', async () => {
    const { analyticsApi, nativeElement } = await renderApiAnalyticsRoute();

    expect(analyticsApi.summary).toHaveBeenCalledTimes(1);
    expect(textContent(nativeElement)).toContain('Habit library');
    expect(textContent(nativeElement)).toContain('3 habits');
  });

  it('shows the loading state while analytics are pending', async () => {
    const analyticsApi = new AnalyticsApiServiceStub();
    const pendingSummary = new Subject<AnalyticsSummaryResponse>();
    analyticsApi.summary.mockReturnValueOnce(pendingSummary.asObservable());

    const { nativeElement, harness } = await renderApiAnalyticsRoute(analyticsApi);

    expect(textContent(nativeElement)).toContain('Loading analytics...');

    pendingSummary.next(API_ANALYTICS_SUMMARY);
    pendingSummary.complete();
    harness.detectChanges();
  });

  it('shows a friendly error when analytics cannot be loaded', async () => {
    const analyticsApi = new AnalyticsApiServiceStub();
    analyticsApi.summary.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Server Error'
          })
      )
    );

    const { nativeElement } = await renderApiAnalyticsRoute(analyticsApi);

    expect(textContent(nativeElement)).toContain('Analytics could not be loaded.');
  });

  it('displays empty/default analytics from the API', async () => {
    const analyticsApi = new AnalyticsApiServiceStub(EMPTY_API_ANALYTICS_SUMMARY);
    const { nativeElement } = await renderApiAnalyticsRoute(analyticsApi);
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('No persisted activity yet');
    expect(pageText).toContain('0 habits');
    expect(pageText).toContain('Level 1');
    expect(pageText).toContain('0/9');
    expect(pageText).toContain('Daily trends will appear');
    expect(pageText).toContain('No completion categories yet.');
    expect(pageText).toContain('Recent completions will appear');
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-completion-trend-bar"]').length
    ).toBe(7);
  });

  it('renders daily completion and XP trends from the API', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Last 7 days');
    expect(pageText).toContain('Daily completions');
    expect(pageText).toContain('XP earned');
    expect(pageText).toContain('4 total');
    expect(pageText).toContain('65 XP');
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-completion-trend-day"]').length
    ).toBe(7);
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-xp-trend-day"]').length
    ).toBe(7);
  });

  it('renders category and difficulty breakdowns from the API', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Category completions');
    expect(pageText).toContain('Challenge mix');
    expect(pageText).toContain('Health');
    expect(pageText).toContain('Coding');
    expect(pageText).toContain('Hard');
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-category-breakdown-row"]').length
    ).toBe(3);
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-difficulty-breakdown-row"]').length
    ).toBe(3);
  });

  it('renders level progress from the API', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const progress = nativeElement.querySelector(
      '[data-testid="analytics-level-progress"]'
    );

    expect(textContent(nativeElement)).toContain('Progress');
    expect(textContent(nativeElement)).toContain('Level 3');
    expect(progress).toBeInstanceOf(HTMLProgressElement);
    expect((progress as HTMLProgressElement).value).toBe(7);
  });

  it('renders real analytics summary values', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('6');
    expect(pageText).toContain('1 today');
    expect(pageText).toContain('4 this week');
    expect(pageText).toContain('320 XP');
    expect(pageText).toContain('Level 3');
    expect(pageText).toContain('280 XP to next');
    expect(pageText).toContain('2/9');
    expect(pageText).toContain('5 days');
    expect(pageText).toContain('Health');
    expect(pageText).toContain('Easy');
    expect(pageText).toContain('Morning training');
    expect(pageText).toContain('+10 XP');
  });
});

describe('Habits view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('filters visible habits by active and archived state', async () => {
    const { harness, nativeElement, state } = await renderPrototypeRoute('/habits');
    const completedHabit = state.habits().find((habit) => habit.completed);
    const activeHabit = state.habits().find((habit) => !habit.completed);

    expect(completedHabit).toBeDefined();
    expect(activeHabit).toBeDefined();

    expect(textContent(nativeElement)).toContain(activeHabit!.title);
    expect(textContent(nativeElement)).not.toContain(completedHabit!.title);

    getButtonByText(nativeElement, /^All$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain(completedHabit!.title);

    getButtonByText(nativeElement, /^Archived$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain('No habits shown');
    expect(textContent(nativeElement)).not.toContain(completedHabit!.title);
    expect(textContent(nativeElement)).not.toContain(activeHabit!.title);
  });
});

describe('Habits API view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('loads habits from the API', async () => {
    const { api, nativeElement } = await renderApiHabitRoute();

    expect(api.list).toHaveBeenCalledWith(true);
    expect(textContent(nativeElement)).toContain(API_QUEST.title);
    expect(textContent(nativeElement)).toContain(API_QUEST.description);
    expect(textContent(nativeElement)).toContain('3-day streak');
    expect(textContent(nativeElement)).toContain('Best: 7');
  });

  it('blocks habit creation until the initial API list has finished loading', async () => {
    const api = new HabitApiServiceStub([]);
    const pendingHabits = new Subject<HabitResponse[]>();
    api.list.mockReturnValueOnce(pendingHabits.asObservable());
    const { nativeElement, harness } = await renderApiHabitRoute(api);
    const submitButton = nativeElement.querySelector(
      '[data-testid="habit-submit-button"]'
    );

    expect(submitButton).toBeInstanceOf(HTMLButtonElement);
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    setFormField(harness, nativeElement, '#habit-title', 'Wait for the list');
    submitHabitForm(harness, nativeElement);
    expect(api.create).not.toHaveBeenCalled();

    pendingHabits.next([]);
    pendingHabits.complete();
    harness.detectChanges();

    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    submitHabitForm(harness, nativeElement);
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('creates habits through the API', async () => {
    const api = new HabitApiServiceStub([]);
    const { nativeElement, harness } = await renderApiHabitRoute(api);

    setFormField(harness, nativeElement, '#habit-title', 'Study sprint');
    setFormField(harness, nativeElement, '#habit-description', 'Read one chapter.');
    submitHabitForm(harness, nativeElement);

    expect(api.create).toHaveBeenCalledWith({
      title: 'Study sprint',
      description: 'Read one chapter.',
      category: 'Health',
      difficulty: 'Easy',
      frequency: 'Daily'
    });
    expect(textContent(nativeElement)).toContain('Study sprint');
  });

  it('associates the required title error and blocks an empty create', async () => {
    const api = new HabitApiServiceStub([]);
    const { nativeElement, harness } = await renderApiHabitRoute(api);

    submitHabitForm(harness, nativeElement);

    const title = nativeElement.querySelector('#habit-title') as HTMLInputElement;
    expect(api.create).not.toHaveBeenCalled();
    expect(textContent(nativeElement)).toContain('Title is required.');
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.getAttribute('aria-describedby')).toBe('habit-title-error');
  });

  it('accepts title and description values exactly at their backend limits', async () => {
    const api = new HabitApiServiceStub([]);
    const { nativeElement, harness } = await renderApiHabitRoute(api);
    const title = 'T'.repeat(HABIT_TITLE_MAX_LENGTH);
    const description = 'D'.repeat(HABIT_DESCRIPTION_MAX_LENGTH);

    setFormField(harness, nativeElement, '#habit-title', title);
    setFormField(harness, nativeElement, '#habit-description', description);
    submitHabitForm(harness, nativeElement);

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      title,
      description
    }));
  });

  it('shows field-specific overlength errors and saves after correction', async () => {
    const api = new HabitApiServiceStub([]);
    const { nativeElement, harness } = await renderApiHabitRoute(api);

    setFormField(
      harness,
      nativeElement,
      '#habit-title',
      'T'.repeat(HABIT_TITLE_MAX_LENGTH + 1)
    );
    setFormField(
      harness,
      nativeElement,
      '#habit-description',
      'D'.repeat(HABIT_DESCRIPTION_MAX_LENGTH + 1)
    );
    submitHabitForm(harness, nativeElement);

    const title = nativeElement.querySelector('#habit-title') as HTMLInputElement;
    const description = nativeElement.querySelector(
      '#habit-description'
    ) as HTMLTextAreaElement;
    expect(api.create).not.toHaveBeenCalled();
    expect(textContent(nativeElement)).toContain(
      `Title must be ${HABIT_TITLE_MAX_LENGTH} characters or fewer.`
    );
    expect(textContent(nativeElement)).toContain(
      `Description must be ${HABIT_DESCRIPTION_MAX_LENGTH} characters or fewer.`
    );
    expect(title.getAttribute('aria-describedby')).toBe('habit-title-error');
    expect(description.getAttribute('aria-describedby')).toBe(
      'habit-description-error'
    );

    setFormField(harness, nativeElement, '#habit-title', 'Corrected title');
    setFormField(harness, nativeElement, '#habit-description', 'Corrected description');
    submitHabitForm(harness, nativeElement);

    expect(api.create).toHaveBeenCalledOnce();
  });

  it('shows reminder fields when reminders are enabled', async () => {
    const { nativeElement, harness } = await renderApiHabitRoute();

    expect(nativeElement.querySelector('[data-testid="reminder-time-input"]')).toBeNull();

    const enabledInput = nativeElement.querySelector(
      '[data-testid="reminder-enabled-input"]'
    );

    expect(enabledInput).toBeInstanceOf(HTMLInputElement);

    (enabledInput as HTMLInputElement).click();
    harness.detectChanges();

    expect(nativeElement.querySelector('[data-testid="reminder-time-input"]')).not.toBeNull();
    expect(textContent(nativeElement)).toContain('Every day at 8:30 a.m.');
  });

  it('validates reminder days when reminders are enabled', async () => {
    const { nativeElement, harness } = await renderApiHabitRoute();
    const enabledInput = nativeElement.querySelector(
      '[data-testid="reminder-enabled-input"]'
    ) as HTMLInputElement;

    enabledInput.click();
    harness.detectChanges();

    for (const checkbox of Array.from(
      nativeElement.querySelectorAll('[data-testid="reminder-days"] input')
    )) {
      (checkbox as HTMLInputElement).click();
    }

    submitHabitForm(harness, nativeElement);

    expect(textContent(nativeElement)).toContain('Select at least one reminder day.');
  });

  it('saves a reminder after creating a habit', async () => {
    const api = new HabitApiServiceStub([]);
    const reminderApi = new HabitReminderApiServiceStub();
    const { nativeElement, harness } = await renderApiHabitRoute(
      api,
      new AchievementApiServiceStub(),
      reminderApi
    );

    setFormField(harness, nativeElement, '#habit-title', 'Study sprint');
    setFormField(harness, nativeElement, '#habit-description', 'Read one chapter.');

    const enabledInput = nativeElement.querySelector(
      '[data-testid="reminder-enabled-input"]'
    ) as HTMLInputElement;
    enabledInput.click();
    harness.detectChanges();

    submitHabitForm(harness, nativeElement);

    expect(reminderApi.upsert).toHaveBeenCalledWith(CREATED_API_QUEST_ID, {
      isEnabled: true,
      time: '08:30',
      timeZoneId: expect.any(String),
      daysOfWeek: [...REMINDER_DAYS]
    });
  });

  it('loads an existing reminder when editing a habit', async () => {
    const reminderApi = new HabitReminderApiServiceStub(ENABLED_REMINDER_RESPONSE);
    const { nativeElement, harness } = await renderApiHabitRoute(
      new HabitApiServiceStub(),
      new AchievementApiServiceStub(),
      reminderApi
    );

    getButtonByText(nativeElement, /^Edit$/).click();
    harness.detectChanges();

    expect(reminderApi.get).toHaveBeenCalledWith(API_QUEST.id);
    expect(textContent(nativeElement)).toContain(
      'Monday, Wednesday and Friday at 8:30 a.m.'
    );
  });

  it('updates habits through the API', async () => {
    const { api, nativeElement, harness } = await renderApiHabitRoute();

    getButtonByText(nativeElement, /^Edit$/).click();
    harness.detectChanges();

    setFormField(harness, nativeElement, '#habit-title', 'Evening training');
    setFormField(harness, nativeElement, '#habit-description', 'Move after work.');
    submitHabitForm(harness, nativeElement);

    expect(api.update).toHaveBeenCalledWith(API_QUEST.id, {
      title: 'Evening training',
      description: 'Move after work.',
      category: 'Fitness',
      difficulty: 'Medium',
      frequency: 'Daily'
    });
    expect(textContent(nativeElement)).toContain('Evening training');
  });

  it('applies the same maximum-length validation while editing', async () => {
    const { api, nativeElement, harness } = await renderApiHabitRoute();
    getButtonByText(nativeElement, /^Edit$/).click();
    harness.detectChanges();

    setFormField(
      harness,
      nativeElement,
      '#habit-title',
      'T'.repeat(HABIT_TITLE_MAX_LENGTH + 1)
    );
    setFormField(
      harness,
      nativeElement,
      '#habit-description',
      'D'.repeat(HABIT_DESCRIPTION_MAX_LENGTH + 1)
    );
    submitHabitForm(harness, nativeElement);

    expect(api.update).not.toHaveBeenCalled();
    expect(textContent(nativeElement)).toContain(
      `Title must be ${HABIT_TITLE_MAX_LENGTH} characters or fewer.`
    );
    expect(textContent(nativeElement)).toContain(
      `Description must be ${HABIT_DESCRIPTION_MAX_LENGTH} characters or fewer.`
    );

    const title = 'E'.repeat(HABIT_TITLE_MAX_LENGTH);
    const description = 'F'.repeat(HABIT_DESCRIPTION_MAX_LENGTH);
    setFormField(harness, nativeElement, '#habit-title', title);
    setFormField(harness, nativeElement, '#habit-description', description);
    submitHabitForm(harness, nativeElement);

    expect(api.update).toHaveBeenCalledWith(
      API_QUEST.id,
      expect.objectContaining({ title, description })
    );
  });

  it('archives habits through the API', async () => {
    const { api, nativeElement, harness } = await renderApiHabitRoute();

    getButtonByText(nativeElement, /^Archive$/).click();
    harness.detectChanges();

    expect(api.archive).toHaveBeenCalledWith(API_QUEST.id);
    expect(textContent(nativeElement)).toContain('No habits shown');
  });

  it('completes habits through the API', async () => {
    const { achievementApi, api, nativeElement, harness } = await renderApiHabitRoute();

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    expect(api.complete).toHaveBeenCalledWith(API_QUEST.id);
    expect(achievementApi.list).toHaveBeenCalledTimes(2);
    expect(textContent(nativeElement)).toContain('Done today');
    expect(textContent(nativeElement)).toContain('4-day streak');
    expect(textContent(nativeElement)).toContain('+20 XP awarded');
    expect(getButtonByText(nativeElement, /^Done today$/).disabled).toBe(true);
  });

  it('updates progress XP and level when completion returns updated profile data', async () => {
    const { nativeElement, harness } = await renderApiHabitRoute();

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Level 2');
    expect(pageText).toContain('120');
    expect(pageText).toContain('20/200 XP');
    expect(pageText).toContain('180 to next');
  });

  it('displays completed-today state from the API', async () => {
    const api = new HabitApiServiceStub([COMPLETED_API_QUEST]);
    const { nativeElement } = await renderApiHabitRoute(api);

    expect(textContent(nativeElement)).toContain('Done today');
    expect(getButtonByText(nativeElement, /^Done today$/).disabled).toBe(true);
  });

  it('does not call the completion API for a habit already completed today', async () => {
    const api = new HabitApiServiceStub([COMPLETED_API_QUEST]);
    const { nativeElement, harness } = await renderApiHabitRoute(api);

    getButtonByText(nativeElement, /^Done today$/).click();
    harness.detectChanges();

    expect(api.complete).not.toHaveBeenCalled();
  });

  it('does not show duplicate XP gain when the API returns an existing completion', async () => {
    const api = new HabitApiServiceStub();
    api.complete.mockReturnValueOnce(of(DUPLICATE_QUEST_COMPLETION_RESPONSE));
    const { nativeElement, harness } = await renderApiHabitRoute(api);

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain('Done today');
    expect(textContent(nativeElement)).toContain('3-day streak');
    expect(textContent(nativeElement)).not.toContain('4-day streak');
    expect(textContent(nativeElement)).not.toContain('+20 XP awarded');
  });

  it('shows a friendly error when habit completion fails', async () => {
    const api = new HabitApiServiceStub();
    api.complete.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Server Error'
          })
      )
    );
    const { nativeElement, harness } = await renderApiHabitRoute(api);

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain('Habit could not be completed.');
  });

  it('shows a friendly error when the API cannot be reached', async () => {
    const api = new HabitApiServiceStub();
    api.list.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            statusText: 'Unknown Error'
          })
      )
    );

    const { nativeElement } = await renderApiHabitRoute(api);

    expect(textContent(nativeElement)).toContain(
      'The backend is unavailable. Start the API and try again.'
    );
  });
});

class HabitApiServiceStub
  implements Pick<
    HabitApiService,
    'list' | 'get' | 'create' | 'update' | 'complete' | 'archive'
  >
{
  constructor(private readonly responses: HabitResponse[] = [API_QUEST]) {}

  readonly list = vi.fn((_includeArchived = true): Observable<HabitResponse[]> =>
    of(this.responses)
  );

  readonly get = vi.fn((id: string): Observable<HabitResponse> => {
    const response = this.responses.find((habit) => habit.id === id) ?? API_QUEST;

    return of(response);
  });

  readonly create = vi.fn((request: HabitUpsertRequest): Observable<HabitResponse> =>
    of({
      ...API_QUEST,
      ...request,
      id: CREATED_API_QUEST_ID,
      userId: AUTH_ME_RESPONSE.user.id,
      isArchived: false,
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDateUtc: null,
      lastCompletedAtUtc: null,
      createdAtUtc: '2026-06-19T12:00:00Z',
      updatedAtUtc: '2026-06-19T12:00:00Z'
    })
  );

  readonly update = vi.fn((
    id: string,
    request: HabitUpsertRequest
  ): Observable<HabitResponse> =>
    of({
      ...API_QUEST,
      ...request,
      id,
      updatedAtUtc: '2026-06-19T12:05:00Z'
    })
  );

  readonly complete = vi.fn((_id: string): Observable<HabitCompletionResponse> =>
    of(QUEST_COMPLETION_RESPONSE)
  );

  readonly archive = vi.fn((_id: string): Observable<void> => of(void 0));
}

class AchievementApiServiceStub implements Pick<AchievementApiService, 'list'> {
  constructor(
    private readonly responses: AchievementResponse[] = API_ACHIEVEMENTS
  ) {}

  readonly list = vi.fn((): Observable<AchievementResponse[]> =>
    of(this.responses)
  );
}

class AnalyticsApiServiceStub implements Pick<AnalyticsApiService, 'summary'> {
  constructor(
    private readonly response: AnalyticsSummaryResponse = API_ANALYTICS_SUMMARY
  ) {}

  readonly summary = vi.fn((): Observable<AnalyticsSummaryResponse> =>
    of(this.response)
  );
}

async function renderApiAchievementRoute(
  achievementApi: AchievementApiServiceStub = new AchievementApiServiceStub()
): Promise<{
  achievementApi: AchievementApiServiceStub;
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: createApiAuthService()
      },
      {
        provide: HabitApiService,
        useValue: new HabitApiServiceStub()
      },
      {
        provide: AchievementApiService,
        useValue: achievementApi
      },
      {
        provide: AnalyticsApiService,
        useValue: new AnalyticsApiServiceStub()
      },
      {
        provide: HabitReminderApiService,
        useValue: new HabitReminderApiServiceStub()
      }
    ]
  });

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/achievements', PrototypePageComponent);
  const nativeElement = harness.routeNativeElement;

  if (!nativeElement) {
    throw new Error('Achievements route did not render a native element.');
  }

  return {
    achievementApi,
    harness,
    nativeElement
  };
}

async function renderApiAnalyticsRoute(
  analyticsApi: AnalyticsApiServiceStub = new AnalyticsApiServiceStub()
): Promise<{
  analyticsApi: AnalyticsApiServiceStub;
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: createApiAuthService()
      },
      {
        provide: HabitApiService,
        useValue: new HabitApiServiceStub()
      },
      {
        provide: AchievementApiService,
        useValue: new AchievementApiServiceStub()
      },
      {
        provide: AnalyticsApiService,
        useValue: analyticsApi
      },
      {
        provide: HabitReminderApiService,
        useValue: new HabitReminderApiServiceStub()
      }
    ]
  });

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/analytics', PrototypePageComponent);
  const nativeElement = harness.routeNativeElement;

  if (!nativeElement) {
    throw new Error('Analytics route did not render a native element.');
  }

  return {
    analyticsApi,
    harness,
    nativeElement
  };
}

async function renderApiHabitRoute(
  api: HabitApiServiceStub = new HabitApiServiceStub(),
  achievementApi: AchievementApiServiceStub = new AchievementApiServiceStub(),
  reminderApi: HabitReminderApiServiceStub = new HabitReminderApiServiceStub()
): Promise<{
  achievementApi: AchievementApiServiceStub;
  api: HabitApiServiceStub;
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
  reminderApi: HabitReminderApiServiceStub;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: createApiAuthService()
      },
      {
        provide: HabitApiService,
        useValue: api
      },
      {
        provide: AchievementApiService,
        useValue: achievementApi
      },
      {
        provide: AnalyticsApiService,
        useValue: new AnalyticsApiServiceStub()
      },
      {
        provide: HabitReminderApiService,
        useValue: reminderApi
      }
    ]
  });

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/habits', PrototypePageComponent);
  const nativeElement = harness.routeNativeElement;

  if (!nativeElement) {
    throw new Error('Habits route did not render a native element.');
  }

  return {
    achievementApi,
    api,
    harness,
    nativeElement,
    reminderApi
  };
}

class HabitReminderApiServiceStub
  implements Pick<HabitReminderApiService, 'get' | 'upsert' | 'delete'>
{
  constructor(
    private readonly response: HabitReminderResponse = DISABLED_REMINDER_RESPONSE
  ) {}

  readonly get = vi.fn((habitId: string): Observable<HabitReminderResponse> =>
    of({
      ...this.response,
      habitId
    })
  );

  readonly upsert = vi.fn((
    habitId: string,
    request: UpsertHabitReminderRequest
  ): Observable<HabitReminderResponse> =>
    of({
      id: '2f398cae-2401-4d85-a8f9-491030e2bf6f',
      habitId,
      isEnabled: request.isEnabled,
      time: request.time,
      timeZoneId: request.timeZoneId,
      daysOfWeek: request.daysOfWeek ?? [],
      lastTriggeredAtUtc: null,
      nextTriggerAtUtc: request.isEnabled ? '2026-06-19T12:30:00Z' : null,
      createdAtUtc: '2026-06-18T12:00:00Z',
      updatedAtUtc: '2026-06-18T12:00:00Z'
    })
  );

  readonly delete = vi.fn((_habitId: string): Observable<void> => of(void 0));
}

function createApiAuthService(): Pick<
  AuthService,
  | 'authRequired'
  | 'canUsePrototypeRoutes'
  | 'ensureCurrentUser'
  | 'hasToken'
  | 'initializeAuth'
  | 'progressProfile'
  | 'isAuthenticated'
  | 'logout'
  | 'updateProgressProfile'
  | 'user'
> {
  const user = signal(AUTH_ME_RESPONSE.user);
  const progressProfile = signal(AUTH_ME_RESPONSE.progressProfile);
  const isAuthenticated = signal(true);
  const canUsePrototypeRoutes = signal(true);

  return {
    authRequired: true,
    canUsePrototypeRoutes: canUsePrototypeRoutes.asReadonly(),
    user: user.asReadonly(),
    progressProfile: progressProfile.asReadonly(),
    isAuthenticated: isAuthenticated.asReadonly(),
    hasToken: () => true,
    initializeAuth: () => of('authenticated'),
    ensureCurrentUser: (): Observable<MeResponse> => of(AUTH_ME_RESPONSE),
    updateProgressProfile: (nextProgressProfile) => progressProfile.set(nextProgressProfile),
    logout: () => of(undefined)
  };
}

function setFormField(
  harness: RouterTestingHarness,
  container: ParentNode,
  selector: string,
  value: string
): void {
  const field = container.querySelector(selector);

  if (
    !(field instanceof HTMLInputElement) &&
    !(field instanceof HTMLTextAreaElement)
  ) {
    throw new Error(`Form field not found: ${selector}`);
  }

  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  harness.detectChanges();
}

function submitHabitForm(
  harness: RouterTestingHarness,
  container: ParentNode
): void {
  const form = container.querySelector('.habit-editor form');

  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Habit form not found.');
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  harness.detectChanges();
}
