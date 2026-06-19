import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap, throwError } from 'rxjs';

import {
  AchievementApiService,
  type AchievementResponse
} from '../achievements/achievement-api.service';
import {
  AnalyticsApiService,
  type AnalyticsSummaryResponse
} from '../analytics/analytics-api.service';
import { AuthService } from '../auth/auth.service';
import {
  QuestApiService,
  type QuestResponse,
  type QuestUpsertRequest
} from '../quests/quest-api.service';
import {
  BASE_XP,
  CURRENT_LEVEL_XP,
  DEFAULT_PROTOTYPE_STATE,
  NEXT_LEVEL_XP,
  PROTOTYPE_QUESTS,
  PROTOTYPE_TITLES,
  LEVELHABIT_STORAGE_KEY,
  WEEK_BASE
} from './levelhabit-prototype-data';
import type {
  Achievement,
  CategoryBreakdown,
  PrototypeTitle,
  Quest,
  QuestCategory,
  StoredPrototypeState,
  WeekDay
} from './levelhabit.models';

@Injectable({
  providedIn: 'root'
})
export class LevelHabitStateService {
  private readonly auth = inject(AuthService);
  private readonly questApi = inject(QuestApiService);
  private readonly achievementApi = inject(AchievementApiService);
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly validQuestIds = new Set<string>(
    PROTOTYPE_QUESTS.map((quest) => quest.id)
  );
  private readonly validTitles = new Set<string>(PROTOTYPE_TITLES);
  private readonly state = signal<StoredPrototypeState>(this.loadState());
  private readonly persistedQuests = signal<Quest[]>([]);
  private readonly questsLoadedSignal = signal(false);
  private readonly questsLoadingSignal = signal(false);
  private readonly questActionInFlightSignal = signal(false);
  private readonly completionActionQuestIdsSignal = signal<readonly string[]>([]);
  private readonly questErrorSignal = signal<string | null>(null);
  private readonly persistedAchievements = signal<Achievement[]>([]);
  private readonly achievementsLoadedSignal = signal(false);
  private readonly achievementsLoadingSignal = signal(false);
  private readonly achievementErrorSignal = signal<string | null>(null);
  private readonly analyticsSummarySignal =
    signal<AnalyticsSummaryResponse | null>(null);
  private readonly analyticsLoadedSignal = signal(false);
  private readonly analyticsLoadingSignal = signal(false);
  private readonly analyticsErrorSignal = signal<string | null>(null);
  private activeApiUserId: string | null = null;

  readonly availableTitles = PROTOTYPE_TITLES;
  readonly questsLoading = this.questsLoadingSignal.asReadonly();
  readonly questActionInFlight = this.questActionInFlightSignal.asReadonly();
  readonly questError = this.questErrorSignal.asReadonly();
  readonly achievementsLoading = this.achievementsLoadingSignal.asReadonly();
  readonly achievementError = this.achievementErrorSignal.asReadonly();
  readonly analyticsSummary = this.analyticsSummarySignal.asReadonly();
  readonly analyticsLoading = this.analyticsLoadingSignal.asReadonly();
  readonly analyticsError = this.analyticsErrorSignal.asReadonly();
  readonly usesQuestApi = computed(() =>
    this.auth.authRequired && this.auth.isAuthenticated()
  );

  readonly quests = computed<Quest[]>(() => {
    if (this.auth.authRequired) {
      return this.persistedQuests();
    }

    const completedQuestIds = new Set(this.state().completedQuestIds);

    return PROTOTYPE_QUESTS.map((quest) => ({
      ...quest,
      isArchived: false,
      completed: completedQuestIds.has(quest.id)
    }));
  });

  readonly completedQuests = computed(() =>
    this.quests().filter((quest) => quest.completed)
  );

  readonly activeQuests = computed(() =>
    this.quests().filter((quest) => !quest.completed && !quest.isArchived)
  );

  readonly completedCount = computed(() => this.completedQuests().length);
  readonly questCount = computed(() =>
    this.quests().filter((quest) => !quest.isArchived).length
  );

