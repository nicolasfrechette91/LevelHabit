import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { QuestApiService, type QuestResponse } from './quest-api.service';

const QUEST_RESPONSE: QuestResponse = {
  id: 'f3d9d772-8e0d-47f7-970b-56f757f85f4d',
  userId: 'f972df99-805d-48a3-93e6-e5c469ba8be6',
  title: 'Morning training',
  description: 'Move before work.',
  category: 'Fitness',
  difficulty: 'Medium',
  frequency: 'Daily',
  isArchived: false,
  createdAtUtc: '2026-06-18T12:00:00Z',
  updatedAtUtc: '2026-06-18T12:00:00Z'
};

describe('QuestApiService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  it('loads quests with archived records included', async () => {
    const service = TestBed.inject(QuestApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.list());
    const request = http.expectOne(
      `${environment.apiBaseUrl}/quests?includeArchived=true`
    );
    expect(request.request.method).toBe('GET');
    request.flush([QUEST_RESPONSE]);

    const response = await responsePromise;

    expect(response).toEqual([QUEST_RESPONSE]);
    http.verify();
  });

  it('creates a quest through the API', async () => {
    const service = TestBed.inject(QuestApiService);
    const http = TestBed.inject(HttpTestingController);

    const requestBody = {
      title: 'Morning training',
      description: 'Move before work.',
      category: 'Fitness' as const,
      difficulty: 'Medium' as const,
      frequency: 'Daily' as const
    };
    const responsePromise = firstValueFrom(service.create(requestBody));
    const request = http.expectOne(`${environment.apiBaseUrl}/quests`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush(QUEST_RESPONSE);

    expect(await responsePromise).toEqual(QUEST_RESPONSE);
    http.verify();
  });

  it('archives a quest through the API', async () => {
    const service = TestBed.inject(QuestApiService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.archive(QUEST_RESPONSE.id));
    const request = http.expectOne(`${environment.apiBaseUrl}/quests/${QUEST_RESPONSE.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    await responsePromise;
    http.verify();
  });
});
