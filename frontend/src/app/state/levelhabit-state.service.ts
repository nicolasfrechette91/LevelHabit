import { Injectable, computed, signal } from '@angular/core';

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
  private readonly validQuestIds = new Set<string>(
    PROTOTYPE_QUESTS.map((quest) => quest.id)
  );
  private readonly validTitles = new Set<string>(PROTOTYPE_TITLES);
  private readonly state = signal<StoredPrototypeState>(this.loadState());

  readonly availableTitles = PROTOTYPE_TITLES;

  readonly quests = computed<Quest[]>(() => {
    const completedQuestIds = new Set(this.state().completedQuestIds);

    return PROTOTYPE_QUESTS.map((quest) => ({
      ...quest,
      completed: completedQuestIds.has(quest.id)
    }));
  });

  readonly completedQuests = computed(() =>
    this.quests().filter((quest) => quest.completed)
  );

  readonly activeQuests = computed(() =>
    this.quests().filter((quest) => !quest.completed)
  );

  readonly completedCount = computed(() => this.completedQuests().length);
  readonly questCount = computed(() => PROTOTYPE_QUESTS.length);

  readonly earnedXp = computed(() =>
    this.completedQuests().reduce((total, quest) => total + quest.xp, 0)
  );

  readonly totalXp = computed(() => BASE_XP + this.earnedXp());

  readonly level = computed(() =>
    this.totalXp() >= NEXT_LEVEL_XP ? 8 : 7
  );

  readonly levelTitle = computed(() => this.state().selectedTitle);

  readonly nextLevelLabel = computed(() =>
    this.level() >= 8 ? 'Level 9' : 'Level 8'
  );

  readonly xpToNextLevel = computed(() =>
    Math.max(0, NEXT_LEVEL_XP - this.totalXp())
  );

  readonly levelProgress = computed(() => {
    const progress = this.totalXp() - CURRENT_LEVEL_XP;
    const span = NEXT_LEVEL_XP - CURRENT_LEVEL_XP;

    return Math.min(100, Math.max(0, Math.round((progress / span) * 100)));
  });

  readonly currentStreak = computed(() => {
    const completedStreaks = this.completedQuests().map((quest) => quest.streak);
    const bestToday = completedStreaks.length > 0 ? Math.max(...completedStreaks) : 0;

    return bestToday + (this.completedCount() >= 4 ? 1 : 0);
  });

  readonly completionPercent = computed(() =>
    Math.round((this.completedCount() / this.questCount()) * 100)
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
      (total, day) => total + day.completed / day.total,
      0
    );

    return Math.round((totalCompletion / this.weeklyHistory().length) * 100);
  });

  readonly categoryBreakdown = computed<CategoryBreakdown[]>(() => {
    const categories = Array.from(
      new Set(PROTOTYPE_QUESTS.map((quest) => quest.category))
    ) as QuestCategory[];

    return categories.map((category) => {
      const quests = this.quests().filter((quest) => quest.category === category);
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
        unlocked: this.completedCount() === this.questCount()
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

  toggleQuest(questId: string): void {
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
    this.saveState({
      ...this.state(),
      completedQuestIds: PROTOTYPE_QUESTS.map((quest) => quest.id)
    });
  }

  resetToday(): void {
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
}
