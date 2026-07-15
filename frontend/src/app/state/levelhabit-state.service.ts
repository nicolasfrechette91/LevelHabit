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
  HabitApiService,
  type HabitResponse,
  type HabitUpsertRequest
} from '../habits/habit-api.service';
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
  Habit,
  HabitCategory,
  StoredPrototypeState,
  WeekDay
} from './levelhabit.models';

@Injectable({
  providedIn: 'root'
})
export class LevelHabitStateService {
  private readonly auth = inject(AuthService);
  private readonly habitApi = inject(HabitApiService);
  private readonly achievementApi = inject(AchievementApiService);
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly validHabitIds = new Set<string>(
    PROTOTYPE_QUESTS.map((habit) => habit.id)
  );
  private readonly validTitles = new Set<string>(PROTOTYPE_TITLES);
  private readonly state = signal<StoredPrototypeState>(this.loadState());
  private readonly persistedHabits = signal<Habit[]>([]);
  private readonly habitsLoadedSignal = signal(false);
  private readonly habitsLoadingSignal = signal(false);
  private readonly habitActionInFlightSignal = signal(false);
  private readonly completionActionHabitIdsSignal = signal<readonly string[]>([]);
  private readonly habitErrorSignal = signal<string | null>(null);
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
  readonly habitsLoading = this.habitsLoadingSignal.asReadonly();
  readonly habitActionInFlight = this.habitActionInFlightSignal.asReadonly();
  readonly habitError = this.habitErrorSignal.asReadonly();
  readonly achievementsLoading = this.achievementsLoadingSignal.asReadonly();
  readonly achievementError = this.achievementErrorSignal.asReadonly();
  readonly analyticsSummary = this.analyticsSummarySignal.asReadonly();
  readonly analyticsLoading = this.analyticsLoadingSignal.asReadonly();
  readonly analyticsError = this.analyticsErrorSignal.asReadonly();
  readonly usesHabitApi = computed(() =>
    this.auth.authRequired && this.auth.isAuthenticated()
  );

  readonly habits = computed<Habit[]>(() => {
    if (this.auth.authRequired) {
      return this.persistedHabits();
    }

    const completedHabitIds = new Set(this.state().completedHabitIds);

    return PROTOTYPE_QUESTS.map((habit) => ({
      ...habit,
      isArchived: false,
      completed: completedHabitIds.has(habit.id)
    }));
  });

  readonly completedHabits = computed(() =>
    this.habits().filter((habit) => habit.completed)
  );

  readonly activeHabits = computed(() =>
    this.habits().filter((habit) => !habit.completed && !habit.isArchived)
  );

  readonly completedCount = computed(() => this.completedHabits().length);
  readonly habitCount = computed(() =>
    this.habits().filter((habit) => !habit.isArchived).length
  );

  readonly todayHabitCount = computed(() =>
    Math.max(this.habitCount(), this.completedCount())
  );

  readonly earnedXp = computed(() => {
    return this.completedHabits().reduce((total, habit) => total + habit.xp, 0);
  });

  readonly progressProfile = computed(() => this.auth.progressProfile());

  readonly totalXp = computed(() =>
    this.progressProfile()?.totalXp
      ?? (this.auth.authRequired ? 0 : BASE_XP + this.earnedXp())
  );

  readonly level = computed(() =>
    this.progressProfile()?.level
      ?? (this.auth.authRequired
        ? 1
        : this.totalXp() >= NEXT_LEVEL_XP ? 8 : 7)
  );

  readonly levelTitle = computed(() =>
    this.progressProfile()?.displayName
      ?? (this.auth.authRequired ? 'Progress' : this.state().selectedTitle)
  );

  readonly nextLevelLabel = computed(() =>
    this.progressProfile()
      ? `Level ${this.level() + 1}`
      : this.auth.authRequired
        ? 'Level 2'
        : this.level() >= 8 ? 'Level 9' : 'Level 8'
  );

