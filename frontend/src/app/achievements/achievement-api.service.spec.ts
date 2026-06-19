import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import {
  AchievementApiService,
  type AchievementResponse
} from './achievement-api.service';

const ACHIEVEMENT_RESPONSE: AchievementResponse = {
  key: 'first-step',
  title: 'First Step',
  description: 'Complete your first quest.',
  rule: 'total-completions',
  isUnlocked: true,
  unlockedAtUtc: '2026-06-18T12:00:00Z',
  progress: 1,
  target: 1,
  progressText: '1/1 quest completions'
};

describe('AchievementApiService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  it('loads achievements through the API', async () => {
    const service = TestBed.inject(AchievementApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.list());
    const request = http.expectOne(`${environment.apiUrl}/achievements`);
    expect(request.request.method).toBe('GET');
    request.flush([ACHIEVEMENT_RESPONSE]);

    expect(await responsePromise).toEqual([ACHIEVEMENT_RESPONSE]);
    http.verify();
  });
});
