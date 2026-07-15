import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AchievementApiService,
  type AchievementResponse
} from '../achievements/achievement-api.service';
import {
  AnalyticsApiService,
  type AnalyticsSummaryResponse
} from '../analytics/analytics-api.service';
import type { AuthUser, ProgressProfile } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { HabitApiService, type HabitResponse } from '../habits/habit-api.service';
import {
  BASE_XP,
  DEFAULT_COMPLETED_IDS,
  PROTOTYPE_QUESTS
} from './levelhabit-prototype-data';
import { LevelHabitStateService } from './levelhabit-state.service';

const USER_A: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user-a@example.com',
  displayName: 'User A',
  createdAtUtc: '2026-06-18T12:00:00Z'
};

const USER_B: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'user-b@example.com',
  displayName: 'User B',
  createdAtUtc: '2026-06-18T12:00:00Z'
};

const PROGRESS_PROFILE_A: ProgressProfile = {
  id: '33333333-3333-4333-8333-333333333333',
  displayName: 'Hydration Knight',
  level: 2,
  totalXp: 120,
  xpInCurrentLevel: 20,
  xpRequiredForNextLevel: 200,
  xpToNextLevel: 180,
  currentStreak: 4,
  createdAtUtc: '2026-06-18T12:00:00Z'
};

const PROGRESS_PROFILE_B: ProgressProfile = {
  id: '44444444-4444-4444-8444-444444444444',
  displayName: 'Fresh Start',
  level: 1,
  totalXp: 0,
  xpInCurrentLevel: 0,
  xpRequiredForNextLevel: 100,
  xpToNextLevel: 100,
  currentStreak: 0,
  createdAtUtc: '2026-06-18T12:00:00Z'
};

const USER_A_QUEST = createHabitResponse(
  USER_A.id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Drink Water',
  true
);

const USER_B_QUEST = createHabitResponse(
  USER_B.id,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Read Book'
);

const USER_A_ACHIEVEMENT: AchievementResponse = {
  key: 'first-step',
  title: 'First Step',
  description: 'Complete your first habit.',
  rule: 'total-completions',
  isUnlocked: true,
  unlockedAtUtc: '2026-06-18T13:00:00Z',
  progress: 1,
  target: 1,
  progressText: '1/1 habit completions'
};

const USER_B_ACHIEVEMENT: AchievementResponse = {
  ...USER_A_ACHIEVEMENT,
  isUnlocked: false,
  unlockedAtUtc: null,
  progress: 0,
  progressText: '0/1 habit completions'
};

const USER_A_ANALYTICS = createAnalyticsSummary({
  totalHabits: 1,
  activeHabits: 1,
  totalCompletions: 1,
  totalXp: PROGRESS_PROFILE_A.totalXp,
  currentLevel: PROGRESS_PROFILE_A.level,
  currentStreakMax: PROGRESS_PROFILE_A.currentStreak,
  achievementsUnlocked: 1,
  completionsByDay: createDailyMetrics({ '2026-06-18': 1 }),
  xpByDay: createDailyMetrics({ '2026-06-18': USER_A_QUEST.xpReward }),
  recentCompletions: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      habitId: USER_A_QUEST.id,
      habitTitle: USER_A_QUEST.title,
      category: USER_A_QUEST.category,
      difficulty: USER_A_QUEST.difficulty,
      completionDateUtc: '2026-06-18',
      completedAtUtc: '2026-06-18T13:00:00Z',
      xpAwarded: USER_A_QUEST.xpReward
    }
  ]
});

const USER_B_ANALYTICS = createAnalyticsSummary();

