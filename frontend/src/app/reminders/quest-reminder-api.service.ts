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

export type QuestReminderResponse = Readonly<{
  id: string | null;
  questId: string;
  isEnabled: boolean;
  time: string | null;
  timeZoneId: string | null;
  daysOfWeek: ReminderDay[];
  lastTriggeredAtUtc: string | null;
  nextTriggerAtUtc: string | null;
  createdAtUtc: string | null;
  updatedAtUtc: string | null;
}>;

export type UpsertQuestReminderRequest = Readonly<{
  isEnabled: boolean;
  time: string | null;
  timeZoneId: string | null;
  daysOfWeek: ReminderDay[] | null;
}>;

@Injectable({
  providedIn: 'root'
})
export class QuestReminderApiService {
  private readonly http = inject(HttpClient);
  private readonly questsUrl = `${environment.apiUrl}/quests`;

  get(questId: string): Observable<QuestReminderResponse> {
    return this.http.get<QuestReminderResponse>(
      `${this.questsUrl}/${questId}/reminder`
    );
  }

  upsert(
    questId: string,
    request: UpsertQuestReminderRequest
  ): Observable<QuestReminderResponse> {
    return this.http.put<QuestReminderResponse>(
      `${this.questsUrl}/${questId}/reminder`,
      request
    );
  }

  delete(questId: string): Observable<void> {
    return this.http.delete<void>(`${this.questsUrl}/${questId}/reminder`);
  }
}
