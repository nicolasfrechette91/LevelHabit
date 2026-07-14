import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../app.routes';
import {
  AchievementApiService,
  type AchievementResponse
} from '../../achievements/achievement-api.service';
import {
  AnalyticsApiService,
  type AnalyticsSummaryResponse
} from '../../analytics/analytics-api.service';
import { AuthService } from '../../auth/auth.service';
import type { MeResponse } from '../../auth/auth.models';
import {
  QuestApiService,
  type QuestCompletionResponse,
  type QuestResponse,
  type QuestUpsertRequest
} from '../../quests/quest-api.service';
import {
  DEFAULT_COMPLETED_IDS,
  PROTOTYPE_QUESTS
} from '../../state/levelhabit-prototype-data';
import {
  getButtonByText,
  getQuestToggle,
  renderPrototypeRoute,
  resetPrototypeStorage,
  AUTH_ME_RESPONSE,
  textContent
} from '../../test/prototype-test-utils';
import { PrototypePageComponent } from './prototype-page.component';

const API_QUEST: QuestResponse = {
  id: 'f3d9d772-8e0d-47f7-970b-56f757f85f4d',
  userId: AUTH_ME_RESPONSE.user.id,
  title: 'Morning training',
  description: 'Move before work.',
  category: 'Fitness',
  difficulty: 'Medium',
  frequency: 'Daily',
  xpReward: 20,
  isArchived: false,
  completedToday: false,
  completedTodayXpAwarded: null,
  completedTodayAtUtc: null,
  currentStreak: 3,
  bestStreak: 7,
  lastCompletedDateUtc: '2026-06-17',
  lastCompletedAtUtc: '2026-06-17T13:00:00Z',
  createdAtUtc: '2026-06-18T12:00:00Z',
  updatedAtUtc: '2026-06-18T12:00:00Z'
};

const COMPLETED_API_QUEST: QuestResponse = {
  ...API_QUEST,
  completedToday: true,
  completedTodayXpAwarded: 20,
  completedTodayAtUtc: '2026-06-18T13:00:00Z',
  currentStreak: 4,
  lastCompletedDateUtc: '2026-06-18',
  lastCompletedAtUtc: '2026-06-18T13:00:00Z'
};

const QUEST_COMPLETION_RESPONSE: QuestCompletionResponse = {
  id: '889c6254-b88e-4606-98eb-651453c82382',
  questId: API_QUEST.id,
  userId: API_QUEST.userId,
  completionDateUtc: '2026-06-18',
  completedAtUtc: '2026-06-18T13:00:00Z',
  xpAwarded: 20,
  wasAlreadyCompleted: false,
  progressProfile: {
    ...AUTH_ME_RESPONSE.progressProfile,
    level: 2,
    totalXp: 120,
    xpInCurrentLevel: 20,
    xpRequiredForNextLevel: 200,
    xpToNextLevel: 180
  },
  quest: COMPLETED_API_QUEST
};

const DUPLICATE_QUEST_COMPLETION_RESPONSE: QuestCompletionResponse = {
  ...QUEST_COMPLETION_RESPONSE,
  wasAlreadyCompleted: true,
  progressProfile: {
    ...AUTH_ME_RESPONSE.progressProfile,
    level: 1,
    totalXp: 20,
    xpInCurrentLevel: 20,
    xpRequiredForNextLevel: 100,
    xpToNextLevel: 80
  },
  quest: {
    ...COMPLETED_API_QUEST,
    currentStreak: API_QUEST.currentStreak,
    lastCompletedDateUtc: '2026-06-18',
    lastCompletedAtUtc: '2026-06-18T13:00:00Z'
  }
};

const CREATED_API_QUEST_ID = '12e799df-aeca-4bd1-a548-f69f3fabd7d';

