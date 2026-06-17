import { Injectable, computed, signal } from '@angular/core';

export type QuestCategory = 'Mind' | 'Body' | 'Craft' | 'Home';
export type QuestDifficulty = 'Easy' | 'Standard' | 'Boss';

export type Quest = {
  id: string;
  title: string;
  category: QuestCategory;
  summary: string;
  cadence: string;
  xp: number;
  streak: number;
  difficulty: QuestDifficulty;
  accent: 'emerald' | 'indigo' | 'amber' | 'rose' | 'cyan';
  completed: boolean;
};

export type Achievement = {
  id: string;
  title: string;
  summary: string;
  reward: string;
  progress: number;
  target: number;
  unlocked: boolean;
};

export type WeekDay = {
  label: string;
  completed: number;
  total: number;
  xp: number;
};

export type CategoryBreakdown = {
  category: QuestCategory;
  completed: number;
  total: number;
  xp: number;
  percent: number;
};

type StoredPrototypeState = {
  completedQuestIds: string[];
  selectedTitle: string;
};

const STORAGE_KEY = 'levelhabit.prototype.v1';
const BASE_XP = 1840;
const NEXT_LEVEL_XP = 2400;
const CURRENT_LEVEL_XP = 1800;

const QUESTS: Omit<Quest, 'completed'>[] = [
  {
    id: 'morning-training',
    title: 'Morning training',
    category: 'Body',
    summary: 'Move with intent before the day gets loud.',
    cadence: 'Daily',
    xp: 80,
    streak: 14,
    difficulty: 'Standard',
    accent: 'emerald'
  },
  {
    id: 'deep-work-focus',
    title: 'Deep work focus',
    category: 'Craft',
    summary: 'One protected block for the project that matters.',
    cadence: 'Weekdays',
    xp: 120,
    streak: 6,
    difficulty: 'Boss',
    accent: 'indigo'
  },
  {
    id: 'study-sprint',
    title: 'Study sprint',
    category: 'Mind',
    summary: 'Read, review, or practice one useful concept.',
    cadence: 'Daily',
    xp: 70,
    streak: 9,
    difficulty: 'Easy',
    accent: 'cyan'
  },
  {
    id: 'meal-prep',
    title: 'Meal prep',
    category: 'Home',
    summary: 'Set up tomorrow with one clean food choice.',
    cadence: 'Tue Thu Sun',
    xp: 60,
    streak: 3,
    difficulty: 'Easy',
    accent: 'amber'
  },
  {
    id: 'evening-reflection',
    title: 'Evening reflection',
    category: 'Mind',
    summary: 'Close the loop with a short note and a plan.',
    cadence: 'Daily',
    xp: 90,
    streak: 21,
    difficulty: 'Standard',
    accent: 'rose'
  }
];

const DEFAULT_COMPLETED_IDS = ['morning-training', 'study-sprint'];

const WEEK_BASE: WeekDay[] = [
  { label: 'Mon', completed: 4, total: 5, xp: 310 },
  { label: 'Tue', completed: 5, total: 5, xp: 420 },
  { label: 'Wed', completed: 3, total: 5, xp: 260 },
  { label: 'Thu', completed: 4, total: 5, xp: 340 },
  { label: 'Fri', completed: 5, total: 5, xp: 450 },
  { label: 'Sat', completed: 2, total: 4, xp: 160 },
  { label: 'Today', completed: 0, total: QUESTS.length, xp: 0 }
];

const TITLES = [
  'Streakwarden',
  'Quest Cartographer',
  'Focus Adept',
  'Routine Smith'
];

@Injectable({
  providedIn: 'root'
})
export class LevelHabitStateService {
  private readonly state = signal<StoredPrototypeState>(this.loadState());

  readonly availableTitles = TITLES;

  readonly quests = computed<Quest[]>(() => {
    const completedQuestIds = new Set(this.state().completedQuestIds);

    return QUESTS.map((quest) => ({
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
  readonly questCount = computed(() => QUESTS.length);

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
      new Set(QUESTS.map((quest) => quest.category))
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
      completedQuestIds: QUESTS.map((quest) => quest.id)
    });
  }

  resetToday(): void {
    this.saveState({
      ...this.state(),
      completedQuestIds: []
    });
  }

  selectTitle(title: string): void {
    if (!TITLES.includes(title)) {
      return;
    }

    this.saveState({
      ...this.state(),
      selectedTitle: title
    });
  }

  private loadState(): StoredPrototypeState {
    const fallback: StoredPrototypeState = {
      completedQuestIds: DEFAULT_COMPLETED_IDS,
      selectedTitle: TITLES[0]
    };

    if (typeof localStorage === 'undefined') {
      return fallback;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return fallback;
      }

      const parsed = JSON.parse(stored) as Partial<StoredPrototypeState>;
      const validQuestIds = new Set(QUESTS.map((quest) => quest.id));
      const completedQuestIds = Array.isArray(parsed.completedQuestIds)
        ? parsed.completedQuestIds.filter((id) => validQuestIds.has(id))
        : fallback.completedQuestIds;

      return {
        completedQuestIds,
        selectedTitle:
          typeof parsed.selectedTitle === 'string' &&
          TITLES.includes(parsed.selectedTitle)
            ? parsed.selectedTitle
            : fallback.selectedTitle
      };
    } catch {
      return fallback;
    }
  }

  private saveState(nextState: StoredPrototypeState): void {
    this.state.set(nextState);

    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }
}
