import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import type { AuthResponse } from './auth.models';
import { AUTH_CSRF_HEADER, AUTH_STORAGE_KEY, AuthService } from './auth.service';
import { authTokenInterceptor } from './auth-token.interceptor';

const AUTH_RESPONSE: AuthResponse = createAuthResponse('access-token');
const REFRESH_RESPONSE: AuthResponse = createAuthResponse('new-access-token');

describe('authTokenInterceptor', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting()
      ]
    });
  });

  it('adds the in-memory bearer token only to configured API requests', async () => {
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    await establishSession(http);

    const apiPromise = firstValueFrom(httpClient.get(`${environment.apiUrl}/habits`));
    const apiRequest = http.expectOne(`${environment.apiUrl}/habits`);
    expect(apiRequest.request.headers.get('Authorization')).toBe('Bearer access-token');
    apiRequest.flush([]);

    const externalPromise = firstValueFrom(httpClient.get('https://example.com/asset.json'));
    const externalRequest = http.expectOne('https://example.com/asset.json');
    expect(externalRequest.request.headers.has('Authorization')).toBe(false);
    externalRequest.flush({});

    await Promise.all([apiPromise, externalPromise]);
    http.verify();
  });

  it('refreshes with cookie credentials and retries an expired protected request once', async () => {
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    await establishSession(http);

    const responsePromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/habits`)
    );
    http.expectOne(`${environment.apiUrl}/habits`).flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const csrfRequest = http.expectOne(`${environment.apiUrl}/auth/csrf`);
    expect(csrfRequest.request.withCredentials).toBe(true);
    csrfRequest.flush({ csrfToken: 'csrf-token' });

    const refreshRequest = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refreshRequest.request.body).toEqual({});
    expect(refreshRequest.request.withCredentials).toBe(true);
    expect(refreshRequest.request.headers.get(AUTH_CSRF_HEADER)).toBe('csrf-token');
    refreshRequest.flush(REFRESH_RESPONSE);

    const retryRequest = http.expectOne(`${environment.apiUrl}/habits`);
    expect(retryRequest.request.headers.get('Authorization')).toBe(
      'Bearer new-access-token'
    );
    retryRequest.flush([]);

    await expect(responsePromise).resolves.toEqual([]);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    http.verify();
  });

  it('shares one refresh flow when multiple API requests fail at once', async () => {
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    await establishSession(http);

    const habitsPromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/habits`)
    );
    const achievementsPromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/achievements`)
    );

    http.expectOne(`${environment.apiUrl}/habits`).flush(
      {},
      { status: 401, statusText: 'Unauthorized' }
    );
    http.expectOne(`${environment.apiUrl}/achievements`).flush(
      {},
      { status: 401, statusText: 'Unauthorized' }
    );
    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush({
      csrfToken: 'csrf-token'
    });
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(REFRESH_RESPONSE);

    http.expectOne(`${environment.apiUrl}/habits`).flush([]);
    http.expectOne(`${environment.apiUrl}/achievements`).flush([]);

    await expect(Promise.all([habitsPromise, achievementsPromise])).resolves.toEqual([
      [],
      []
    ]);
    http.verify();
  });

  it('clears memory and navigates to login when cookie refresh fails', async () => {
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');
    const auth = await establishSession(http);

    const responsePromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/habits`)
    );
    http.expectOne(`${environment.apiUrl}/habits`).flush(
      {},
      { status: 401, statusText: 'Unauthorized' }
    );
    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush({
      csrfToken: 'csrf-token'
    });
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
      {},
      { status: 401, statusText: 'Unauthorized' }
    );

    await expect(responsePromise).rejects.toBeTruthy();
    expect(auth.accessToken()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
    http.verify();
  });
});

async function establishSession(http: HttpTestingController): Promise<AuthService> {
  const auth = TestBed.inject(AuthService);
  const loginPromise = firstValueFrom(
    auth.login({ email: 'player@example.com', password: 'CorrectHorse123!' })
  );
  http.expectOne(`${environment.apiUrl}/auth/login`).flush(AUTH_RESPONSE);
  await loginPromise;

  return auth;
}

function createAuthResponse(accessToken: string): AuthResponse {
  return {
    accessToken,
    expiresAtUtc: '2099-01-01T01:00:00Z',
    user: {
      id: 'f972df99-805d-48a3-93e6-e5c469ba8be6',
      email: 'player@example.com',
      displayName: 'Player One',
      createdAtUtc: '2026-06-17T20:00:00Z'
    },
    progressProfile: {
      id: '883089e0-6d74-4564-814d-1a3c5fe1fcff',
      displayName: 'Morning Warden',
      level: 1,
      totalXp: 0,
      xpInCurrentLevel: 0,
      xpRequiredForNextLevel: 100,
      xpToNextLevel: 100,
      currentStreak: 0,
      createdAtUtc: '2026-06-17T20:00:00Z'
    }
  };
}
