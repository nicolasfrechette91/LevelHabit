import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type AchievementResponse = Readonly<{
  key: string;
  title: string;
  description: string;
  rule: string;
  isUnlocked: boolean;
  unlockedAtUtc: string | null;
  progress: number;
  target: number;
  progressText: string;
}>;

@Injectable({
  providedIn: 'root'
})
export class AchievementApiService {
  private readonly http = inject(HttpClient);
  private readonly achievementsUrl = `${environment.apiUrl}/achievements`;

  list(): Observable<AchievementResponse[]> {
    return this.http.get<AchievementResponse[]>(this.achievementsUrl);
  }
}
