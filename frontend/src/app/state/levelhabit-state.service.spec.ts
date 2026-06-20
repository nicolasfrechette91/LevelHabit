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
import type { AuthUser, HeroProfile } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { QuestApiService, type QuestResponse } from '../quests/quest-api.service';
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

const HERO_A: HeroProfile = {
  id: '33333333-3333-4333-8333-333333333333',
  heroName: 'Hydration Knight',
  level: 2,
  totalXp: 120,
  xpInCurrentLevel: 20,
  xpRequiredForNextLevel: 200,
  xpToNextLevel: 180,
  currentStreak: 4,
  createdAtUtc: '2026-06-18T12:00:00Z'
};

const HERO_B: HeroProfile = {
  id: '44444444-4444-4444-8444-444444444444',
  heroName: 'Fresh Start',
  level: 1,
  totalXp: 0,
  xpInCurrentLevel: 0,
  xpRequiredForNextLevel: 100,
  xpToNextLevel: 100,
  currentStreak: 0,
  createdAtUtc: '2026-06-18T12:00:00Z'
};

const USER_A_QUEST = createQuestResponse(
  USER_A.id,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Drink Water',
  true
);

const USER_B_QUEST = createQuestResponse(
  USER_B.id,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Read Book'
);

const USER_A_ACHIEVEMENT: AchievementResponse = {
  key: 'first-step',
  title: 'First Step',
  description: 'Complete your first quest.',
  rule: 'total-completions',
  isUnlocked: true,
  unlockedAtUtc: '2026-06-18T13:00:00Z',
  progress: 1,
  target: 1,
  progressText: '1/1 quest completions'
};

const USER_B_ACHIEVEMENT: AchievementResponse = {
  ...USER_A_ACHIEVEMENT,
  isUnlocked: false,
  unlockedAtUtc: null,
  progress: 0,
  progressText: '0/1 quest completions'
};

const USER_A_ANALYTICS = createAnalyticsSummary({
  totalQuests: 1,
  activeQuests: 1,
  totalCompletions: 1,
  totalXp: HERO_A.totalXp,
  currentLevel: HERO_A.level,
  currentStreakMax: HERO_A.currentStreak,
  achievementsUnlocked: 1,
  completionsByDay: createDailyMetrics({ '2026-06-18': 1 }),
  xpByDay: createDailyMetrics({ '2026-06-18': USER_A_QUEST.xpReward }),
  recentCompletions: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      questId: USER_A_QUEST.id,
      questTitle: USER_A_QUEST.title,
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

  it('starts from the centralized prototype quest data', () => {
    const state = TestBed.inject(LevelHabitStateService);

    expect(state.quests()).toHaveLength(PROTOTYPE_QUESTS.length);
    expect(state.completedCount()).toBe(DEFAULT_COMPLETED_IDS.length);
    expect(state.totalXp()).toBe(
      BASE_XP +
        PROTOTYPE_QUESTS
          .filter((quest) => DEFAULT_COMPLETED_IDS.includes(quest.id))
          .reduce((total, quest) => total + quest.xp, 0)
    );
  });

  it('updates completion, XP, and level progress when a mock quest is completed', () => {
    const state = TestBed.inject(LevelHabitStateService);
    const quest = PROTOTYPE_QUESTS.find(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    );

    expect(quest).toBeDefined();

    const startingXp = state.totalXp();
    const startingProgress = state.levelProgress();

    state.toggleQuest(quest!.id);

    expect(state.quests().find((candidate) => candidate.id === quest!.id)?.completed).toBe(true);
    expect(state.totalXp()).toBe(startingXp + quest!.xp);
    expect(state.levelProgress()).toBeGreaterThan(startingProgress);
  });

  it('clears authenticated user-specific state on logout', () => {
    const { achievementApi, analyticsApi, auth, questApi, state } =
      setupAuthenticatedState();
    auth.loginAs(USER_A, HERO_A);
    TestBed.tick();

    questApi.setResponses(USER_A.id, [USER_A_QUEST]);
    achievementApi.setResponses(USER_A.id, [USER_A_ACHIEVEMENT]);
    analyticsApi.setResponse(USER_A.id, USER_A_ANALYTICS);

    state.loadQuests();
    state.loadAchievements();
    state.loadAnalytics();

    expect(state.quests().map((quest) => quest.title)).toEqual(['Drink Water']);
    expect(state.unlockedAchievements()).toHaveLength(1);
    expect(state.analyticsSummary()?.totalXp).toBe(HERO_A.totalXp);
    expect(state.totalXp()).toBe(HERO_A.totalXp);
    expect(state.currentStreak()).toBe(HERO_A.currentStreak);

    auth.logout();
    TestBed.tick();

    expect(auth.user()).toBeNull();
    expect(state.quests()).toEqual([]);
    expect(state.achievements()).toEqual([]);
    expect(state.analyticsSummary()).toBeNull();
    expect(state.totalXp()).toBe(0);
    expect(state.level()).toBe(1);
    expect(state.currentStreak()).toBe(0);
    expect(state.questsLoading()).toBe(false);
    expect(state.achievementsLoading()).toBe(false);
    expect(state.analyticsLoading()).toBe(false);
    expect(state.questError()).toBeNull();
    expect(state.achievementError()).toBeNull();
    expect(state.analyticsError()).toBeNull();
  });

  it('clears and reloads quests when switching authenticated users', () => {
    const { auth, questApi, state } = setupAuthenticatedState();
    questApi.setResponses(USER_A.id, [USER_A_QUEST]);
    questApi.setResponses(USER_B.id, [USER_B_QUEST]);

    auth.loginAs(USER_A, HERO_A);
    TestBed.tick();
    state.loadQuests();

    expect(state.quests().map((quest) => quest.title)).toEqual(['Drink Water']);

    auth.loginAs(USER_B, HERO_B);
    TestBed.tick();

    expect(state.quests()).toEqual([]);
    expect(state.totalXp()).toBe(0);
    expect(state.currentStreak()).toBe(0);

    state.loadQuests();

    expect(questApi.list).toHaveBeenCalledTimes(2);
    expect(state.quests().map((quest) => quest.title)).toEqual(['Read Book']);
    expect(state.quests().some((quest) => quest.title === 'Drink Water')).toBe(false);
  });

  it('clears and reloads achievements and analytics on account switch', () => {
    const { achievementApi, analyticsApi, auth, state } = setupAuthenticatedState();
    achievementApi.setResponses(USER_A.id, [USER_A_ACHIEVEMENT]);
    achievementApi.setResponses(USER_B.id, [USER_B_ACHIEVEMENT]);
    analyticsApi.setResponse(USER_A.id, USER_A_ANALYTICS);
    analyticsApi.setResponse(USER_B.id, USER_B_ANALYTICS);

    auth.loginAs(USER_A, HERO_A);
    TestBed.tick();
    state.loadAchievements();
    state.loadAnalytics();

    expect(state.unlockedAchievements()).toHaveLength(1);
    expect(state.analyticsSummary()?.recentCompletions[0]?.questTitle).toBe(
      'Drink Water'
    );

    auth.loginAs(USER_B, HERO_B);
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
        (completion) => completion.questTitle === 'Drink Water'
      )
    ).toBe(false);
  });
});

