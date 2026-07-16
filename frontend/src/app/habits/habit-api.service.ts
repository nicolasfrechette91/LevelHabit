import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import type { ProgressProfile } from '../auth/auth.models';
import type {
  PersistedHabitCategory,
  PersistedHabitDifficulty,
  PersistedHabitFrequency
} from '../state/levelhabit.models';

export const HABIT_TITLE_MAX_LENGTH = 140;
export const HABIT_DESCRIPTION_MAX_LENGTH = 1000;

export type HabitResponse = Readonly<{
  id: string;
  userId: string;
  title: string;
  description: string;
  category: PersistedHabitCategory;
  difficulty: PersistedHabitDifficulty;
  frequency: PersistedHabitFrequency;
  xpReward: number;
  isArchived: boolean;
  completedToday: boolean;
  completedTodayXpAwarded: number | null;
  completedTodayAtUtc: string | null;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDateUtc: string | null;
  lastCompletedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}>;

export type HabitCompletionResponse = Readonly<{
  id: string;
  habitId: string;
  userId: string;
  completionDateUtc: string;
  completedAtUtc: string;
  xpAwarded: number;
  wasAlreadyCompleted: boolean;
  progressProfile: ProgressProfile;
  habit: HabitResponse;
}>;

export type HabitUpsertRequest = Readonly<{
  title: string;
  description: string;
  category: PersistedHabitCategory;
  difficulty: PersistedHabitDifficulty;
  frequency: PersistedHabitFrequency;
}>;

@Injectable({
  providedIn: 'root'
})
export class HabitApiService {
  private readonly http = inject(HttpClient);
  private readonly habitsUrl = `${environment.apiUrl}/habits`;

  list(includeArchived = true): Observable<HabitResponse[]> {
    return this.http.get<HabitResponse[]>(this.habitsUrl, {
      params: {
        includeArchived
      }
    });
  }

  get(id: string): Observable<HabitResponse> {
    return this.http.get<HabitResponse>(`${this.habitsUrl}/${id}`);
  }

  create(request: HabitUpsertRequest): Observable<HabitResponse> {
    return this.http.post<HabitResponse>(this.habitsUrl, request);
  }

  update(id: string, request: HabitUpsertRequest): Observable<HabitResponse> {
    return this.http.put<HabitResponse>(`${this.habitsUrl}/${id}`, request);
  }

  complete(id: string): Observable<HabitCompletionResponse> {
    return this.http.post<HabitCompletionResponse>(
      `${this.habitsUrl}/${id}/complete`,
      null
    );
  }

  archive(id: string): Observable<void> {
    return this.http.delete<void>(`${this.habitsUrl}/${id}`);
  }
}
