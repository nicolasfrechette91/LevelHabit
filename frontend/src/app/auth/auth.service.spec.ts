import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import type { AuthResponse, MeResponse, RegisterResponse } from './auth.models';
import { AUTH_STORAGE_KEY, AuthService } from './auth.service';

const AUTH_RESPONSE: AuthResponse = {
  accessToken: 'jwt-token',
  expiresAtUtc: '2099-01-01T00:00:00Z',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z',
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
    xpInCurrentLevel: 0,
    xpRequiredForNextLevel: 100,
    xpToNextLevel: 100,
    currentStreak: 0,
    createdAtUtc: '2026-06-17T20:00:00Z'
  }
};

const ME_RESPONSE: MeResponse = {
  user: AUTH_RESPONSE.user,
  heroProfile: AUTH_RESPONSE.heroProfile
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

  it('logs in and stores access and refresh tokens for the current browser session', async () => {
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
    request.flush(AUTH_RESPONSE);

    const response = await responsePromise;

    expect(response.accessToken).toBe(AUTH_RESPONSE.accessToken);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe(AUTH_RESPONSE.user.email);
    expect(service.heroProfile()?.heroName).toBe(AUTH_RESPONSE.heroProfile.heroName);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain(AUTH_RESPONSE.accessToken);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain(AUTH_RESPONSE.refreshToken);
    http.verify();
  });

  it('registers with display and hero profile names without storing a session', async () => {
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

    const request = http.expectOne(`${environment.apiUrl}/auth/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      displayName: 'Player One',
      heroName: 'Morning Warden'
    });
    request.flush(REGISTER_RESPONSE);

    await expect(responsePromise).resolves.toEqual(REGISTER_RESPONSE);

    expect(service.heroProfile()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    http.verify();
  });

  it('requests a password reset email', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      service.forgotPassword('player@example.com')
    );

    const request = http.expectOne(`${environment.apiUrl}/auth/forgot-password`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'player@example.com'
    });
    request.flush({
      message: 'If an account exists for that email, a password reset link has been sent.'
    });

    await expect(responsePromise).resolves.toEqual({
      message: 'If an account exists for that email, a password reset link has been sent.'
    });
    http.verify();
  });

  it('resets a password with email and token', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      service.resetPassword('player@example.com', 'reset-token', 'NewPassword123!')
    );

    const request = http.expectOne(`${environment.apiUrl}/auth/reset-password`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'player@example.com',
      token: 'reset-token',
      newPassword: 'NewPassword123!'
    });
    request.flush({
      message: 'Your password has been reset.'
    });

    await expect(responsePromise).resolves.toEqual({
      message: 'Your password has been reset.'
    });
    http.verify();
  });

  it('confirms an email with email and code', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      service.confirmEmail('player@example.com', '004827')
    );

    const request = http.expectOne(`${environment.apiUrl}/auth/confirm-email`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'player@example.com',
      code: '004827'
    });
    request.flush({
      message: 'Your email has been confirmed successfully.'
    });

    await expect(responsePromise).resolves.toEqual({
      message: 'Your email has been confirmed successfully.'
    });
    http.verify();
  });

  it('resends an email verification code', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(
      service.resendVerificationCode('player@example.com')
    );

    const request = http.expectOne(
      `${environment.apiUrl}/auth/resend-verification-code`
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'player@example.com'
    });
    request.flush({
      message: 'If an unconfirmed account exists for this email, a verification code has been sent.'
    });

    await expect(responsePromise).resolves.toEqual({
      message: 'If an unconfirmed account exists for this email, a verification code has been sent.'
    });
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

  it('loads the current user from an existing token', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'stored-token',
        expiresAtUtc: '2099-01-01T00:00:00Z',
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
      })
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const responsePromise = firstValueFrom(service.ensureCurrentUser());
    const request = http.expectOne(`${environment.apiUrl}/auth/me`);
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
        expiresAtUtc: '2099-01-01T00:00:00Z',
        refreshToken: 'stored-refresh-token',
        refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
      })
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.refreshToken()).toBeNull();

    const request = http.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      refreshToken: 'stored-refresh-token'
    });
    request.flush(null);
    http.verify();
  });
});