describe('LevelHabitStateService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        {
          provide: AuthService,
          useValue: createPrototypeAuthService()
        }
      ]
    });
    localStorage.clear();
  });

  it('starts from the centralized prototype habit data', () => {
    const state = TestBed.inject(LevelHabitStateService);

    expect(state.habits()).toHaveLength(PROTOTYPE_QUESTS.length);
    expect(state.completedCount()).toBe(DEFAULT_COMPLETED_IDS.length);
    expect(state.totalXp()).toBe(
      BASE_XP +
        PROTOTYPE_QUESTS
          .filter((habit) => DEFAULT_COMPLETED_IDS.includes(habit.id))
          .reduce((total, habit) => total + habit.xp, 0)
    );
  });

  it('updates completion, XP, and level progress when a mock habit is completed', () => {
    const state = TestBed.inject(LevelHabitStateService);
    const habit = PROTOTYPE_QUESTS.find(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    );

    expect(habit).toBeDefined();

    const startingXp = state.totalXp();
    const startingProgress = state.levelProgress();

    state.toggleHabit(habit!.id);

    expect(state.habits().find((candidate) => candidate.id === habit!.id)?.completed).toBe(true);
    expect(state.totalXp()).toBe(startingXp + habit!.xp);
    expect(state.levelProgress()).toBeGreaterThan(startingProgress);
  });

  it('keeps today totals valid when a completed habit is archived', () => {
    const { auth, habitApi, state } = setupAuthenticatedState();
    auth.loginAs(USER_A, PROGRESS_PROFILE_A);
    TestBed.tick();
    habitApi.setResponses(USER_A.id, [{ ...USER_A_QUEST, isArchived: true }]);

    state.loadHabits();

    expect(state.completedCount()).toBe(1);
    expect(state.habitCount()).toBe(0);
    expect(state.todayHabitCount()).toBe(1);
    expect(state.completionPercent()).toBe(100);
    expect(state.weeklyHistory().at(-1)).toMatchObject({ completed: 1, total: 1 });
  });

  it('clears authenticated user-specific state on logout', () => {
    const { achievementApi, analyticsApi, auth, habitApi, state } =
      setupAuthenticatedState();
    auth.loginAs(USER_A, PROGRESS_PROFILE_A);
    TestBed.tick();

    habitApi.setResponses(USER_A.id, [USER_A_QUEST]);
    achievementApi.setResponses(USER_A.id, [USER_A_ACHIEVEMENT]);
    analyticsApi.setResponse(USER_A.id, USER_A_ANALYTICS);

    state.loadHabits();
    state.loadAchievements();
    state.loadAnalytics();

    expect(state.habits().map((habit) => habit.title)).toEqual(['Drink Water']);
    expect(state.unlockedAchievements()).toHaveLength(1);
    expect(state.analyticsSummary()?.totalXp).toBe(PROGRESS_PROFILE_A.totalXp);
    expect(state.totalXp()).toBe(PROGRESS_PROFILE_A.totalXp);
    expect(state.currentStreak()).toBe(PROGRESS_PROFILE_A.currentStreak);

    auth.logout();
    TestBed.tick();

    expect(auth.user()).toBeNull();
    expect(state.habits()).toEqual([]);
    expect(state.achievements()).toEqual([]);
    expect(state.analyticsSummary()).toBeNull();
    expect(state.totalXp()).toBe(0);
    expect(state.level()).toBe(1);
    expect(state.currentStreak()).toBe(0);
    expect(state.habitsLoading()).toBe(false);
    expect(state.achievementsLoading()).toBe(false);
    expect(state.analyticsLoading()).toBe(false);
    expect(state.habitError()).toBeNull();
    expect(state.achievementError()).toBeNull();
    expect(state.analyticsError()).toBeNull();
  });

  it('clears and reloads habits when switching authenticated users', () => {
    const { auth, habitApi, state } = setupAuthenticatedState();
    habitApi.setResponses(USER_A.id, [USER_A_QUEST]);
    habitApi.setResponses(USER_B.id, [USER_B_QUEST]);

    auth.loginAs(USER_A, PROGRESS_PROFILE_A);
    TestBed.tick();
    state.loadHabits();

    expect(state.habits().map((habit) => habit.title)).toEqual(['Drink Water']);

    auth.loginAs(USER_B, PROGRESS_PROFILE_B);
    TestBed.tick();

    expect(state.habits()).toEqual([]);
    expect(state.totalXp()).toBe(0);
    expect(state.currentStreak()).toBe(0);

    state.loadHabits();

    expect(habitApi.list).toHaveBeenCalledTimes(2);
    expect(state.habits().map((habit) => habit.title)).toEqual(['Read Book']);
    expect(state.habits().some((habit) => habit.title === 'Drink Water')).toBe(false);
  });

  it('clears and reloads achievements and analytics on account switch', () => {
    const { achievementApi, analyticsApi, auth, state } = setupAuthenticatedState();
    achievementApi.setResponses(USER_A.id, [USER_A_ACHIEVEMENT]);
    achievementApi.setResponses(USER_B.id, [USER_B_ACHIEVEMENT]);
    analyticsApi.setResponse(USER_A.id, USER_A_ANALYTICS);
    analyticsApi.setResponse(USER_B.id, USER_B_ANALYTICS);

    auth.loginAs(USER_A, PROGRESS_PROFILE_A);
    TestBed.tick();
    state.loadAchievements();
    state.loadAnalytics();

    expect(state.unlockedAchievements()).toHaveLength(1);
    expect(state.analyticsSummary()?.recentCompletions[0]?.habitTitle).toBe(
      'Drink Water'
    );

    auth.loginAs(USER_B, PROGRESS_PROFILE_B);
    TestBed.tick();

    expect(state.achievements()).toEqual([]);
    expect(state.analyticsSummary()).toBeNull();

    state.loadAchievements();
    state.loadAnalytics();

    expect(achievementApi.list).toHaveBeenCalledTimes(2);
    expect(analyticsApi.summary).toHaveBeenCalledTimes(2);
    expect(state.unlockedAchievements()).toHaveLength(0);
    expect(state.analyticsSummary()?.totalCompletions).toBe(0);
    expect(
      state.analyticsSummary()?.recentCompletions.some(
        (completion) => completion.habitTitle === 'Drink Water'
      )
    ).toBe(false);
  });
});

