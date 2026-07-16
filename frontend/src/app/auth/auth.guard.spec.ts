import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter
} from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeResponse } from './auth.models';
import { anonymousGuard } from './anonymous.guard';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

const ME_RESPONSE = {
  user: {},
  progressProfile: {}
} as MeResponse;

describe('authentication route guards', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('redirects an authenticated navigation to login', async () => {
    await expectAnonymousRedirect('/login', new AuthServiceStub({ hasToken: true }));
  });

  it('redirects an authenticated navigation to registration', async () => {
    await expectAnonymousRedirect('/register', new AuthServiceStub({ hasToken: true }));
  });

  it('redirects an authenticated refresh on login after restoring its cookie session', async () => {
    await expectAnonymousRedirect('/login', new AuthServiceStub({ restoreSession: true }));
  });

  it('redirects an authenticated refresh on registration after restoring its cookie session', async () => {
    await expectAnonymousRedirect('/register', new AuthServiceStub({ restoreSession: true }));
  });

  it('allows logged-out access to login', async () => {
    await expectAnonymousAccess('/login');
  });

  it('allows logged-out access to registration', async () => {
    await expectAnonymousAccess('/register');
  });

  it('allows protected routes after restoring an HttpOnly-cookie session', async () => {
    const auth = configure(new AuthServiceStub({ restoreSession: true }));
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/dashboard' } as RouterStateSnapshot
      )
    ) as Observable<boolean | UrlTree>;

    await expect(firstValueFrom(result)).resolves.toBe(true);
    expect(auth.ensureCurrentUser).toHaveBeenCalledOnce();
  });

  it('redirects logged-out protected navigation to login with a return URL', async () => {
    const auth = configure(new AuthServiceStub());
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/habits' } as RouterStateSnapshot
      )
    ) as Observable<boolean | UrlTree>;
    const resolved = await firstValueFrom(result);

    expect(resolved).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resolved as UrlTree)).toBe(
      '/login?returnUrl=%2Fhabits'
    );
    expect(auth.clearSession).toHaveBeenCalledOnce();
  });
});

async function expectAnonymousRedirect(
  _url: '/login' | '/register',
  auth: AuthServiceStub
): Promise<void> {
  configure(auth);
  const router = TestBed.inject(Router);
  const result = TestBed.runInInjectionContext(() =>
    anonymousGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  );
  const resolved = result instanceof Observable
    ? await firstValueFrom(result)
    : await Promise.resolve(result);

  expect(resolved).toBeInstanceOf(UrlTree);
  expect(router.serializeUrl(resolved as UrlTree)).toBe('/dashboard');
}

async function expectAnonymousAccess(_url: '/login' | '/register'): Promise<void> {
  const auth = configure(new AuthServiceStub());
  const result = TestBed.runInInjectionContext(() =>
    anonymousGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  ) as Observable<boolean | UrlTree>;

  await expect(firstValueFrom(result)).resolves.toBe(true);
  expect(auth.clearSession).toHaveBeenCalledOnce();
}

function configure(auth: AuthServiceStub): AuthServiceStub {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth }
    ]
  });

  return auth;
}

class AuthServiceStub {
  readonly clearSession = vi.fn();
  readonly ensureCurrentUser = vi.fn((): Observable<MeResponse> =>
    this.restoreSession
      ? of(ME_RESPONSE)
      : throwError(() => new Error('No session'))
  );
  private readonly tokenAvailable: boolean;
  private readonly restoreSession: boolean;

  constructor(options: { hasToken?: boolean; restoreSession?: boolean } = {}) {
    this.tokenAvailable = options.hasToken ?? false;
    this.restoreSession = options.restoreSession ?? false;
  }

  hasToken(): boolean {
    return this.tokenAvailable;
  }
}
