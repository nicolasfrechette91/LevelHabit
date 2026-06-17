export type QuestCategory = 'Mind' | 'Body' | 'Craft' | 'Home';
export type QuestDifficulty = 'Easy' | 'Standard' | 'Boss';
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
  }>;

export type Achievement = Readonly<{
  id: string;
  title: string;
  summary: string;
  reward: string;
  progress: number;
  target: number;
  unlocked: boolean;
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
