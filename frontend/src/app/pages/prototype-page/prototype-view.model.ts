export type PrototypeView =
  | 'dashboard'
  | 'habits'
  | 'progress'
  | 'achievements'
  | 'analytics';

export type PrototypeViewCopy = Readonly<{
  eyebrowKey: string;
  titleKey: string;
  summaryKey: string;
}>;

export type PrototypeRouteConfig = Readonly<{
  path: PrototypeView;
  navLabelKey: string;
  titleKey: string;
}>;

export const PROTOTYPE_ROUTE_CONFIGS = [
  { path: 'dashboard', navLabelKey: 'navigation.today', titleKey: 'routes.dashboard' },
  { path: 'habits', navLabelKey: 'navigation.habits', titleKey: 'routes.habits' },
  { path: 'progress', navLabelKey: 'navigation.progress', titleKey: 'routes.progress' },
  { path: 'achievements', navLabelKey: 'navigation.achievements', titleKey: 'routes.achievements' },
  { path: 'analytics', navLabelKey: 'navigation.analytics', titleKey: 'routes.analytics' }
] satisfies readonly PrototypeRouteConfig[];

export const PROTOTYPE_VIEW_COPY = {
  dashboard: {
    eyebrowKey: 'views.dashboard.eyebrow',
    titleKey: 'views.dashboard.title',
    summaryKey: 'views.dashboard.summary'
  },
  habits: {
    eyebrowKey: 'views.habits.eyebrow',
    titleKey: 'views.habits.title',
    summaryKey: 'views.habits.summary'
  },
  progress: {
    eyebrowKey: 'views.progress.eyebrow',
    titleKey: 'views.progress.title',
    summaryKey: 'views.progress.summary'
  },
  achievements: {
    eyebrowKey: 'views.achievements.eyebrow',
    titleKey: 'views.achievements.title',
    summaryKey: 'views.achievements.summary'
  },
  analytics: {
    eyebrowKey: 'views.analytics.eyebrow',
    titleKey: 'views.analytics.title',
    summaryKey: 'views.analytics.summary'
  }
} satisfies Record<PrototypeView, PrototypeViewCopy>;

const PROTOTYPE_VIEWS = PROTOTYPE_ROUTE_CONFIGS.map(
  (routeConfig) => routeConfig.path
) satisfies readonly PrototypeView[];
const PROTOTYPE_VIEW_SET = new Set<string>(PROTOTYPE_VIEWS);

export function isPrototypeView(view: unknown): view is PrototypeView {
  return typeof view === 'string' && PROTOTYPE_VIEW_SET.has(view);
}
