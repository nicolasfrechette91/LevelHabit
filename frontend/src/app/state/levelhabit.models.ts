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

export type PersistedQuestCategory = (typeof PERSISTED_QUEST_CATEGORIES)[number];
export type PersistedQuestDifficulty = (typeof PERSISTED_QUEST_DIFFICULTIES)[number];
export type PersistedQuestFrequency = (typeof PERSISTED_QUEST_FREQUENCIES)[number];
export type QuestCategory =
  | PersistedQuestCategory
  | 'Mind'
  | 'Body'
  | 'Craft'
  | 'Home';
export type QuestDifficulty = PersistedQuestDifficulty | 'Standard' | 'Boss';
export type QuestAccent = 'emerald' | 'indigo' | 'amber' | 'rose' | 'cyan';
export type PrototypeTitle =
  | 'Streakwarden'
  | 'Quest Cartographer'
  | 'Focus Adept'
  | 'Routine Smith';

export type PrototypeQuest = Readonly<{
  id: string;
  title: string;
  category: QuestCategory;
  summary: string;
  cadence: string;
  xp: number;
  streak: number;
  difficulty: QuestDifficulty;
  accent: QuestAccent;
}>;

export type Quest = PrototypeQuest &
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
  category: QuestCategory;
  completed: number;
  total: number;
  xp: number;
  percent: number;
}>;

export type StoredPrototypeState = Readonly<{
  completedQuestIds: readonly string[];
  selectedTitle: PrototypeTitle;
}>;