  readonly earnedXp = computed(() => {
    return this.completedQuests().reduce((total, quest) => total + quest.xp, 0);
  });

  readonly heroProfile = computed(() => this.auth.heroProfile());

  readonly totalXp = computed(() =>
    this.heroProfile()?.totalXp
      ?? (this.auth.authRequired ? 0 : BASE_XP + this.earnedXp())
  );

  readonly level = computed(() =>
    this.heroProfile()?.level
      ?? (this.auth.authRequired
        ? 1
        : this.totalXp() >= NEXT_LEVEL_XP ? 8 : 7)
  );

  readonly levelTitle = computed(() =>
    this.heroProfile()?.heroName
      ?? (this.auth.authRequired ? 'Hero' : this.state().selectedTitle)
  );

  readonly nextLevelLabel = computed(() =>
    this.heroProfile()
      ? `Level ${this.level() + 1}`
      : this.auth.authRequired
        ? 'Level 2'
        : this.level() >= 8 ? 'Level 9' : 'Level 8'
  );

  readonly xpToNextLevel = computed(() =>
    this.heroProfile()?.xpToNextLevel
      ?? (this.auth.authRequired
        ? 100
        : Math.max(0, NEXT_LEVEL_XP - this.totalXp()))
  );

  readonly levelProgress = computed(() => {
    const profile = this.heroProfile();

    if (profile) {
      if (profile.xpRequiredForNextLevel <= 0) {
        return 100;
      }

      return Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (profile.xpInCurrentLevel / profile.xpRequiredForNextLevel) * 100
          )
        )
      );
    }

    if (this.auth.authRequired) {
      return 0;
    }

    const progress = this.totalXp() - CURRENT_LEVEL_XP;
    const span = NEXT_LEVEL_XP - CURRENT_LEVEL_XP;

    return Math.min(100, Math.max(0, Math.round((progress / span) * 100)));
  });

  readonly xpInCurrentLevel = computed(() => {
    const profile = this.heroProfile();

    if (profile) {
      return profile.xpInCurrentLevel;
    }

    if (this.auth.authRequired) {
      return 0;
    }

    return Math.max(0, this.totalXp() - CURRENT_LEVEL_XP);
  });

  readonly xpRequiredForNextLevel = computed(() =>
    this.heroProfile()?.xpRequiredForNextLevel
      ?? (this.auth.authRequired ? 100 : NEXT_LEVEL_XP - CURRENT_LEVEL_XP)
  );

  readonly currentStreak = computed(() => {
    const profile = this.heroProfile();

    if (profile) {
      return profile.currentStreak;
    }

    if (this.auth.authRequired) {
      return 0;
    }

    const completedStreaks = this.completedQuests().map((quest) => quest.streak);
    const bestToday = completedStreaks.length > 0 ? Math.max(...completedStreaks) : 0;

    return bestToday + (this.completedCount() >= 4 ? 1 : 0);
  });

  readonly completionPercent = computed(() =>
    this.questCount() === 0
      ? 0
      : Math.round((this.completedCount() / this.questCount()) * 100)
  );

  readonly weeklyHistory = computed<WeekDay[]>(() => [
    ...WEEK_BASE.slice(0, -1),
    {
      label: 'Today',
      completed: this.completedCount(),
      total: this.questCount(),
      xp: this.earnedXp()
    }
  ]);

  readonly weekXp = computed(() =>
    this.weeklyHistory().reduce((total, day) => total + day.xp, 0)
  );

  readonly consistencyScore = computed(() => {
    const totalCompletion = this.weeklyHistory().reduce(
      (total, day) => total + (day.total > 0 ? day.completed / day.total : 0),
      0
    );

    return Math.round((totalCompletion / this.weeklyHistory().length) * 100);
  });

  readonly categoryBreakdown = computed<CategoryBreakdown[]>(() => {
    const categories = Array.from(
      new Set(
        this.quests()
          .filter((quest) => !quest.isArchived)
          .map((quest) => quest.category)
      )
    ) as QuestCategory[];

    return categories.map((category) => {
      const quests = this.quests().filter(
        (quest) => quest.category === category && !quest.isArchived
      );
      const completed = quests.filter((quest) => quest.completed);

      return {
        category,
        completed: completed.length,
        total: quests.length,
        xp: completed.reduce((total, quest) => total + quest.xp, 0),
        percent: Math.round((completed.length / quests.length) * 100)
      };
    });
  });

  readonly achievements = computed<Achievement[]>(() => {
    if (this.auth.authRequired) {
      return this.persistedAchievements();
    }

    const completedCategories = this.categoryBreakdown().filter(
      (category) => category.completed > 0
    ).length;

    return [
      {
        id: 'first-light',
        title: 'First Step',
        summary: 'Complete the first quest of the day.',
        progress: Math.min(this.completedCount(), 1),
        target: 1,
        progressText: `${Math.min(this.completedCount(), 1)}/1 quest completions`,
        unlocked: this.completedCount() >= 1
      },
      {
        id: 'clean-sweep',
        title: 'Getting Started',
        summary: 'Complete 5 quests total.',
        progress: Math.min(this.completedCount(), 5),
        target: 5,
        progressText: `${Math.min(this.completedCount(), 5)}/5 quest completions`,
        unlocked: this.completedCount() >= 5
      },
      {
        id: 'streak-adept',
        title: 'On Fire',
        summary: 'Reach a 3-day streak on any quest.',
        progress: Math.min(this.currentStreak(), 3),
        target: 3,
        progressText: `${Math.min(this.currentStreak(), 3)}/3 day streak`,
        unlocked: this.currentStreak() >= 3
      },
      {
        id: 'balanced-build',
        title: 'Balanced Hero',
        summary: 'Complete quests across 3 life areas.',
        progress: Math.min(completedCategories, 3),
        target: 3,
        progressText: `${Math.min(completedCategories, 3)}/3 categories`,
        unlocked: completedCategories >= 3
      },
      {
        id: 'level-break',
        title: 'Level Up',
        summary: 'Reach hero level 2.',
        progress: Math.min(this.level(), 2),
        target: 2,
        progressText: `Level ${Math.min(this.level(), 2)}/2`,
        unlocked: this.level() >= 2
      }
    ];
  });

  readonly unlockedAchievements = computed(() =>
    this.achievements().filter((achievement) => achievement.unlocked)
  );

  constructor() {
    effect(() => {
      this.ensureApiUserBoundary(this.currentApiUserId());
    });
  }

  loadQuests(): void {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId || this.questsLoadedSignal() || this.questsLoadingSignal()) {
      return;
    }

    this.questsLoadingSignal.set(true);
    this.questErrorSignal.set(null);

    this.questApi
      .list(true)
      .pipe(finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.questsLoadingSignal.set(false);
        }
      }))
      .subscribe({
        next: (quests) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.persistedQuests.set(quests.map((quest) => this.mapPersistedQuest(quest)));
          this.questsLoadedSignal.set(true);
        },
        error: (error: unknown) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.questErrorSignal.set(
            this.describeQuestError(error, 'Quests could not be loaded.')
          );
        }
      });
  }

  loadAchievements(force = false): void {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (
      !apiUserId
      || (!force && this.achievementsLoadedSignal())
      || this.achievementsLoadingSignal()
    ) {
      return;
    }

    this.achievementsLoadingSignal.set(true);
    this.achievementErrorSignal.set(null);

    this.achievementApi
      .list()
      .pipe(finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.achievementsLoadingSignal.set(false);
        }
      }))
      .subscribe({
        next: (achievements) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.persistedAchievements.set(
            achievements.map((achievement) =>
              this.mapPersistedAchievement(achievement)
            )
          );
          this.achievementsLoadedSignal.set(true);
        },
        error: (error: unknown) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.achievementErrorSignal.set(
            this.describeAchievementError(
              error,
              'Achievements could not be loaded.'
            )
          );
        }
      });
  }

  loadAnalytics(force = false): void {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (
      !apiUserId
      || (!force && this.analyticsLoadedSignal())
      || this.analyticsLoadingSignal()
    ) {
      return;
    }

    this.analyticsLoadingSignal.set(true);
    this.analyticsErrorSignal.set(null);

    this.analyticsApi
      .summary()
      .pipe(finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.analyticsLoadingSignal.set(false);
        }
      }))
      .subscribe({
        next: (summary) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.analyticsSummarySignal.set(summary);
          this.analyticsLoadedSignal.set(true);
        },
        error: (error: unknown) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.analyticsErrorSignal.set(
            this.describeAnalyticsError(error, 'Analytics could not be loaded.')
          );
        }
      });
  }

  createQuest(request: QuestUpsertRequest): Observable<Quest> {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    this.questActionInFlightSignal.set(true);
    this.questErrorSignal.set(null);

    return this.questApi.create(request).pipe(
      map((quest) => this.mapPersistedQuest(quest)),
      tap((quest) => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedQuests.update((quests) => [...quests, quest]);
        this.questsLoadedSignal.set(true);
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureQuestError<Quest>(
          error,
          'Quest could not be created.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.questActionInFlightSignal.set(false);
        }
      })
    );
  }

  updateQuest(id: string, request: QuestUpsertRequest): Observable<Quest> {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    this.questActionInFlightSignal.set(true);
    this.questErrorSignal.set(null);

    return this.questApi.update(id, request).pipe(
      map((quest) => this.mapPersistedQuest(quest)),
      tap((updatedQuest) => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedQuests.update((quests) =>
          quests.map((quest) => quest.id === updatedQuest.id ? updatedQuest : quest)
        );
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureQuestError<Quest>(
          error,
          'Quest could not be updated.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.questActionInFlightSignal.set(false);
        }
      })
    );
  }

  archiveQuest(id: string): Observable<void> {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    this.questActionInFlightSignal.set(true);
    this.questErrorSignal.set(null);

    return this.questApi.archive(id).pipe(
      tap(() => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedQuests.update((quests) =>
          quests.map((quest) =>
            quest.id === id
              ? {
                  ...quest,
                  isArchived: true
                }
              : quest
          )
        );
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureQuestError<void>(
          error,
          'Quest could not be archived.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.questActionInFlightSignal.set(false);
        }
      })
    );
  }

  completeQuest(id: string): Observable<Quest> {
    if (!this.usesQuestApi()) {
      this.toggleQuest(id);

      const toggledQuest = this.quests().find((quest) => quest.id === id);

      return toggledQuest
        ? of(toggledQuest)
        : throwError(() => new Error('Quest not found.'));
    }

    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    const quest = this.persistedQuests().find((candidate) => candidate.id === id);

    if (!quest || quest.isArchived) {
      this.questErrorSignal.set('That quest could not be found.');

      return throwError(() => new Error('Quest not found.'));
    }

    if (quest.completed || this.isQuestCompletionInFlight(id)) {
      return of(quest);
    }

    this.setQuestCompletionInFlight(id, true);
    this.questErrorSignal.set(null);

    return this.questApi.complete(id).pipe(
      tap((completion) => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.auth.updateHeroProfile(completion.heroProfile);
        }
      }),
      tap(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.loadAchievements(true);
        }
      }),
      map((completion) => {
        const completedQuest = this.mapPersistedQuest(completion.quest);

        return {
          ...completedQuest,
          ...(completion.wasAlreadyCompleted
            ? {}
            : { xpAwardedJustNow: completion.xpAwarded })
        };
      }),
      tap((completedQuest) => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedQuests.update((quests) =>
          quests.map((candidate) =>
            candidate.id === completedQuest.id ? completedQuest : candidate
          )
        );
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureQuestError<Quest>(
          error,
          'Quest could not be completed.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.setQuestCompletionInFlight(id, false);
        }
      })
    );
  }

  isQuestCompletionInFlight(questId: string): boolean {
    return this.completionActionQuestIdsSignal().includes(questId);
  }

  toggleQuest(questId: string): void {
    if (this.usesQuestApi()) {
      return;
    }

    const current = this.state();
    const completedQuestIds = new Set(current.completedQuestIds);

    if (completedQuestIds.has(questId)) {
      completedQuestIds.delete(questId);
    } else {
      completedQuestIds.add(questId);
    }

    this.saveState({
      ...current,
      completedQuestIds: Array.from(completedQuestIds)
    });
  }

  completeAll(): void {
    if (this.usesQuestApi()) {
      return;
    }

    this.saveState({
      ...this.state(),
      completedQuestIds: PROTOTYPE_QUESTS.map((quest) => quest.id)
    });
  }

  resetToday(): void {
    if (this.usesQuestApi()) {
      return;
    }

    this.saveState({
      ...this.state(),
      completedQuestIds: []
    });
  }

  selectTitle(title: PrototypeTitle): void {
    if (!this.validTitles.has(title)) {
      return;
    }

    this.saveState({
      ...this.state(),
      selectedTitle: title
    });
  }

  private loadState(): StoredPrototypeState {
    const fallback = this.createDefaultState();

    if (typeof localStorage === 'undefined') {
      return fallback;
    }

    try {
      const stored = localStorage.getItem(LEVELHABIT_STORAGE_KEY);

      if (!stored) {
        return fallback;
      }

      const parsed: unknown = JSON.parse(stored);

      if (!this.isRecord(parsed)) {
        return fallback;
      }

      return {
        completedQuestIds: this.readCompletedQuestIds(
          parsed['completedQuestIds'],
          fallback.completedQuestIds
        ),
        selectedTitle: this.readSelectedTitle(
          parsed['selectedTitle'],
          fallback.selectedTitle
        )
      };
    } catch {
      return fallback;
    }
  }

  private saveState(nextState: StoredPrototypeState): void {
    this.state.set({
      ...nextState,
      completedQuestIds: [...nextState.completedQuestIds]
    });

    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(LEVELHABIT_STORAGE_KEY, JSON.stringify(nextState));
  }

  private createDefaultState(): StoredPrototypeState {
    return {
      ...DEFAULT_PROTOTYPE_STATE,
      completedQuestIds: [...DEFAULT_PROTOTYPE_STATE.completedQuestIds]
    };
  }

  private readCompletedQuestIds(
    value: unknown,
    fallback: readonly string[]
  ): readonly string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    return value.filter(
      (questId): questId is string =>
        typeof questId === 'string' && this.validQuestIds.has(questId)
    );
  }

  private readSelectedTitle(
    value: unknown,
    fallback: PrototypeTitle
  ): PrototypeTitle {
    return this.isPrototypeTitle(value) ? value : fallback;
  }

  private isPrototypeTitle(value: unknown): value is PrototypeTitle {
    return typeof value === 'string' && this.validTitles.has(value);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private mapPersistedQuest(response: QuestResponse): Quest {
    const quest: Quest = {
      id: response.id,
      userId: response.userId,
      title: response.title,
      category: response.category,
      summary: response.description || 'No description yet.',
      cadence: response.frequency,
      xp: response.xpReward,
      streak: response.currentStreak,
      difficulty: response.difficulty,
      accent: this.accentForCategory(response.category),
      completed: response.completedToday,
      isArchived: response.isArchived,
      bestStreak: response.bestStreak,
      createdAtUtc: response.createdAtUtc,
      updatedAtUtc: response.updatedAtUtc
    };

    return {
      ...quest,
      ...(response.completedTodayAtUtc === null
        ? {}
        : { completedTodayAtUtc: response.completedTodayAtUtc }),
      ...(response.completedTodayXpAwarded === null
        ? {}
        : { completedTodayXpAwarded: response.completedTodayXpAwarded }),
      ...(response.lastCompletedDateUtc === null
        ? {}
        : { lastCompletedDateUtc: response.lastCompletedDateUtc }),
      ...(response.lastCompletedAtUtc === null
        ? {}
        : { lastCompletedAtUtc: response.lastCompletedAtUtc })
    };
  }

  private mapPersistedAchievement(response: AchievementResponse): Achievement {
    const achievement: Achievement = {
      id: response.key,
      title: response.title,
      summary: response.description,
      progress: response.progress,
      target: response.target,
      progressText: response.progressText,
      unlocked: response.isUnlocked
    };

    return {
      ...achievement,
      ...(response.unlockedAtUtc === null
        ? {}
        : { unlockedAtUtc: response.unlockedAtUtc })
    };
  }

  private accentForCategory(category: QuestResponse['category']): Quest['accent'] {
    switch (category) {
      case 'Fitness':
      case 'Health':
        return 'emerald';
      case 'Learning':
        return 'cyan';
      case 'Coding':
        return 'indigo';
      case 'Chores':
        return 'amber';
      default:
        return 'rose';
    }
  }

  private currentApiUserId(): string | null {
    if (!this.usesQuestApi()) {
      return null;
    }

    return this.auth.user()?.id ?? null;
  }

  private isCurrentApiUser(apiUserId: string): boolean {
    return this.currentApiUserId() === apiUserId;
  }

  private ensureApiUserBoundary(apiUserId: string | null): void {
    if (apiUserId === this.activeApiUserId) {
      return;
    }

    this.activeApiUserId = apiUserId;
    this.clearAuthenticatedState();
  }

  private clearAuthenticatedState(): void {
    this.persistedQuests.set([]);
    this.questsLoadedSignal.set(false);
    this.questsLoadingSignal.set(false);
    this.questActionInFlightSignal.set(false);
    this.completionActionQuestIdsSignal.set([]);
    this.questErrorSignal.set(null);
    this.persistedAchievements.set([]);
    this.achievementsLoadedSignal.set(false);
    this.achievementsLoadingSignal.set(false);
    this.achievementErrorSignal.set(null);
    this.analyticsSummarySignal.set(null);
    this.analyticsLoadedSignal.set(false);
    this.analyticsLoadingSignal.set(false);
    this.analyticsErrorSignal.set(null);
  }

  private captureQuestError<T>(
    error: unknown,
    fallback: string,
    apiUserId: string
  ): Observable<T> {
    if (this.isCurrentApiUser(apiUserId)) {
      this.questErrorSignal.set(this.describeQuestError(error, fallback));
    }

    return throwError(() => error);
  }

  private describeQuestError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    if (error.status === 0) {
      return 'The backend is unavailable. Start the API and try again.';
    }

    if (error.status === 401) {
      return 'Your session expired. Sign in again to manage quests.';
    }

    if (error.status === 404) {
      return 'That quest could not be found.';
    }

    if (error.status === 409) {
      return 'That quest is already completed today.';
    }

    const problem = this.isRecord(error.error) ? error.error : null;
    const errors = problem && this.isRecord(problem['errors'])
      ? problem['errors']
      : null;
    const firstValidationError = errors
      ? Object.values(errors).find((value): value is string[] =>
          Array.isArray(value) && value.every((item) => typeof item === 'string')
        )?.[0]
      : null;

    if (firstValidationError) {
      return firstValidationError;
    }

    const detail = problem?.['detail'];

    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }

    return fallback;
  }

  private describeAchievementError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    if (error.status === 0) {
      return 'The backend is unavailable. Start the API and try again.';
    }

    if (error.status === 401) {
      return 'Your session expired. Sign in again to view achievements.';
    }

    const problem = this.isRecord(error.error) ? error.error : null;
    const detail = problem?.['detail'];

    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }

    return fallback;
  }

  private describeAnalyticsError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    if (error.status === 0) {
      return 'The backend is unavailable. Start the API and try again.';
    }

    if (error.status === 401) {
      return 'Your session expired. Sign in again to view analytics.';
    }

    const problem = this.isRecord(error.error) ? error.error : null;
    const detail = problem?.['detail'];

    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }

    return fallback;
  }

  private refreshAnalyticsIfLoaded(): void {
    if (this.analyticsLoadedSignal()) {
      this.loadAnalytics(true);
    }
  }

  private setQuestCompletionInFlight(questId: string, inFlight: boolean): void {
    this.completionActionQuestIdsSignal.update((questIds) => {
      const nextQuestIds = new Set(questIds);

      if (inFlight) {
        nextQuestIds.add(questId);
      } else {
        nextQuestIds.delete(questId);
      }

      return Array.from(nextQuestIds);
    });
  }
}