const API_ACHIEVEMENTS: AchievementResponse[] = [
  {
    key: 'first-step',
    title: 'First Step',
    description: 'Complete your first quest.',
    rule: 'total-completions',
    isUnlocked: true,
    unlockedAtUtc: '2026-06-18T12:00:00Z',
    progress: 1,
    target: 1,
    progressText: '1/1 quest completions'
  },
  {
    key: 'getting-started',
    title: 'Getting Started',
    description: 'Complete 5 quests total.',
    rule: 'total-completions',
    isUnlocked: false,
    unlockedAtUtc: null,
    progress: 1,
    target: 5,
    progressText: '1/5 quest completions'
  }
];

const API_ANALYTICS_SUMMARY: AnalyticsSummaryResponse = {
  totalQuests: 3,
  activeQuests: 2,
  archivedQuests: 1,
  totalCompletions: 6,
  completionsToday: 1,
  completionsThisWeek: 4,
  completionsThisMonth: 5,
  totalXp: 320,
  currentLevel: 3,
  xpToNextLevel: 280,
  currentLevelProgressPercent: 7,
  currentStreakMax: 3,
  bestStreakMax: 5,
  achievementsUnlocked: 2,
  achievementsTotal: 9,
  completionsByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 1 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 1 },
    { dateUtc: '2026-06-18', value: 1 },
    { dateUtc: '2026-06-19', value: 1 }
  ],
  xpByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 35 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 10 },
    { dateUtc: '2026-06-18', value: 10 },
    { dateUtc: '2026-06-19', value: 10 }
  ],
  completionCountByCategory: [
    { name: 'Health', count: 3 },
    { name: 'Coding', count: 2 },
    { name: 'Chores', count: 1 }
  ],
  completionCountByDifficulty: [
    { name: 'Easy', count: 3 },
    { name: 'Hard', count: 2 },
    { name: 'Medium', count: 1 }
  ],
  recentCompletions: [
    {
      id: '889c6254-b88e-4606-98eb-651453c82382',
      questId: API_QUEST.id,
      questTitle: 'Morning training',
      category: 'Health',
      difficulty: 'Easy',
      completionDateUtc: '2026-06-19',
      completedAtUtc: '2026-06-19T08:00:00Z',
      xpAwarded: 10
    }
  ]
};

const EMPTY_API_ANALYTICS_SUMMARY: AnalyticsSummaryResponse = {
  totalQuests: 0,
  activeQuests: 0,
  archivedQuests: 0,
  totalCompletions: 0,
  completionsToday: 0,
  completionsThisWeek: 0,
  completionsThisMonth: 0,
  totalXp: 0,
  currentLevel: 1,
  xpToNextLevel: 100,
  currentLevelProgressPercent: 0,
  currentStreakMax: 0,
  bestStreakMax: 0,
  achievementsUnlocked: 0,
  achievementsTotal: 9,
  completionsByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 0 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 0 },
    { dateUtc: '2026-06-18', value: 0 },
    { dateUtc: '2026-06-19', value: 0 }
  ],
  xpByDay: [
    { dateUtc: '2026-06-13', value: 0 },
    { dateUtc: '2026-06-14', value: 0 },
    { dateUtc: '2026-06-15', value: 0 },
    { dateUtc: '2026-06-16', value: 0 },
    { dateUtc: '2026-06-17', value: 0 },
    { dateUtc: '2026-06-18', value: 0 },
    { dateUtc: '2026-06-19', value: 0 }
  ],
  completionCountByCategory: [],
  completionCountByDifficulty: [],
  recentCompletions: []
};

describe('Prototype routes', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it.each([
    ['/dashboard', 'Quest queue'],
    ['/quests', 'shown'],
    ['/progress', 'Personal progress'],
    ['/achievements', 'Unlocked'],
    ['/analytics', 'XP output']
  ])('renders %s without errors', async (path, expectedContent) => {
    const { nativeElement } = await renderPrototypeRoute(path);

    expect(textContent(nativeElement)).toContain(expectedContent);
  });
});

