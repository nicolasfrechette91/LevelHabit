import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap, throwError } from 'rxjs';

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

  readonly availableTitles = PROTOTYPE_TITLES;
  readonly questsLoading = this.questsLoadingSignal.asReadonly();
  readonly questActionInFlight = this.questActionInFlightSignal.asReadonly();
  readonly questError = this.questErrorSignal.asReadonly();
  readonly usesQuestApi = computed(() =>
    this.auth.authRequired && this.auth.isAuthenticated()
  );

  readonly quests = computed<Quest[]>(() => {
    if (this.usesQuestApi()) {
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
    this.heroProfile()?.totalXp ?? BASE_XP + this.earnedXp()
  );

  readonly level = computed(() =>
    this.heroProfile()?.level ?? (this.totalXp() >= NEXT_LEVEL_XP ? 8 : 7)
  );

  readonly levelTitle = computed(() =>
    this.heroProfile()?.heroName ?? this.state().selectedTitle
  );

  readonly nextLevelLabel = computed(() =>
    this.heroProfile()
      ? `Level ${this.level() + 1}`
      : this.level() >= 8 ? 'Level 9' : 'Level 8'
  );

  readonly xpToNextLevel = computed(() =>
    this.heroProfile()?.xpToNextLevel ?? Math.max(0, NEXT_LEVEL_XP - this.totalXp())
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

    const progress = this.totalXp() - CURRENT_LEVEL_XP;
    const span = NEXT_LEVEL_XP - CURRENT_LEVEL_XP;

    return Math.min(100, Math.max(0, Math.round((progress / span) * 100)));
  });

  readonly xpInCurrentLevel = computed(() => {
    const profile = this.heroProfile();

    if (profile) {
      return profile.xpInCurrentLevel;
    }

    return Math.max(0, this.totalXp() - CURRENT_LEVEL_XP);
  });

  readonly xpRequiredForNextLevel = computed(() =>
    this.heroProfile()?.xpRequiredForNextLevel ?? NEXT_LEVEL_XP - CURRENT_LEVEL_XP
  );

  readonly currentStreak = computed(() => {
    const profile = this.heroProfile();

    if (profile) {
      return profile.currentStreak;
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
    const completedCategories = this.categoryBreakdown().filter(
      (category) => category.completed > 0
    ).length;

    return [
      {
        id: 'first-light',
        title: 'First Light',
        summary: 'Complete the first quest of the day.',
        reward: '+25 XP',
        progress: Math.min(this.completedCount(), 1),
        target: 1,
        unlocked: this.completedCount() >= 1
      },
      {
        id: 'clean-sweep',
        title: 'Clean Sweep',
        summary: 'Finish every active quest in a daily run.',
        reward: 'Title shard',
        progress: this.completedCount(),
        target: this.questCount(),
        unlocked: this.questCount() > 0 && this.completedCount() === this.questCount()
      },
      {
        id: 'streak-adept',
        title: 'Streak Adept',
        summary: 'Keep a protected streak at 21 days.',
        reward: '+90 XP',
        progress: Math.min(this.currentStreak(), 21),
        target: 21,
        unlocked: this.currentStreak() >= 21
      },
      {
        id: 'balanced-build',
        title: 'Balanced Build',
        summary: 'Complete quests across four life areas.',
        reward: 'Profile frame',
        progress: completedCategories,
        target: 4,
        unlocked: completedCategories >= 4
      },
      {
        id: 'level-break',
        title: 'Level Break',
        summary: 'Reach 2,250 total XP.',
        reward: '+1 stat point',
        progress: Math.min(this.totalXp(), 2250),
        target: 2250,
        unlocked: this.totalXp() >= 2250
      }
    ];
  });

  readonly unlockedAchievements = computed(() =>
    this.achievements().filter((achievement) => achievement.unlocked)
  );

  loadQuests(): void {
    if (!this.usesQuestApi() || this.questsLoadedSignal() || this.questsLoadingSignal()) {
      return;
    }

    this.questsLoadingSignal.set(true);
    this.questErrorSignal.set(null);

    this.questApi
      .list(true)
      .pipe(finalize(() => this.questsLoadingSignal.set(false)))
      .subscribe({
        next: (quests) => {
          this.persistedQuests.set(quests.map((quest) => this.mapPersistedQuest(quest)));
          this.questsLoadedSignal.set(true);
        },
        error: (error: unknown) => {
          this.questErrorSignal.set(
            this.describeQuestError(error, 'Quests could not be loaded.')
          );
        }
      });
  }

  createQuest(request: QuestUpsertRequest): Observable<Quest> {
    this.questActionInFlightSignal.set(true);
    this.questErrorSignal.set(null);

    return this.questApi.create(request).pipe(
      map((quest) => this.mapPersistedQuest(quest)),
      tap((quest) => {
        this.persistedQuests.update((quests) => [...quests, quest]);
        this.questsLoadedSignal.set(true);
      }),
      catchError((error: unknown) =>
        this.captureQuestError<Quest>(error, 'Quest could not be created.')
      ),
      finalize(() => this.questActionInFlightSignal.set(false))
    );
  }

  updateQuest(id: string, request: QuestUpsertRequest): Observable<Quest> {
    this.questActionInFlightSignal.set(true);
    this.questErrorSignal.set(null);

    return this.questApi.update(id, request).pipe(
      map((quest) => this.mapPersistedQuest(quest)),
      tap((updatedQuest) => {
        this.persistedQuests.update((quests) =>
          quests.map((quest) => quest.id === updatedQuest.id ? updatedQuest : quest)
        );
      }),
      catchError((error: unknown) =>
        this.captureQuestError<Quest>(error, 'Quest could not be updated.')
      ),
      finalize(() => this.questActionInFlightSignal.set(false))
    );
  }

  archiveQuest(id: string): Observable<void> {
    this.questActionInFlightSignal.set(true);
    this.questErrorSignal.set(null);

    return this.questApi.archive(id).pipe(
      tap(() => {
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
      }),
      catchError((error: unknown) =>
        this.captureQuestError<void>(error, 'Quest could not be archived.')
      ),
      finalize(() => this.questActionInFlightSignal.set(false))
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
      tap((completion) => this.auth.updateHeroProfile(completion.heroProfile)),
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
        this.persistedQuests.update((quests) =>
          quests.map((candidate) =>
            candidate.id === completedQuest.id ? completedQuest : candidate
          )
        );
      }),
      catchError((error: unknown) =>
        this.captureQuestError<Quest>(error, 'Quest could not be completed.')
      ),
      finalize(() => this.setQuestCompletionInFlight(id, false))
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

  private captureQuestError<T>(error: unknown, fallback: string): Observable<T> {
    this.questErrorSignal.set(this.describeQuestError(error, fallback));

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
