import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import {
  AnalyticsApiService,
  type AnalyticsSummaryResponse
} from './analytics-api.service';

const ANALYTICS_SUMMARY: AnalyticsSummaryResponse = {
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
  bestStreakMax: 3,
  achievementsUnlocked: 2,
  achievementsTotal: 9,
  completionCountByCategory: [
    { name: 'Health', count: 3 },
    { name: 'Coding', count: 2 }
  ],
  completionCountByDifficulty: [
    { name: 'Easy', count: 3 },
    { name: 'Hard', count: 2 }
  ],
  recentCompletions: [
    {
      id: '889c6254-b88e-4606-98eb-651453c82382',
      questId: 'f3d9d772-8e0d-47f7-970b-56f757f85f4d',
      questTitle: 'Morning training',
      category: 'Health',
      difficulty: 'Easy',
      completionDateUtc: '2026-06-19',
      completedAtUtc: '2026-06-19T08:00:00Z',
      xpAwarded: 10
    }
  ]
};

describe('AnalyticsApiService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  it('loads the analytics summary through the API', async () => {
    const service = TestBed.inject(AnalyticsApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.summary());
    const request = http.expectOne(`${environment.apiUrl}/analytics/summary`);
    expect(request.request.method).toBe('GET');
    request.flush(ANALYTICS_SUMMARY);

    expect(await responsePromise).toEqual(ANALYTICS_SUMMARY);
    http.verify();
  });
});