describe('Dashboard view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays authenticated progress profile data and the mock quest queue', async () => {
    const { nativeElement, state } = await renderPrototypeRoute('/dashboard');
    const pageText = textContent(nativeElement);

    expect(pageText).toContain(`Level ${AUTH_ME_RESPONSE.progressProfile.level}`);
    expect(pageText).toContain(AUTH_ME_RESPONSE.progressProfile.displayName);
    expect(state.levelTitle()).toBe(AUTH_ME_RESPONSE.progressProfile.displayName);
    expect(pageText).toContain(`${state.completedCount()}/${state.questCount()}`);

    for (const quest of PROTOTYPE_QUESTS.filter(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    )) {
      expect(pageText).toContain(quest.title);
    }
  });

  it('updates rendered completion when completing a mock quest', async () => {
    const { harness, nativeElement, state } = await renderPrototypeRoute('/dashboard');
    const quest = PROTOTYPE_QUESTS.find(
      (candidate) => !DEFAULT_COMPLETED_IDS.includes(candidate.id)
    );

    expect(quest).toBeDefined();

    getQuestToggle(nativeElement, quest!.title).click();
    harness.detectChanges();

    const pageText = textContent(nativeElement);

    expect(state.quests().find((candidate) => candidate.id === quest!.id)?.completed).toBe(true);
    expect(state.totalXp()).toBe(AUTH_ME_RESPONSE.progressProfile.totalXp);
    expect(pageText).toContain(`${state.completedCount()}/${state.questCount()}`);
  });
});

describe('Profile view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays authenticated user and progress profile data', async () => {
    const { nativeElement } = await renderPrototypeRoute('/progress');
    const pageText = textContent(nativeElement);

    expect(pageText).toContain(AUTH_ME_RESPONSE.user.displayName);
    expect(pageText).toContain(AUTH_ME_RESPONSE.user.email);
    expect(pageText).toContain(AUTH_ME_RESPONSE.progressProfile.displayName);
    expect(pageText).toContain(`Level ${AUTH_ME_RESPONSE.progressProfile.level}`);
  });
});

describe('Achievements view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays locked and unlocked achievements', async () => {
    const { nativeElement, state } = await renderPrototypeRoute('/achievements');
    const badges = Array.from(nativeElement.querySelectorAll('.achievement-state')).map(textContent);

    expect(state.achievements().some((achievement) => achievement.unlocked)).toBe(true);
    expect(state.achievements().some((achievement) => !achievement.unlocked)).toBe(true);
    expect(badges).toContain('Unlocked');
    expect(badges).toContain('Locked');
  });
});

describe('Achievements API view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('loads achievements from the API', async () => {
    const { achievementApi, nativeElement } = await renderApiAchievementRoute();

    expect(achievementApi.list).toHaveBeenCalled();
    expect(textContent(nativeElement)).toContain('First Step');
    expect(textContent(nativeElement)).toContain('Getting Started');
  });

  it('displays unlocked and locked API achievements', async () => {
    const { nativeElement } = await renderApiAchievementRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Unlocked');
    expect(pageText).toContain('Locked');
    expect(pageText).toContain('1/1 quest completions');
    expect(pageText).toContain('1/5 quest completions');
  });

  it('shows a friendly error when achievements cannot be loaded', async () => {
    const achievementApi = new AchievementApiServiceStub();
    achievementApi.list.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Server Error'
          })
      )
    );

    const { nativeElement } = await renderApiAchievementRoute(achievementApi);

    expect(textContent(nativeElement)).toContain(
      'Achievements could not be loaded.'
    );
  });
});

