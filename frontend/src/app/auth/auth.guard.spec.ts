import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { routes } from '../app.routes';
import type { MeResponse } from './auth.models';
import { authGuard } from './auth.guard';
import { AUTH_STORAGE_KEY } from './auth.service';

const ME_RESPONSE: MeResponse = {
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

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
  });

  it('redirects unauthenticated users to login with the requested URL', () => {
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot)
    );

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fdashboard');
  });

  it('allows authenticated users after loading the current user', async () => {
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
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    const http = TestBed.inject(HttpTestingController);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;
    const resultPromise = firstValueFrom(result);

    const request = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(request.request.method).toBe('GET');
    request.flush(ME_RESPONSE);

    await expect(resultPromise).resolves.toBe(true);
    http.verify();
  });
});