function createHabitResponse(
  userId: string,
  id: string,
  title: string,
  completedToday = false
): HabitResponse {
  return {
    id,
    userId,
    title,
    description: `${title} description`,
    category: 'Health',
    difficulty: 'Easy',
    frequency: 'Daily',
    xpReward: 10,
    isArchived: false,
    completedToday,
    completedTodayXpAwarded: completedToday ? 10 : null,
    completedTodayAtUtc: completedToday ? '2026-06-18T13:00:00Z' : null,
    currentStreak: completedToday ? 1 : 0,
    bestStreak: completedToday ? 1 : 0,
    lastCompletedDateUtc: completedToday ? '2026-06-18' : null,
    lastCompletedAtUtc: completedToday ? '2026-06-18T13:00:00Z' : null,
    createdAtUtc: '2026-06-18T12:00:00Z',
    updatedAtUtc: '2026-06-18T12:00:00Z'
  };
}

function createAnalyticsSummary(
  overrides: Partial<AnalyticsSummaryResponse> = {}
): AnalyticsSummaryResponse {
  return {
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
    achievementsTotal: 1,
    completionsByDay: createDailyMetrics(),
    xpByDay: createDailyMetrics(),
    completionCountByCategory: [],
    completionCountByDifficulty: [],
    recentCompletions: [],
    ...overrides
  };
}

function createDailyMetrics(
  valuesByDate: Readonly<Record<string, number>> = {}
): NonNullable<AnalyticsSummaryResponse['completionsByDay']> {
  return [
    '2026-06-13',
    '2026-06-14',
    '2026-06-15',
    '2026-06-16',
    '2026-06-17',
    '2026-06-18',
    '2026-06-19'
  ].map((dateUtc) => ({
    dateUtc,
    value: valuesByDate[dateUtc] ?? 0
  }));
}