describe('Analytics API view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('loads the analytics summary from the API', async () => {
    const { analyticsApi, nativeElement } = await renderApiAnalyticsRoute();

    expect(analyticsApi.summary).toHaveBeenCalledTimes(1);
    expect(textContent(nativeElement)).toContain('Quest library');
    expect(textContent(nativeElement)).toContain('3 quests');
  });

  it('shows the loading state while analytics are pending', async () => {
    const analyticsApi = new AnalyticsApiServiceStub();
    const pendingSummary = new Subject<AnalyticsSummaryResponse>();
    analyticsApi.summary.mockReturnValueOnce(pendingSummary.asObservable());

    const { nativeElement, harness } = await renderApiAnalyticsRoute(analyticsApi);

    expect(textContent(nativeElement)).toContain('Loading analytics...');

    pendingSummary.next(API_ANALYTICS_SUMMARY);
    pendingSummary.complete();
    harness.detectChanges();
  });

  it('shows a friendly error when analytics cannot be loaded', async () => {
    const analyticsApi = new AnalyticsApiServiceStub();
    analyticsApi.summary.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Server Error'
          })
      )
    );

    const { nativeElement } = await renderApiAnalyticsRoute(analyticsApi);

    expect(textContent(nativeElement)).toContain('Analytics could not be loaded.');
  });

  it('displays empty/default analytics from the API', async () => {
    const analyticsApi = new AnalyticsApiServiceStub(EMPTY_API_ANALYTICS_SUMMARY);
    const { nativeElement } = await renderApiAnalyticsRoute(analyticsApi);
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('No persisted activity yet');
    expect(pageText).toContain('0 quests');
    expect(pageText).toContain('Level 1');
    expect(pageText).toContain('0/9');
    expect(pageText).toContain('Daily trends will appear');
    expect(pageText).toContain('No completion categories yet.');
    expect(pageText).toContain('Recent completions will appear');
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-completion-trend-bar"]').length
    ).toBe(7);
  });

  it('renders daily completion and XP trends from the API', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Last 7 days');
    expect(pageText).toContain('Daily completions');
    expect(pageText).toContain('XP earned');
    expect(pageText).toContain('4 total');
    expect(pageText).toContain('65 XP');
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-completion-trend-day"]').length
    ).toBe(7);
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-xp-trend-day"]').length
    ).toBe(7);
  });

  it('renders category and difficulty breakdowns from the API', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Category completions');
    expect(pageText).toContain('Challenge mix');
    expect(pageText).toContain('Health');
    expect(pageText).toContain('Coding');
    expect(pageText).toContain('Hard');
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-category-breakdown-row"]').length
    ).toBe(3);
    expect(
      nativeElement.querySelectorAll('[data-testid="analytics-difficulty-breakdown-row"]').length
    ).toBe(3);
  });

  it('renders level progress from the API', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const progress = nativeElement.querySelector(
      '[data-testid="analytics-level-progress"]'
    );

    expect(textContent(nativeElement)).toContain('Progress');
    expect(textContent(nativeElement)).toContain('Level 3');
    expect(progress).toBeInstanceOf(HTMLProgressElement);
    expect((progress as HTMLProgressElement).value).toBe(7);
  });

  it('renders real analytics summary values', async () => {
    const { nativeElement } = await renderApiAnalyticsRoute();
    const pageText = textContent(nativeElement);

    expect(pageText).toContain('6');
    expect(pageText).toContain('1 today');
    expect(pageText).toContain('4 this week');
    expect(pageText).toContain('320 XP');
    expect(pageText).toContain('Level 3');
    expect(pageText).toContain('280 XP to next');
    expect(pageText).toContain('2/9');
    expect(pageText).toContain('5d');
    expect(pageText).toContain('Health');
    expect(pageText).toContain('Easy');
    expect(pageText).toContain('Morning training');
    expect(pageText).toContain('+10 XP');
  });
});

describe('Quests view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('filters visible quests by active and archived state', async () => {
    const { harness, nativeElement, state } = await renderPrototypeRoute('/quests');
    const completedQuest = state.quests().find((quest) => quest.completed);
    const activeQuest = state.quests().find((quest) => !quest.completed);

    expect(completedQuest).toBeDefined();
    expect(activeQuest).toBeDefined();

    expect(textContent(nativeElement)).toContain(activeQuest!.title);
    expect(textContent(nativeElement)).not.toContain(completedQuest!.title);

    getButtonByText(nativeElement, /^All$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain(completedQuest!.title);

    getButtonByText(nativeElement, /^Archived$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain('No quests shown');
    expect(textContent(nativeElement)).not.toContain(completedQuest!.title);
    expect(textContent(nativeElement)).not.toContain(activeQuest!.title);
  });
});

