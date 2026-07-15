import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import {
  HabitApiService,
  type HabitCompletionResponse,
  type HabitResponse
} from './habit-api.service';

const QUEST_RESPONSE: HabitResponse = {
  id: 'f3d9d772-8e0d-47f7-970b-56f757f85f4d',
  userId: 'f972df99-805d-48a3-93e6-e5c469ba8be6',
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

const QUEST_COMPLETION_RESPONSE: HabitCompletionResponse = {
  id: '889c6254-b88e-4606-98eb-651453c82382',
  habitId: QUEST_RESPONSE.id,
  userId: QUEST_RESPONSE.userId,
  completionDateUtc: '2026-06-18',
  completedAtUtc: '2026-06-18T13:00:00Z',
  xpAwarded: 20,
  wasAlreadyCompleted: false,
  progressProfile: {
    id: '883089e0-6d74-4564-814d-1a3c5fe1fcff',
    displayName: 'Morning Warden',
    level: 1,
    totalXp: 20,
    xpInCurrentLevel: 20,
    xpRequiredForNextLevel: 100,
    xpToNextLevel: 80,
    currentStreak: 0,
    createdAtUtc: '2026-06-17T20:00:00Z'
  },
  habit: {
    ...QUEST_RESPONSE,
    completedToday: true,
    completedTodayXpAwarded: 20,
    completedTodayAtUtc: '2026-06-18T13:00:00Z',
    currentStreak: 4,
    lastCompletedDateUtc: '2026-06-18',
    lastCompletedAtUtc: '2026-06-18T13:00:00Z'
  }
};

describe('HabitApiService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  it('loads habits with archived records included', async () => {
    const service = TestBed.inject(HabitApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.list());
    const request = http.expectOne(
      `${environment.apiUrl}/habits?includeArchived=true`
    );
    expect(request.request.method).toBe('GET');
    request.flush([QUEST_RESPONSE]);

    const response = await responsePromise;

    expect(response).toEqual([QUEST_RESPONSE]);
    http.verify();
  });

  it('loads a habit by id through the API', async () => {
    const service = TestBed.inject(HabitApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.get(QUEST_RESPONSE.id));
    const request = http.expectOne(`${environment.apiUrl}/habits/${QUEST_RESPONSE.id}`);
    expect(request.request.method).toBe('GET');
    request.flush(QUEST_RESPONSE);

    expect(await responsePromise).toEqual(QUEST_RESPONSE);
    http.verify();
  });

  it('creates a habit through the API', async () => {
    const service = TestBed.inject(HabitApiService);
    const http = TestBed.inject(HttpTestingController);

    const requestBody = {
      title: 'Morning training',
      description: 'Move before work.',
      category: 'Fitness' as const,
      difficulty: 'Medium' as const,
      frequency: 'Daily' as const
    };
    const responsePromise = firstValueFrom(service.create(requestBody));
    const request = http.expectOne(`${environment.apiUrl}/habits`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush(QUEST_RESPONSE);

    expect(await responsePromise).toEqual(QUEST_RESPONSE);
    http.verify();
  });

  it('updates a habit through the API', async () => {
    const service = TestBed.inject(HabitApiService);
    const http = TestBed.inject(HttpTestingController);

    const requestBody = {
      title: 'Evening training',
      description: 'Move after work.',
      category: 'Health' as const,
      difficulty: 'Hard' as const,
      frequency: 'Weekdays' as const
    };
    const responsePromise = firstValueFrom(
      service.update(QUEST_RESPONSE.id, requestBody)
    );
    const request = http.expectOne(`${environment.apiUrl}/habits/${QUEST_RESPONSE.id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(requestBody);
    request.flush({
      ...QUEST_RESPONSE,
      ...requestBody
    });

    expect(await responsePromise).toMatchObject(requestBody);
    http.verify();
  });

  it('archives a habit through the API', async () => {
    const service = TestBed.inject(HabitApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.archive(QUEST_RESPONSE.id));
    const request = http.expectOne(`${environment.apiUrl}/habits/${QUEST_RESPONSE.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    await responsePromise;
    http.verify();
  });

  it('completes a habit for today through the API', async () => {
    const service = TestBed.inject(HabitApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.complete(QUEST_RESPONSE.id));
    const request = http.expectOne(
      `${environment.apiUrl}/habits/${QUEST_RESPONSE.id}/complete`
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(QUEST_COMPLETION_RESPONSE);

    expect(await responsePromise).toEqual(QUEST_COMPLETION_RESPONSE);
    http.verify();
  });
});