function createQuestResponse(
  userId: string,
  id: string,
  title: string,
  completedToday = false
): QuestResponse {
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
    totalQuests: 0,
    activeQuests: 0,
    archivedQuests: 0,
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
  questApi: QuestApiServiceStub;
  state: LevelHabitStateService;
} {
  TestBed.resetTestingModule();
  localStorage.clear();

  const auth = new MutableAuthServiceStub();
  const questApi = new QuestApiServiceStub(auth);
  const achievementApi = new AchievementApiServiceStub(auth);
  const analyticsApi = new AnalyticsApiServiceStub(auth);

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: QuestApiService, useValue: questApi },
      { provide: AchievementApiService, useValue: achievementApi },
      { provide: AnalyticsApiService, useValue: analyticsApi }
    ]
  });

  return {
    achievementApi,
    analyticsApi,
    auth,
    questApi,
    state: TestBed.inject(LevelHabitStateService)
  };
}

function createPrototypeAuthService(): Pick<
  AuthService,
  'authRequired' | 'heroProfile' | 'isAuthenticated' | 'updateHeroProfile' | 'user'
> {
  const user = signal<AuthUser | null>(null);
  const heroProfile = signal<HeroProfile | null>(null);
  const isAuthenticated = signal(false);

  return {
    authRequired: false,
    user: user.asReadonly(),
    heroProfile: heroProfile.asReadonly(),
    isAuthenticated: isAuthenticated.asReadonly(),
    updateHeroProfile: (nextHeroProfile) => heroProfile.set(nextHeroProfile)
  };
}

class MutableAuthServiceStub {
  readonly authRequired = true;
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly heroProfileSignal = signal<HeroProfile | null>(null);
  private readonly isAuthenticatedSignal = signal(false);

  readonly user = this.userSignal.asReadonly();
  readonly heroProfile = this.heroProfileSignal.asReadonly();
  readonly isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  readonly canUsePrototypeRoutes = this.isAuthenticatedSignal.asReadonly();

  hasToken(): boolean {
    return this.isAuthenticatedSignal();
  }

  currentUserId(): string | null {
    return this.userSignal()?.id ?? null;
  }

  loginAs(user: AuthUser, heroProfile: HeroProfile): void {
    this.isAuthenticatedSignal.set(true);
    this.userSignal.set(user);
    this.heroProfileSignal.set(heroProfile);
  }

  logout(): void {
    this.isAuthenticatedSignal.set(false);
    this.userSignal.set(null);
    this.heroProfileSignal.set(null);
  }

  updateHeroProfile(heroProfile: HeroProfile): void {
    this.heroProfileSignal.set(heroProfile);
  }
}

class QuestApiServiceStub {
  private readonly responsesByUserId = new Map<string, QuestResponse[]>();

  constructor(private readonly auth: MutableAuthServiceStub) {}

  readonly list = vi.fn((_includeArchived = true): Observable<QuestResponse[]> =>
    of(this.responsesByUserId.get(this.auth.currentUserId() ?? '') ?? [])
  );

  setResponses(userId: string, responses: QuestResponse[]): void {
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