describe('Quests API view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('loads quests from the API', async () => {
    const { api, nativeElement } = await renderApiQuestRoute();

    expect(api.list).toHaveBeenCalledWith(true);
    expect(textContent(nativeElement)).toContain(API_QUEST.title);
    expect(textContent(nativeElement)).toContain(API_QUEST.description);
    expect(textContent(nativeElement)).toContain('3-day streak');
    expect(textContent(nativeElement)).toContain('Best: 7');
  });

  it('creates quests through the API', async () => {
    const api = new QuestApiServiceStub([]);
    const { nativeElement, harness } = await renderApiQuestRoute(api);

    setFormField(harness, nativeElement, '#quest-title', 'Study sprint');
    setFormField(harness, nativeElement, '#quest-description', 'Read one chapter.');
    submitQuestForm(harness, nativeElement);

    expect(api.create).toHaveBeenCalledWith({
      title: 'Study sprint',
      description: 'Read one chapter.',
      category: 'Health',
      difficulty: 'Easy',
      frequency: 'Daily'
    });
    expect(textContent(nativeElement)).toContain('Study sprint');
  });

  it('updates quests through the API', async () => {
    const { api, nativeElement, harness } = await renderApiQuestRoute();

    getButtonByText(nativeElement, /^Edit$/).click();
    harness.detectChanges();

    setFormField(harness, nativeElement, '#quest-title', 'Evening training');
    setFormField(harness, nativeElement, '#quest-description', 'Move after work.');
    submitQuestForm(harness, nativeElement);

    expect(api.update).toHaveBeenCalledWith(API_QUEST.id, {
      title: 'Evening training',
      description: 'Move after work.',
      category: 'Fitness',
      difficulty: 'Medium',
      frequency: 'Daily'
    });
    expect(textContent(nativeElement)).toContain('Evening training');
  });

  it('archives quests through the API', async () => {
    const { api, nativeElement, harness } = await renderApiQuestRoute();

    getButtonByText(nativeElement, /^Archive$/).click();
    harness.detectChanges();

    expect(api.archive).toHaveBeenCalledWith(API_QUEST.id);
    expect(textContent(nativeElement)).toContain('No quests shown');
  });

  it('completes quests through the API', async () => {
    const { achievementApi, api, nativeElement, harness } = await renderApiQuestRoute();

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    expect(api.complete).toHaveBeenCalledWith(API_QUEST.id);
    expect(achievementApi.list).toHaveBeenCalledTimes(2);
    expect(textContent(nativeElement)).toContain('Done today');
    expect(textContent(nativeElement)).toContain('4-day streak');
    expect(textContent(nativeElement)).toContain('+20 XP awarded');
    expect(getButtonByText(nativeElement, /^Done today$/).disabled).toBe(true);
  });

  it('updates progress XP and level when completion returns updated profile data', async () => {
    const { nativeElement, harness } = await renderApiQuestRoute();

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    const pageText = textContent(nativeElement);

    expect(pageText).toContain('Level 2');
    expect(pageText).toContain('120');
    expect(pageText).toContain('20/200 XP');
    expect(pageText).toContain('180 to next');
  });

  it('displays completed-today state from the API', async () => {
    const api = new QuestApiServiceStub([COMPLETED_API_QUEST]);
    const { nativeElement } = await renderApiQuestRoute(api);

    expect(textContent(nativeElement)).toContain('Done today');
    expect(getButtonByText(nativeElement, /^Done today$/).disabled).toBe(true);
  });

  it('does not call the completion API for a quest already completed today', async () => {
    const api = new QuestApiServiceStub([COMPLETED_API_QUEST]);
    const { nativeElement, harness } = await renderApiQuestRoute(api);

    getButtonByText(nativeElement, /^Done today$/).click();
    harness.detectChanges();

    expect(api.complete).not.toHaveBeenCalled();
  });

  it('does not show duplicate XP gain when the API returns an existing completion', async () => {
    const api = new QuestApiServiceStub();
    api.complete.mockReturnValueOnce(of(DUPLICATE_QUEST_COMPLETION_RESPONSE));
    const { nativeElement, harness } = await renderApiQuestRoute(api);

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain('Done today');
    expect(textContent(nativeElement)).toContain('3-day streak');
    expect(textContent(nativeElement)).not.toContain('4-day streak');
    expect(textContent(nativeElement)).not.toContain('+20 XP awarded');
  });

  it('shows a friendly error when quest completion fails', async () => {
    const api = new QuestApiServiceStub();
    api.complete.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Server Error'
          })
      )
    );
    const { nativeElement, harness } = await renderApiQuestRoute(api);

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    expect(textContent(nativeElement)).toContain('Quest could not be completed.');
  });

  it('shows a friendly error when the API cannot be reached', async () => {
    const api = new QuestApiServiceStub();
    api.list.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            statusText: 'Unknown Error'
          })
      )
    );

    const { nativeElement } = await renderApiQuestRoute(api);

    expect(textContent(nativeElement)).toContain(
      'The backend is unavailable. Start the API and try again.'
    );
  });
});

