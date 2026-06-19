import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../app.routes';
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
  heroProfile: {
    ...AUTH_ME_RESPONSE.heroProfile,
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
  heroProfile: {
    ...AUTH_ME_RESPONSE.heroProfile,
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

describe('Prototype routes', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it.each([
    ['/dashboard', 'Quest queue'],
    ['/quests', 'shown'],
    ['/hero', 'Player profile'],
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

  it('displays authenticated hero/profile data and the mock quest queue', async () => {
    const { nativeElement, state } = await renderPrototypeRoute('/dashboard');
    const pageText = textContent(nativeElement);

    expect(pageText).toContain(`Level ${AUTH_ME_RESPONSE.heroProfile.level}`);
    expect(pageText).toContain(AUTH_ME_RESPONSE.heroProfile.heroName);
    expect(state.levelTitle()).toBe(AUTH_ME_RESPONSE.heroProfile.heroName);
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
    expect(state.totalXp()).toBe(AUTH_ME_RESPONSE.heroProfile.totalXp);
    expect(pageText).toContain(`${state.completedCount()}/${state.questCount()}`);
  });
});

describe('Profile view', () => {
  beforeEach(() => {
    resetPrototypeStorage();
  });

  it('displays authenticated user and hero profile data', async () => {
    const { nativeElement } = await renderPrototypeRoute('/hero');
    const pageText = textContent(nativeElement);

    expect(pageText).toContain(AUTH_ME_RESPONSE.user.displayName);
    expect(pageText).toContain(AUTH_ME_RESPONSE.user.email);
    expect(pageText).toContain(AUTH_ME_RESPONSE.heroProfile.heroName);
    expect(pageText).toContain(`Level ${AUTH_ME_RESPONSE.heroProfile.level}`);
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
    const { api, nativeElement, harness } = await renderApiQuestRoute();

    getButtonByText(nativeElement, /^Complete today$/).click();
    harness.detectChanges();

    expect(api.complete).toHaveBeenCalledWith(API_QUEST.id);
    expect(textContent(nativeElement)).toContain('Done today');
    expect(textContent(nativeElement)).toContain('4-day streak');
    expect(textContent(nativeElement)).toContain('+20 XP awarded');
    expect(getButtonByText(nativeElement, /^Done today$/).disabled).toBe(true);
  });

  it('updates hero XP and level when completion returns updated profile data', async () => {
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

async function renderApiQuestRoute(
  api: QuestApiServiceStub = new QuestApiServiceStub()
): Promise<{
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
  | 'heroProfile'
  | 'isAuthenticated'
  | 'logout'
  | 'updateHeroProfile'
  | 'user'
> {
  const user = signal(AUTH_ME_RESPONSE.user);
  const heroProfile = signal(AUTH_ME_RESPONSE.heroProfile);
  const isAuthenticated = signal(true);
  const canUsePrototypeRoutes = signal(true);

  return {
    authRequired: true,
    canUsePrototypeRoutes: canUsePrototypeRoutes.asReadonly(),
    user: user.asReadonly(),
    heroProfile: heroProfile.asReadonly(),
    isAuthenticated: isAuthenticated.asReadonly(),
    hasToken: () => true,
    ensureCurrentUser: (): Observable<MeResponse> => of(AUTH_ME_RESPONSE),
    updateHeroProfile: (nextHeroProfile) => heroProfile.set(nextHeroProfile),
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
