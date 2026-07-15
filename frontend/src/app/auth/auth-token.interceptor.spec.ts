import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../environments/environment';
import type { AuthResponse } from './auth.models';
import { AUTH_STORAGE_KEY } from './auth.service';
import { authTokenInterceptor } from './auth-token.interceptor';

const REFRESH_RESPONSE: AuthResponse = {
  accessToken: 'new-access-token',
  expiresAtUtc: '2099-01-01T01:00:00Z',
  refreshToken: 'new-refresh-token',
  refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z',
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

describe('authTokenInterceptor', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('adds the bearer token to configured API requests', async () => {
    storeAuth({
      accessToken: 'stored-jwt',
      expiresAtUtc: '2099-01-01T00:00:00Z',
      refreshToken: 'stored-refresh',
      refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
    });
    configureInterceptorTestBed();
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      httpClient.get(`${environment.apiUrl}/habits`)
    );
    const request = http.expectOne(`${environment.apiUrl}/habits`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer stored-jwt');
    request.flush([]);

    await responsePromise;
    http.verify();
  });

  it('leaves non-API requests unauthenticated', async () => {
    storeAuth({
      accessToken: 'stored-jwt',
      expiresAtUtc: '2099-01-01T00:00:00Z',
      refreshToken: 'stored-refresh',
      refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
    });
    configureInterceptorTestBed();
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

  it('refreshes and retries the original API request once after a 401', async () => {
    storeAuth({
      accessToken: 'expired-access-token',
      expiresAtUtc: '2000-01-01T00:00:00Z',
      refreshToken: 'stored-refresh',
      refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
    });
    configureInterceptorTestBed();
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/habits`)
    );

    const firstRequest = http.expectOne(`${environment.apiUrl}/habits`);
    expect(firstRequest.request.headers.get('Authorization')).toBe(
      'Bearer expired-access-token'
    );
    firstRequest.flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const refreshRequest = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refreshRequest.request.method).toBe('POST');
    expect(refreshRequest.request.headers.has('Authorization')).toBe(false);
    expect(refreshRequest.request.body).toEqual({
      refreshToken: 'stored-refresh'
    });
    refreshRequest.flush(REFRESH_RESPONSE);

    const retryRequest = http.expectOne(`${environment.apiUrl}/habits`);
    expect(retryRequest.request.headers.get('Authorization')).toBe(
      'Bearer new-access-token'
    );
    retryRequest.flush([]);

    await expect(responsePromise).resolves.toEqual([]);
    expect(readStoredRefreshToken()).toBe('new-refresh-token');
    http.verify();
  });

  it('shares one refresh call when multiple API requests fail at once', async () => {
    storeAuth({
      accessToken: 'expired-access-token',
      expiresAtUtc: '2000-01-01T00:00:00Z',
      refreshToken: 'stored-refresh',
      refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
    });
    configureInterceptorTestBed();
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);

    const habitsPromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/habits`)
    );
    const achievementsPromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/achievements`)
    );

    http.expectOne(`${environment.apiUrl}/habits`).flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );
    http.expectOne(`${environment.apiUrl}/achievements`).flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const refreshRequest = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    refreshRequest.flush(REFRESH_RESPONSE);

    const habitsRetry = http.expectOne(`${environment.apiUrl}/habits`);
    expect(habitsRetry.request.headers.get('Authorization')).toBe(
      'Bearer new-access-token'
    );
    habitsRetry.flush([]);

    const achievementsRetry = http.expectOne(`${environment.apiUrl}/achievements`);
    expect(achievementsRetry.request.headers.get('Authorization')).toBe(
      'Bearer new-access-token'
    );
    achievementsRetry.flush([]);

    await expect(Promise.all([habitsPromise, achievementsPromise])).resolves.toEqual([
      [],
      []
    ]);
    http.verify();
  });

  it('clears auth state and navigates to login when refresh fails', async () => {
    storeAuth({
      accessToken: 'expired-access-token',
      expiresAtUtc: '2000-01-01T00:00:00Z',
      refreshToken: 'stored-refresh',
      refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
    });
    configureInterceptorTestBed();
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    const responsePromise = firstValueFrom(
      httpClient.get<unknown[]>(`${environment.apiUrl}/habits`)
    );

    http.expectOne(`${environment.apiUrl}/habits`).flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
      { title: 'Invalid refresh token' },
      { status: 401, statusText: 'Unauthorized' }
    );

    await expect(responsePromise).rejects.toBeTruthy();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
    http.verify();
  });
});

function configureInterceptorTestBed(): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authTokenInterceptor])),
      provideHttpClientTesting()
    ]
  });
}

function storeAuth(storedAuth: {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
}): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storedAuth));
}

function readStoredRefreshToken(): string | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  const parsed: unknown = JSON.parse(stored);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const storedAuth = parsed as Record<string, unknown>;

  return typeof storedAuth['refreshToken'] === 'string'
    ? storedAuth['refreshToken']
    : null;
}