class QuestApiServiceStub
  implements Pick<
    QuestApiService,
    'list' | 'get' | 'create' | 'update' | 'complete' | 'archive'
  >
{
  constructor(private readonly responses: QuestResponse[] = [API_QUEST]) {}

  readonly list = vi.fn((_includeArchived = true): Observable<QuestResponse[]> =>
    of(this.responses)
  );

  readonly get = vi.fn((id: string): Observable<QuestResponse> => {
    const response = this.responses.find((quest) => quest.id === id) ?? API_QUEST;

    return of(response);
  });

  readonly create = vi.fn((request: QuestUpsertRequest): Observable<QuestResponse> =>
    of({
      ...API_QUEST,
      ...request,
      id: CREATED_API_QUEST_ID,
      userId: AUTH_ME_RESPONSE.user.id,
      isArchived: false,
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDateUtc: null,
      lastCompletedAtUtc: null,
      createdAtUtc: '2026-06-19T12:00:00Z',
      updatedAtUtc: '2026-06-19T12:00:00Z'
    })
  );

  readonly update = vi.fn((
    id: string,
    request: QuestUpsertRequest
  ): Observable<QuestResponse> =>
    of({
      ...API_QUEST,
      ...request,
      id,
      updatedAtUtc: '2026-06-19T12:05:00Z'
    })
  );

  readonly complete = vi.fn((_id: string): Observable<QuestCompletionResponse> =>
    of(QUEST_COMPLETION_RESPONSE)
  );

  readonly archive = vi.fn((_id: string): Observable<void> => of(void 0));
}

class AchievementApiServiceStub implements Pick<AchievementApiService, 'list'> {
  constructor(
    private readonly responses: AchievementResponse[] = API_ACHIEVEMENTS
  ) {}

  readonly list = vi.fn((): Observable<AchievementResponse[]> =>
    of(this.responses)
  );
}

class AnalyticsApiServiceStub implements Pick<AnalyticsApiService, 'summary'> {
  constructor(
    private readonly response: AnalyticsSummaryResponse = API_ANALYTICS_SUMMARY
  ) {}

  readonly summary = vi.fn((): Observable<AnalyticsSummaryResponse> =>
    of(this.response)
  );
}

