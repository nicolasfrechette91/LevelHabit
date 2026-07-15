export const PERSISTED_QUEST_CATEGORIES = [
  'Health',
  'Fitness',
  'Learning',
  'Coding',
  'Chores',
  'Personal'
] as const;

export const PERSISTED_QUEST_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

export const PERSISTED_QUEST_FREQUENCIES = [
  'Daily',
  'Weekdays',
  'Weekly',
  'Custom'
] as const;

export type PersistedHabitCategory = (typeof PERSISTED_QUEST_CATEGORIES)[number];
export type PersistedHabitDifficulty = (typeof PERSISTED_QUEST_DIFFICULTIES)[number];
export type PersistedHabitFrequency = (typeof PERSISTED_QUEST_FREQUENCIES)[number];
export type HabitCategory =
  | PersistedHabitCategory
  | 'Mind'
  | 'Body'
  | 'Craft'
  | 'Home';
export type HabitDifficulty = PersistedHabitDifficulty | 'Standard' | 'Boss';
export type HabitAccent = 'emerald' | 'indigo' | 'amber' | 'rose' | 'cyan';
export type PrototypeTitle =
  | 'Streakwarden'
  | 'Habit Cartographer'
  | 'Focus Adept'
  | 'Routine Smith';

export type PrototypeHabit = Readonly<{
  id: string;
  title: string;
  category: HabitCategory;
  summary: string;
  cadence: string;
  xp: number;
  streak: number;
  difficulty: HabitDifficulty;
  accent: HabitAccent;
}>;

export type Habit = PrototypeHabit &
  Readonly<{
    completed: boolean;
    userId?: string;
    isArchived?: boolean;
    completedTodayAtUtc?: string;
    completedTodayXpAwarded?: number;
    bestStreak?: number;
    lastCompletedDateUtc?: string;
    lastCompletedAtUtc?: string;
    xpAwardedJustNow?: number;
    createdAtUtc?: string;
    updatedAtUtc?: string;
  }>;

export type Achievement = Readonly<{
  id: string;
  title: string;
  summary: string;
  progress: number;
  target: number;
  progressText?: string;
  unlocked: boolean;
  unlockedAtUtc?: string;
}>;

export type WeekDay = Readonly<{
  label: string;
  completed: number;
  total: number;
  xp: number;
}>;

export type CategoryBreakdown = Readonly<{
  category: HabitCategory;
  completed: number;
  total: number;
  xp: number;
  percent: number;
}>;

export type StoredPrototypeState = Readonly<{
  completedHabitIds: readonly string[];
  selectedTitle: PrototypeTitle;
}>;
