import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export const REMINDER_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const;

export type ReminderDay = (typeof REMINDER_DAYS)[number];

export type HabitReminderResponse = Readonly<{
  id: string | null;
  habitId: string;
  isEnabled: boolean;
  time: string | null;
  timeZoneId: string | null;
  daysOfWeek: ReminderDay[];
  lastTriggeredAtUtc: string | null;
  nextTriggerAtUtc: string | null;
  createdAtUtc: string | null;
  updatedAtUtc: string | null;
}>;

export type UpsertHabitReminderRequest = Readonly<{
  isEnabled: boolean;
  time: string | null;
  timeZoneId: string | null;
  daysOfWeek: ReminderDay[] | null;
}>;

@Injectable({
  providedIn: 'root'
})
export class HabitReminderApiService {
  private readonly http = inject(HttpClient);
  private readonly habitsUrl = `${environment.apiUrl}/habits`;

  get(habitId: string): Observable<HabitReminderResponse> {
    return this.http.get<HabitReminderResponse>(
      `${this.habitsUrl}/${habitId}/reminder`
    );
  }

  upsert(
    habitId: string,
    request: UpsertHabitReminderRequest
  ): Observable<HabitReminderResponse> {
    return this.http.put<HabitReminderResponse>(
      `${this.habitsUrl}/${habitId}/reminder`,
      request
    );
  }

  delete(habitId: string): Observable<void> {
    return this.http.delete<void>(`${this.habitsUrl}/${habitId}/reminder`);
  }
}
