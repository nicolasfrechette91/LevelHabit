import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import type { AuthResponse, RegisterResponse } from './auth.models';
import { AUTH_CSRF_HEADER, AUTH_STORAGE_KEY, AuthService } from './auth.service';

const AUTH_RESPONSE: AuthResponse = {
  accessToken: 'jwt-token',
  expiresAtUtc: '2099-01-01T00:00:00Z',
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

const REGISTER_RESPONSE: RegisterResponse = {
  email: 'player@example.com',
  requiresEmailVerification: true,
  message: 'Account created. Enter the verification code sent to your email.'
};

describe('AuthService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  it('starts in the checking authentication state', () => {
    const service = TestBed.inject(AuthService);

    expect(service.authStatus()).toBe('checking');
    expect(service.isCheckingAuth()).toBe(true);
    expect(service.isAuthInitialized()).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isUnauthenticated()).toBe(false);
  });

  it('logs in with credentials while keeping tokens out of browser storage', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const responsePromise = firstValueFrom(
      service.login({
        email: 'player@example.com',
        password: 'CorrectHorse123!'
      })
    );

    const request = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    request.flush(AUTH_RESPONSE);

    await expect(responsePromise).resolves.toEqual(AUTH_RESPONSE);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe(AUTH_RESPONSE.accessToken);
    expect(service.user()?.email).toBe(AUTH_RESPONSE.user.email);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    http.verify();
  });

  it('removes a legacy persisted token object when initialized', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh'
    }));
    sessionStorage.setItem(AUTH_STORAGE_KEY, 'legacy-refresh');

    TestBed.inject(AuthService);

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('restores a refreshed page session through CSRF-protected cookies', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const responsePromise = firstValueFrom(service.ensureCurrentUser());

    const csrfRequest = http.expectOne(`${environment.apiUrl}/auth/csrf`);
    expect(csrfRequest.request.method).toBe('GET');
    expect(csrfRequest.request.withCredentials).toBe(true);
    csrfRequest.flush({ csrfToken: 'csrf-token' });

    const refreshRequest = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refreshRequest.request.method).toBe('POST');
    expect(refreshRequest.request.body).toEqual({});
    expect(refreshRequest.request.withCredentials).toBe(true);
    expect(refreshRequest.request.headers.get(AUTH_CSRF_HEADER)).toBe('csrf-token');
    refreshRequest.flush(AUTH_RESPONSE);

    await expect(responsePromise).resolves.toEqual({
      user: AUTH_RESPONSE.user,
      progressProfile: AUTH_RESPONSE.progressProfile
    });
    expect(service.authStatus()).toBe('authenticated');
    expect(service.isAuthInitialized()).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    http.verify();
  });

  it('shares one cookie refresh when concurrent initialization callers restore the session', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const first = firstValueFrom(service.initializeAuth());
    const second = firstValueFrom(service.initializeAuth());

    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush({
      csrfToken: 'csrf-token'
    });
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(AUTH_RESPONSE);

    await expect(Promise.all([first, second])).resolves.toEqual([
      'authenticated',
      'authenticated'
    ]);
    expect(service.authStatus()).toBe('authenticated');
    http.verify();
  });

  it('does not restore a session when the refresh cookie is invalid', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const responsePromise = firstValueFrom(service.ensureCurrentUser());

    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush({
      csrfToken: 'csrf-token'
    });
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
      { title: 'Invalid refresh token' },
      { status: 401, statusText: 'Unauthorized' }
    );

    await expect(responsePromise).rejects.toBeTruthy();
    expect(service.authStatus()).toBe('unauthenticated');
    expect(service.isAuthInitialized()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('settles as unauthenticated after an unexpected initialization error', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const initialization = firstValueFrom(service.initializeAuth());

    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush(
      { title: 'Server error' },
      { status: 500, statusText: 'Server Error' }
    );

    await expect(initialization).resolves.toBe('unauthenticated');
    expect(service.authStatus()).toBe('unauthenticated');
    expect(service.isCheckingAuth()).toBe(false);
    http.verify();
  });

  it('logs out through the CSRF-protected cookie endpoint and clears memory', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const loginPromise = firstValueFrom(
      service.login({ email: 'player@example.com', password: 'CorrectHorse123!' })
    );
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(AUTH_RESPONSE);
    await loginPromise;

    const logoutPromise = firstValueFrom(service.logout());
    expect(service.isAuthenticated()).toBe(false);
    expect(service.accessToken()).toBeNull();

    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush({
      csrfToken: 'logout-csrf'
    });
    const logoutRequest = http.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(logoutRequest.request.method).toBe('POST');
    expect(logoutRequest.request.body).toEqual({});
    expect(logoutRequest.request.withCredentials).toBe(true);
    expect(logoutRequest.request.headers.get(AUTH_CSRF_HEADER)).toBe('logout-csrf');
    logoutRequest.flush(null);

    await expect(logoutPromise).resolves.toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    http.verify();
  });

  it('waits for an in-flight refresh before revoking the resulting cookie on logout', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const refreshPromise = firstValueFrom(service.refreshSession());

    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush({
      csrfToken: 'refresh-csrf'
    });
    const refreshRequest = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    const logoutPromise = firstValueFrom(service.logout());
    http.expectNone(`${environment.apiUrl}/auth/csrf`);

    refreshRequest.flush(AUTH_RESPONSE);
    await expect(refreshPromise).resolves.toEqual(AUTH_RESPONSE);
    expect(service.isAuthenticated()).toBe(false);
    http.expectOne(`${environment.apiUrl}/auth/csrf`).flush({
      csrfToken: 'logout-csrf'
    });
    const logoutRequest = http.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(logoutRequest.request.headers.get(AUTH_CSRF_HEADER)).toBe('logout-csrf');
    logoutRequest.flush(null);

    await expect(logoutPromise).resolves.toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    http.verify();
  });

  it('registers without creating an authenticated session', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const responsePromise = firstValueFrom(service.register({
      email: 'player@example.com',
      password: 'CorrectHorse123!',
      displayName: 'Player One',
      progressDisplayName: 'Morning Warden'
    }));

    const request = http.expectOne(`${environment.apiUrl}/auth/register`);
    expect(request.request.body).toMatchObject({
      displayName: 'Player One',
      progressDisplayName: 'Morning Warden'
    });
    request.flush(REGISTER_RESPONSE);

    await expect(responsePromise).resolves.toEqual(REGISTER_RESPONSE);
    expect(service.isAuthenticated()).toBe(false);
    http.verify();
  });

  it('supports password recovery and email verification lifecycle requests', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const forgot = firstValueFrom(service.forgotPassword('player@example.com'));
    http.expectOne(`${environment.apiUrl}/auth/forgot-password`).flush({ message: 'sent' });
    await expect(forgot).resolves.toEqual({ message: 'sent' });

    const reset = firstValueFrom(
      service.resetPassword('player@example.com', 'reset-token', 'NewPassword123!')
    );
    http.expectOne(`${environment.apiUrl}/auth/reset-password`).flush({ message: 'reset' });
    await expect(reset).resolves.toEqual({ message: 'reset' });

    const confirm = firstValueFrom(service.confirmEmail('player@example.com', '004827'));
    http.expectOne(`${environment.apiUrl}/auth/confirm-email`).flush({ message: 'confirmed' });
    await expect(confirm).resolves.toEqual({ message: 'confirmed' });

    const resend = firstValueFrom(service.resendVerificationCode('player@example.com'));
    http.expectOne(`${environment.apiUrl}/auth/resend-verification-code`).flush({ message: 'resent' });
    await expect(resend).resolves.toEqual({ message: 'resent' });
    http.verify();
  });

  it('tracks resend cooldown timestamps without storing verification codes', () => {
    const service = TestBed.inject(AuthService);
    const now = Date.now();

    service.rememberVerificationCodeSent('Player@Example.com', now);

    expect(
      service.verificationResendRemainingSeconds('player@example.com', 60)
    ).toBeGreaterThan(0);
    expect(
      sessionStorage.getItem(
        'levelhabit.emailVerification.lastSent.v1.player@example.com'
      )
    ).toBe(String(now));
  });
});