  readonly xpToNextLevel = computed(() =>
    this.progressProfile()?.xpToNextLevel
      ?? (this.auth.authRequired
        ? 100
        : Math.max(0, NEXT_LEVEL_XP - this.totalXp()))
  );

  readonly levelProgress = computed(() => {
    const profile = this.progressProfile();

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
    const profile = this.progressProfile();

    if (profile) {
      return profile.xpInCurrentLevel;
    }

    if (this.auth.authRequired) {
      return 0;
    }

    return Math.max(0, this.totalXp() - CURRENT_LEVEL_XP);
  });

  readonly xpRequiredForNextLevel = computed(() =>
    this.progressProfile()?.xpRequiredForNextLevel
      ?? (this.auth.authRequired ? 100 : NEXT_LEVEL_XP - CURRENT_LEVEL_XP)
  );

  readonly currentStreak = computed(() => {
    const profile = this.progressProfile();

    if (profile) {
      return profile.currentStreak;
    }

    if (this.auth.authRequired) {
      return 0;
    }

    const completedStreaks = this.completedHabits().map((habit) => habit.streak);
    const bestToday = completedStreaks.length > 0 ? Math.max(...completedStreaks) : 0;

    return bestToday + (this.completedCount() >= 4 ? 1 : 0);
  });

  readonly completionPercent = computed(() =>
    this.todayHabitCount() === 0
      ? 0
      : Math.round((this.completedCount() / this.todayHabitCount()) * 100)
  );

