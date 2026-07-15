import type {
  PrototypeHabit,
  PrototypeTitle,
  StoredPrototypeState,
  WeekDay
} from './levelhabit.models';

export const LEVELHABIT_STORAGE_KEY = 'levelhabit.prototype.v1';
export const BASE_XP = 1840;
export const NEXT_LEVEL_XP = 2400;
export const CURRENT_LEVEL_XP = 1800;

export const PROTOTYPE_QUESTS = [
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
] satisfies readonly PrototypeHabit[];

export const DEFAULT_COMPLETED_IDS: readonly string[] = [
  'morning-training',
  'study-sprint'
];

export const WEEK_BASE = [
  { label: 'Mon', completed: 4, total: 5, xp: 310 },
  { label: 'Tue', completed: 5, total: 5, xp: 420 },
  { label: 'Wed', completed: 3, total: 5, xp: 260 },
  { label: 'Thu', completed: 4, total: 5, xp: 340 },
  { label: 'Fri', completed: 5, total: 5, xp: 450 },
  { label: 'Sat', completed: 2, total: 4, xp: 160 },
  { label: 'Today', completed: 0, total: PROTOTYPE_QUESTS.length, xp: 0 }
] satisfies readonly WeekDay[];

export const PROTOTYPE_TITLES = [
  'Streakwarden',
  'Habit Cartographer',
  'Focus Adept',
  'Routine Smith'
] satisfies readonly PrototypeTitle[];

export const DEFAULT_PROTOTYPE_STATE = {
  completedHabitIds: DEFAULT_COMPLETED_IDS,
  selectedTitle: 'Streakwarden'
} satisfies StoredPrototypeState;
