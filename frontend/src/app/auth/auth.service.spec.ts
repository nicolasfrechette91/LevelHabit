import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import type { AuthResponse, MeResponse } from './auth.models';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';

const AUTH_RESPONSE: AuthResponse = {
  accessToken: 'jwt-token',
  expiresAtUtc: '2099-01-01T00:00:00Z',
  user: {
    id: 'f972df99-805d-48a3-93e6-e5c469ba8be6',
    email: 'player@example.com',
    displayName: 'Player One',
    createdAtUtc: '2026-06-17T20:00:00Z'
  },
  heroProfile: {
    id: '883089e0-6d74-4564-814d-1a3c5fe1fcff',
    heroName: 'Morning Warden',
    level: 1,
    totalXp: 0,
    currentStreak: 0,
    createdAtUtc: '2026-06-17T20:00:00Z'
  }
};

const ME_RESPONSE: MeResponse = {
  user: AUTH_RESPONSE.user,
  heroProfile: AUTH_RESPONSE.heroProfile
};

describe('AuthService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  it('logs in and stores the JWT for the current browser session', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      service.login({
        email: 'player@example.com',
        password: 'CorrectHorse123!'
      })
    );

    const request = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    request.flush(AUTH_RESPONSE);

    const response = await responsePromise;

    expect(response.accessToken).toBe(AUTH_RESPONSE.accessToken);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe(AUTH_RESPONSE.user.email);
    expect(service.heroProfile()?.heroName).toBe(AUTH_RESPONSE.heroProfile.heroName);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain(AUTH_RESPONSE.accessToken);
    http.verify();
  });

  it('registers with display and hero profile names', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      service.register({
        email: 'player@example.com',
        password: 'CorrectHorse123!',
        displayName: 'Player One',
        heroName: 'Morning Warden'
      })
    );

    const request = http.expectOne(`${environment.apiBaseUrl}/auth/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      displayName: 'Player One',
      heroName: 'Morning Warden'
    });
    request.flush(AUTH_RESPONSE);

    await responsePromise;

    expect(service.heroProfile()?.heroName).toBe('Morning Warden');
    expect(service.accessToken()).toBe('jwt-token');
    http.verify();
  });

  it('loads the current user from an existing token', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'stored-token',
        expiresAtUtc: '2099-01-01T00:00:00Z'
      })
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.ensureCurrentUser());
    const request = http.expectOne(`${environment.apiBaseUrl}/auth/me`);
    expect(request.request.method).toBe('GET');
    request.flush(ME_RESPONSE);

    await responsePromise;

    expect(service.user()?.displayName).toBe('Player One');
    expect(service.heroProfile()?.heroName).toBe('Morning Warden');
    http.verify();
  });

  it('clears auth state on logout', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'stored-token',
        expiresAtUtc: '2099-01-01T00:00:00Z'
      })
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    const service = TestBed.inject(AuthService);

    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