  readonly weeklyHistory = computed<WeekDay[]>(() => [
    ...WEEK_BASE.slice(0, -1),
    {
      label: 'Today',
      completed: this.completedCount(),
      total: this.todayHabitCount(),
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
        this.habits()
          .filter((habit) => !habit.isArchived)
          .map((habit) => habit.category)
      )
    ) as HabitCategory[];

    return categories.map((category) => {
      const habits = this.habits().filter(
        (habit) => habit.category === category && !habit.isArchived
      );
      const completed = habits.filter((habit) => habit.completed);

      return {
        category,
        completed: completed.length,
        total: habits.length,
        xp: completed.reduce((total, habit) => total + habit.xp, 0),
        percent: Math.round((completed.length / habits.length) * 100)
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
        summary: 'Complete the first habit of the day.',
        progress: Math.min(this.completedCount(), 1),
        target: 1,
        progressText: `${Math.min(this.completedCount(), 1)}/1 habit completions`,
        unlocked: this.completedCount() >= 1
      },
      {
        id: 'clean-sweep',
        title: 'Getting Started',
        summary: 'Complete 5 habits total.',
        progress: Math.min(this.completedCount(), 5),
        target: 5,
        progressText: `${Math.min(this.completedCount(), 5)}/5 habit completions`,
        unlocked: this.completedCount() >= 5
      },
      {
        id: 'streak-adept',
        title: 'On Fire',
        summary: 'Reach a 3-day streak on any habit.',
        progress: Math.min(this.currentStreak(), 3),
        target: 3,
        progressText: `${Math.min(this.currentStreak(), 3)}/3 day streak`,
        unlocked: this.currentStreak() >= 3
      },
      {
        id: 'balanced-build',
        title: 'Balanced Progress',
        summary: 'Complete habits across 3 life areas.',
        progress: Math.min(completedCategories, 3),
        target: 3,
        progressText: `${Math.min(completedCategories, 3)}/3 categories`,
        unlocked: completedCategories >= 3
      },
      {
        id: 'level-break',
        title: 'Level Up',
        summary: 'Reach level 2.',
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

  loadHabits(): void {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId || this.habitsLoadedSignal() || this.habitsLoadingSignal()) {
      return;
    }

    this.habitsLoadingSignal.set(true);
    this.habitErrorSignal.set(null);

    this.habitApi
      .list(true)
      .pipe(finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.habitsLoadingSignal.set(false);
        }
      }))
      .subscribe({
        next: (habits) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.persistedHabits.set(habits.map((habit) => this.mapPersistedHabit(habit)));
          this.habitsLoadedSignal.set(true);
        },
        error: (error: unknown) => {
          if (!this.isCurrentApiUser(apiUserId)) {
            return;
          }

          this.habitErrorSignal.set(
            this.describeHabitError(error, 'Habits could not be loaded.')
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

  createHabit(request: HabitUpsertRequest): Observable<Habit> {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    this.habitActionInFlightSignal.set(true);
    this.habitErrorSignal.set(null);

    return this.habitApi.create(request).pipe(
      map((habit) => this.mapPersistedHabit(habit)),
      tap((habit) => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedHabits.update((habits) => [...habits, habit]);
        this.habitsLoadedSignal.set(true);
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureHabitError<Habit>(
          error,
          'Habit could not be created.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.habitActionInFlightSignal.set(false);
        }
      })
    );
  }

  updateHabit(id: string, request: HabitUpsertRequest): Observable<Habit> {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    this.habitActionInFlightSignal.set(true);
    this.habitErrorSignal.set(null);

    return this.habitApi.update(id, request).pipe(
      map((habit) => this.mapPersistedHabit(habit)),
      tap((updatedHabit) => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedHabits.update((habits) =>
          habits.map((habit) => habit.id === updatedHabit.id ? updatedHabit : habit)
        );
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureHabitError<Habit>(
          error,
          'Habit could not be updated.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.habitActionInFlightSignal.set(false);
        }
      })
    );
  }

  archiveHabit(id: string): Observable<void> {
    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    this.habitActionInFlightSignal.set(true);
    this.habitErrorSignal.set(null);

    return this.habitApi.archive(id).pipe(
      tap(() => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedHabits.update((habits) =>
          habits.map((habit) =>
            habit.id === id
              ? {
                  ...habit,
                  isArchived: true
                }
              : habit
          )
        );
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureHabitError<void>(
          error,
          'Habit could not be archived.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.habitActionInFlightSignal.set(false);
        }
      })
    );
  }

  completeHabit(id: string): Observable<Habit> {
    if (!this.usesHabitApi()) {
      this.toggleHabit(id);

      const toggledHabit = this.habits().find((habit) => habit.id === id);

      return toggledHabit
        ? of(toggledHabit)
        : throwError(() => new Error('Habit not found.'));
    }

    const apiUserId = this.currentApiUserId();
    this.ensureApiUserBoundary(apiUserId);

    if (!apiUserId) {
      return throwError(() => new Error('A current authenticated user is required.'));
    }

    const habit = this.persistedHabits().find((candidate) => candidate.id === id);

    if (!habit || habit.isArchived) {
      this.habitErrorSignal.set('That habit could not be found.');

      return throwError(() => new Error('Habit not found.'));
    }

    if (habit.completed || this.isHabitCompletionInFlight(id)) {
      return of(habit);
    }

    this.setHabitCompletionInFlight(id, true);
    this.habitErrorSignal.set(null);

    return this.habitApi.complete(id).pipe(
      tap((completion) => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.auth.updateProgressProfile(completion.progressProfile);
        }
      }),
      tap(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.loadAchievements(true);
        }
      }),
      map((completion) => {
        const completedHabit = this.mapPersistedHabit(completion.habit);

        return {
          ...completedHabit,
          ...(completion.wasAlreadyCompleted
            ? {}
            : { xpAwardedJustNow: completion.xpAwarded })
        };
      }),
      tap((completedHabit) => {
        if (!this.isCurrentApiUser(apiUserId)) {
          return;
        }

        this.persistedHabits.update((habits) =>
          habits.map((candidate) =>
            candidate.id === completedHabit.id ? completedHabit : candidate
          )
        );
        this.refreshAnalyticsIfLoaded();
      }),
      catchError((error: unknown) =>
        this.captureHabitError<Habit>(
          error,
          'Habit could not be completed.',
          apiUserId
        )
      ),
      finalize(() => {
        if (this.isCurrentApiUser(apiUserId)) {
          this.setHabitCompletionInFlight(id, false);
        }
      })
    );
  }

  isHabitCompletionInFlight(habitId: string): boolean {
    return this.completionActionHabitIdsSignal().includes(habitId);
  }

  toggleHabit(habitId: string): void {
    if (this.usesHabitApi()) {
      return;
    }

    const current = this.state();
    const completedHabitIds = new Set(current.completedHabitIds);

    if (completedHabitIds.has(habitId)) {
      completedHabitIds.delete(habitId);
    } else {
      completedHabitIds.add(habitId);
    }

    this.saveState({
      ...current,
      completedHabitIds: Array.from(completedHabitIds)
    });
  }

  completeAll(): void {
    if (this.usesHabitApi()) {
      return;
    }

    this.saveState({
      ...this.state(),
      completedHabitIds: PROTOTYPE_QUESTS.map((habit) => habit.id)
    });
  }

  resetToday(): void {
    if (this.usesHabitApi()) {
      return;
    }

    this.saveState({
      ...this.state(),
      completedHabitIds: []
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
        completedHabitIds: this.readCompletedHabitIds(
          parsed['completedHabitIds'],
          fallback.completedHabitIds
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
      completedHabitIds: [...nextState.completedHabitIds]
    });

    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(LEVELHABIT_STORAGE_KEY, JSON.stringify(nextState));
  }

  private createDefaultState(): StoredPrototypeState {
    return {
      ...DEFAULT_PROTOTYPE_STATE,
      completedHabitIds: [...DEFAULT_PROTOTYPE_STATE.completedHabitIds]
    };
  }

  private readCompletedHabitIds(
    value: unknown,
    fallback: readonly string[]
  ): readonly string[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    return value.filter(
      (habitId): habitId is string =>
        typeof habitId === 'string' && this.validHabitIds.has(habitId)
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

  private mapPersistedHabit(response: HabitResponse): Habit {
    const habit: Habit = {
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
      ...habit,
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

  private accentForCategory(category: HabitResponse['category']): Habit['accent'] {
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
    if (!this.usesHabitApi()) {
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
    this.persistedHabits.set([]);
    this.habitsLoadedSignal.set(false);
    this.habitsLoadingSignal.set(false);
    this.habitActionInFlightSignal.set(false);
    this.completionActionHabitIdsSignal.set([]);
    this.habitErrorSignal.set(null);
    this.persistedAchievements.set([]);
    this.achievementsLoadedSignal.set(false);
    this.achievementsLoadingSignal.set(false);
    this.achievementErrorSignal.set(null);
    this.analyticsSummarySignal.set(null);
    this.analyticsLoadedSignal.set(false);
    this.analyticsLoadingSignal.set(false);
    this.analyticsErrorSignal.set(null);
  }

  private captureHabitError<T>(
    error: unknown,
    fallback: string,
    apiUserId: string
  ): Observable<T> {
    if (this.isCurrentApiUser(apiUserId)) {
      this.habitErrorSignal.set(this.describeHabitError(error, fallback));
    }

    return throwError(() => error);
  }

  private describeHabitError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    if (error.status === 0) {
      return 'The backend is unavailable. Start the API and try again.';
    }

    if (error.status === 401) {
      return 'Your session expired. Sign in again to manage habits.';
    }

    if (error.status === 404) {
      return 'That habit could not be found.';
    }

    if (error.status === 409) {
      return 'That habit is already completed today.';
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

  private setHabitCompletionInFlight(habitId: string, inFlight: boolean): void {
    this.completionActionHabitIdsSignal.update((habitIds) => {
      const nextHabitIds = new Set(habitIds);

      if (inFlight) {
        nextHabitIds.add(habitId);
      } else {
        nextHabitIds.delete(habitId);
      }

      return Array.from(nextHabitIds);
    });
  }
}