async function renderApiAchievementRoute(
  achievementApi: AchievementApiServiceStub = new AchievementApiServiceStub()
): Promise<{
  achievementApi: AchievementApiServiceStub;
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: createApiAuthService()
      },
      {
        provide: QuestApiService,
        useValue: new QuestApiServiceStub()
      },
      {
        provide: AchievementApiService,
        useValue: achievementApi
      },
      {
        provide: AnalyticsApiService,
        useValue: new AnalyticsApiServiceStub()
      }
    ]
  });

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/achievements', PrototypePageComponent);
  const nativeElement = harness.routeNativeElement;

  if (!nativeElement) {
    throw new Error('Achievements route did not render a native element.');
  }

  return {
    achievementApi,
    harness,
    nativeElement
  };
}

async function renderApiAnalyticsRoute(
  analyticsApi: AnalyticsApiServiceStub = new AnalyticsApiServiceStub()
): Promise<{
  analyticsApi: AnalyticsApiServiceStub;
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: createApiAuthService()
      },
      {
        provide: QuestApiService,
        useValue: new QuestApiServiceStub()
      },
      {
        provide: AchievementApiService,
        useValue: new AchievementApiServiceStub()
      },
      {
        provide: AnalyticsApiService,
        useValue: analyticsApi
      }
    ]
  });

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/analytics', PrototypePageComponent);
  const nativeElement = harness.routeNativeElement;

  if (!nativeElement) {
    throw new Error('Analytics route did not render a native element.');
  }

  return {
    analyticsApi,
    harness,
    nativeElement
  };
}

async function renderApiQuestRoute(
  api: QuestApiServiceStub = new QuestApiServiceStub(),
  achievementApi: AchievementApiServiceStub = new AchievementApiServiceStub()
): Promise<{
  achievementApi: AchievementApiServiceStub;
  api: QuestApiServiceStub;
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: createApiAuthService()
      },
      {
        provide: QuestApiService,
        useValue: api
      },
      {
        provide: AchievementApiService,
        useValue: achievementApi
      },
      {
        provide: AnalyticsApiService,
        useValue: new AnalyticsApiServiceStub()
      }
    ]
  });

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/quests', PrototypePageComponent);
  const nativeElement = harness.routeNativeElement;

  if (!nativeElement) {
    throw new Error('Quests route did not render a native element.');
  }

  return {
    achievementApi,
    api,
    harness,
    nativeElement
  };
}

function createApiAuthService(): Pick<
  AuthService,
  | 'authRequired'
  | 'canUsePrototypeRoutes'
  | 'ensureCurrentUser'
  | 'hasToken'
  | 'progressProfile'
  | 'isAuthenticated'
  | 'logout'
  | 'updateProgressProfile'
  | 'user'
> {
  const user = signal(AUTH_ME_RESPONSE.user);
  const progressProfile = signal(AUTH_ME_RESPONSE.progressProfile);
  const isAuthenticated = signal(true);
  const canUsePrototypeRoutes = signal(true);

  return {
    authRequired: true,
    canUsePrototypeRoutes: canUsePrototypeRoutes.asReadonly(),
    user: user.asReadonly(),
    progressProfile: progressProfile.asReadonly(),
    isAuthenticated: isAuthenticated.asReadonly(),
    hasToken: () => true,
    ensureCurrentUser: (): Observable<MeResponse> => of(AUTH_ME_RESPONSE),
    updateProgressProfile: (nextProgressProfile) => progressProfile.set(nextProgressProfile),
    logout: () => undefined
  };
}

function setFormField(
  harness: RouterTestingHarness,
  container: ParentNode,
  selector: string,
  value: string
): void {
  const field = container.querySelector(selector);

  if (
    !(field instanceof HTMLInputElement) &&
    !(field instanceof HTMLTextAreaElement)
  ) {
    throw new Error(`Form field not found: ${selector}`);
  }

  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  harness.detectChanges();
}

function submitQuestForm(
  harness: RouterTestingHarness,
  container: ParentNode
): void {
  const form = container.querySelector('.quest-editor form');

  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Quest form not found.');
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  harness.detectChanges();
}
