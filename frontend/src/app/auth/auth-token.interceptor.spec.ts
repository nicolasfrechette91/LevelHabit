import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { AUTH_STORAGE_KEY } from './auth.service';
import { authTokenInterceptor } from './auth-token.interceptor';

describe('authTokenInterceptor', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('adds the bearer token to configured API requests', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'stored-jwt',
        expiresAtUtc: '2099-01-01T00:00:00Z'
      })
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting()
      ]
    });
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      httpClient.get(`${environment.apiUrl}/quests`)
    );
    const request = http.expectOne(`${environment.apiUrl}/quests`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer stored-jwt');
    request.flush([]);

    await responsePromise;
    http.verify();
  });

  it('leaves non-API requests unauthenticated', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'stored-jwt',
        expiresAtUtc: '2099-01-01T00:00:00Z'
      })
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting()
      ]
    });
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      httpClient.get('https://example.com/asset.json')
    );
    const request = http.expectOne('https://example.com/asset.json');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});

    await responsePromise;
    http.verify();
  });
});