function setupAuthenticatedState(): {
  achievementApi: AchievementApiServiceStub;
  analyticsApi: AnalyticsApiServiceStub;
  auth: MutableAuthServiceStub;
  habitApi: HabitApiServiceStub;
  state: LevelHabitStateService;
} {
  TestBed.resetTestingModule();
  localStorage.clear();

  const auth = new MutableAuthServiceStub();
  const habitApi = new HabitApiServiceStub(auth);
  const achievementApi = new AchievementApiServiceStub(auth);
  const analyticsApi = new AnalyticsApiServiceStub(auth);

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: HabitApiService, useValue: habitApi },
      { provide: AchievementApiService, useValue: achievementApi },
      { provide: AnalyticsApiService, useValue: analyticsApi }
    ]
  });

  return {
    achievementApi,
    analyticsApi,
    auth,
    habitApi,
    state: TestBed.inject(LevelHabitStateService)
  };
}

function createPrototypeAuthService(): Pick<
  AuthService,
  'authRequired' | 'progressProfile' | 'isAuthenticated' | 'updateProgressProfile' | 'user'
> {
  const user = signal<AuthUser | null>(null);
  const progressProfile = signal<ProgressProfile | null>(null);
  const isAuthenticated = signal(false);

  return {
    authRequired: false,
    user: user.asReadonly(),
    progressProfile: progressProfile.asReadonly(),
    isAuthenticated: isAuthenticated.asReadonly(),
    updateProgressProfile: (nextProgressProfile) => progressProfile.set(nextProgressProfile)
  };
}

class MutableAuthServiceStub {
  readonly authRequired = true;
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly progressProfileSignal = signal<ProgressProfile | null>(null);
  private readonly isAuthenticatedSignal = signal(false);

  readonly user = this.userSignal.asReadonly();
  readonly progressProfile = this.progressProfileSignal.asReadonly();
  readonly isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  readonly canUsePrototypeRoutes = this.isAuthenticatedSignal.asReadonly();

  hasToken(): boolean {
    return this.isAuthenticatedSignal();
  }

  currentUserId(): string | null {
    return this.userSignal()?.id ?? null;
  }

  loginAs(user: AuthUser, progressProfile: ProgressProfile): void {
    this.isAuthenticatedSignal.set(true);
    this.userSignal.set(user);
    this.progressProfileSignal.set(progressProfile);
  }

  logout(): void {
    this.isAuthenticatedSignal.set(false);
    this.userSignal.set(null);
    this.progressProfileSignal.set(null);
  }

  updateProgressProfile(progressProfile: ProgressProfile): void {
    this.progressProfileSignal.set(progressProfile);
  }
}

class HabitApiServiceStub {
  private readonly responsesByUserId = new Map<string, HabitResponse[]>();

  constructor(private readonly auth: MutableAuthServiceStub) {}

  readonly list = vi.fn((_includeArchived = true): Observable<HabitResponse[]> =>
    of(this.responsesByUserId.get(this.auth.currentUserId() ?? '') ?? [])
  );

  setResponses(userId: string, responses: HabitResponse[]): void {
    this.responsesByUserId.set(userId, responses);
  }
}

class AchievementApiServiceStub {
  private readonly responsesByUserId = new Map<string, AchievementResponse[]>();

  constructor(private readonly auth: MutableAuthServiceStub) {}

  readonly list = vi.fn((): Observable<AchievementResponse[]> =>
    of(this.responsesByUserId.get(this.auth.currentUserId() ?? '') ?? [])
  );

  setResponses(userId: string, responses: AchievementResponse[]): void {
    this.responsesByUserId.set(userId, responses);
  }
}

class AnalyticsApiServiceStub {
  private readonly responsesByUserId = new Map<string, AnalyticsSummaryResponse>();

  constructor(private readonly auth: MutableAuthServiceStub) {}

  readonly summary = vi.fn((): Observable<AnalyticsSummaryResponse> =>
    of(
      this.responsesByUserId.get(this.auth.currentUserId() ?? '')
        ?? createAnalyticsSummary()
    )
  );

  setResponse(userId: string, response: AnalyticsSummaryResponse): void {
    this.responsesByUserId.set(userId, response);
  }
}
