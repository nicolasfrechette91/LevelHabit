import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import type {
  PersistedQuestCategory,
  PersistedQuestDifficulty,
  PersistedQuestFrequency
} from '../state/levelhabit.models';

export type QuestResponse = Readonly<{
  id: string;
  userId: string;
  title: string;
  description: string;
  category: PersistedQuestCategory;
  difficulty: PersistedQuestDifficulty;
  frequency: PersistedQuestFrequency;
  isArchived: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}>;

export type QuestUpsertRequest = Readonly<{
  title: string;
  description: string;
  category: PersistedQuestCategory;
  difficulty: PersistedQuestDifficulty;
  frequency: PersistedQuestFrequency;
}>;

@Injectable({
  providedIn: 'root'
})
export class QuestApiService {
  private readonly http = inject(HttpClient);
  private readonly questsUrl = `${environment.apiUrl}/quests`;

  list(includeArchived = true): Observable<QuestResponse[]> {
    return this.http.get<QuestResponse[]>(this.questsUrl, {
      params: {
        includeArchived
      }
    });
  }

  get(id: string): Observable<QuestResponse> {
    return this.http.get<QuestResponse>(`${this.questsUrl}/${id}`);
  }

  create(request: QuestUpsertRequest): Observable<QuestResponse> {
    return this.http.post<QuestResponse>(this.questsUrl, request);
  }

  update(id: string, request: QuestUpsertRequest): Observable<QuestResponse> {
    return this.http.put<QuestResponse>(`${this.questsUrl}/${id}`, request);
  }

  archive(id: string): Observable<void> {
    return this.http.delete<void>(`${this.questsUrl}/${id}`);
  }
}
