import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter
} from '@angular/router';
import { Observable, Subject, firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { anonymousGuard } from './anonymous.guard';
import { authGuard } from './auth.guard';
import { BackendStatusService } from '../core/services/backend-status.service';
import { type AuthStatus, AuthService } from './auth.service';

describe('authentication route guards', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('redirects an authenticated navigation to login', async () => {
    await expectAnonymousRedirect('/login', new AuthServiceStub('authenticated'));
  });

  it('redirects an authenticated navigation to registration', async () => {
    await expectAnonymousRedirect('/register', new AuthServiceStub('authenticated'));
  });

  it('redirects an authenticated refresh on login after restoring its cookie session', async () => {
    await expectAnonymousRedirect('/login', new AuthServiceStub('authenticated'));
  });

  it('redirects an authenticated refresh on registration after restoring its cookie session', async () => {
    await expectAnonymousRedirect('/register', new AuthServiceStub('authenticated'));
  });

  it('allows logged-out access to login', async () => {
    await expectAnonymousAccess('/login');
  });

  it('allows logged-out access to registration', async () => {
    await expectAnonymousAccess('/register');
  });

  it('allows protected routes after restoring an HttpOnly-cookie session', async () => {
    const auth = configure(new AuthServiceStub('authenticated'));
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/dashboard' } as RouterStateSnapshot
      )
    ) as Observable<boolean | UrlTree>;

    await expect(firstValueFrom(result)).resolves.toBe(true);
    expect(auth.initializeAuth).toHaveBeenCalledOnce();
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
    expect(auth.initializeAuth).toHaveBeenCalledOnce();
  });

  it('waits for authentication initialization before deciding a protected route', async () => {
    const initialization = new Subject<AuthStatus>();
    const auth = configure(new AuthServiceStub('checking', initialization));
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/dashboard' } as RouterStateSnapshot
      )
    ) as Observable<boolean | UrlTree>;
    let settled = false;
    const resolved = firstValueFrom(result).finally(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    initialization.next('authenticated');
    initialization.complete();

    await expect(resolved).resolves.toBe(true);
    expect(auth.initializeAuth).toHaveBeenCalledOnce();
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
  expect(auth.initializeAuth).toHaveBeenCalledOnce();
}

function configure(auth: AuthServiceStub): AuthServiceStub {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: BackendStatusService,
        useValue: { whenAvailable: () => of(undefined) }
      },
      { provide: AuthService, useValue: auth }
    ]
  });

  return auth;
}

class AuthServiceStub {
  readonly initializeAuth: ReturnType<typeof vi.fn>;

  constructor(
    status: AuthStatus = 'unauthenticated',
    initialization: Observable<AuthStatus> = of(status)
  ) {
    this.initializeAuth = vi.fn(() => initialization);
  }
}
