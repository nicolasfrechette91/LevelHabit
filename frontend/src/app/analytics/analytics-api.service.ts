import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type AnalyticsBucketResponse = Readonly<{
  name: string;
  count: number;
}>;

export type AnalyticsRecentCompletionResponse = Readonly<{
  id: string;
  questId: string;
  questTitle: string;
  category: string;
  difficulty: string;
  completionDateUtc: string;
  completedAtUtc: string;
  xpAwarded: number;
}>;

export type AnalyticsSummaryResponse = Readonly<{
  totalQuests: number;
  activeQuests: number;
  archivedQuests: number;
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
