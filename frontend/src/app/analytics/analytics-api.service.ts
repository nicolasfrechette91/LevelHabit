import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type AnalyticsBucketResponse = Readonly<{
  name: string;
  count: number;
}>;

export type AnalyticsDailyMetricResponse = Readonly<{
  dateUtc: string;
  value: number;
}>;

export type AnalyticsRecentCompletionResponse = Readonly<{
  id: string;
  habitId: string;
  habitTitle: string;
  category: string;
  difficulty: string;
  completionDateUtc: string;
  completedAtUtc: string;
  xpAwarded: number;
}>;

export type AnalyticsSummaryResponse = Readonly<{
  totalHabits: number;
  activeHabits: number;
  archivedHabits: number;
  totalCompletions: number;
  completionsToday: number;
  completionsThisWeek: number;
  completionsThisMonth: number;
  totalXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  currentLevelProgressPercent: number;
  currentStreakMax: number;
  bestStreakMax: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  completionsByDay?: readonly AnalyticsDailyMetricResponse[];
  xpByDay?: readonly AnalyticsDailyMetricResponse[];
  completionCountByCategory: readonly AnalyticsBucketResponse[];
  completionCountByDifficulty: readonly AnalyticsBucketResponse[];
  recentCompletions: readonly AnalyticsRecentCompletionResponse[];
}>;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsApiService {
  private readonly http = inject(HttpClient);
  private readonly analyticsUrl = `${environment.apiUrl}/analytics`;

  summary(): Observable<AnalyticsSummaryResponse> {
    return this.http.get<AnalyticsSummaryResponse>(
      `${this.analyticsUrl}/summary`
    );
  }
}
