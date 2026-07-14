export type PrototypeView =
  | 'dashboard'
  | 'quests'
  | 'progress'
  | 'achievements'
  | 'analytics';

export type PrototypeViewCopy = Readonly<{
  eyebrow: string;
  title: string;
  summary: string;
}>;

export type PrototypeRouteConfig = Readonly<{
  path: PrototypeView;
  navLabel: string;
  title: string;
}>;

export const PROTOTYPE_ROUTE_CONFIGS = [
  { path: 'dashboard', navLabel: 'Today', title: 'Dashboard' },
  { path: 'quests', navLabel: 'Quests', title: 'Quests' },
  { path: 'progress', navLabel: 'Progress', title: 'Progress' },
  { path: 'achievements', navLabel: 'Achievements', title: 'Achievements' },
  { path: 'analytics', navLabel: 'Analytics', title: 'Analytics' }
] satisfies readonly PrototypeRouteConfig[];

export const PROTOTYPE_VIEW_COPY = {
  dashboard: {
    eyebrow: 'Today',
    title: 'Quest board',
    summary: 'A focused run of daily habits, XP progress, streak safety, and rewards.'
  },
  quests: {
    eyebrow: 'Quest log',
    title: 'Active habits',
    summary: 'Daily routines framed as repeatable quests with cadence, difficulty, and XP.'
  },
  progress: {
    eyebrow: 'Progress',
    title: 'Your progress',
    summary: 'Build consistency, track your growth, and turn daily habits into lasting progress.'
  },
  achievements: {
    eyebrow: 'Achievements',
    title: 'Milestone vault',
    summary: 'Unlockable badges for streaks, balanced routines, and high-consistency days.'
  },
  analytics: {
    eyebrow: 'Analytics',
    title: 'Consistency map',
    summary: 'A lightweight read on weekly momentum, category balance, and XP output.'
  }
} satisfies Record<PrototypeView, PrototypeViewCopy>;

const PROTOTYPE_VIEWS = PROTOTYPE_ROUTE_CONFIGS.map(
  (routeConfig) => routeConfig.path
) satisfies readonly PrototypeView[];
const PROTOTYPE_VIEW_SET = new Set<string>(PROTOTYPE_VIEWS);

export function isPrototypeView(view: unknown): view is PrototypeView {
  return typeof view === 'string' && PROTOTYPE_VIEW_SET.has(view);
}
