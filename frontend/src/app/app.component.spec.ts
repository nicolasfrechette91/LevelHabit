import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import type { MeResponse } from './auth/auth.models';
import { type AuthStatus, AuthService } from './auth/auth.service';

describe('AppComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders only a neutral header placeholder while authentication is checking', async () => {
    const { element } = await setupApp({ status: 'checking' });

    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).not.toBeNull();
    expect(element.querySelector('.auth-nav')).toBeNull();
    expect(element.querySelector('.site-nav')).toBeNull();
    expect(element.textContent).not.toContain('Log in');
    expect(element.textContent).not.toContain('Create account');
  });

  it('renders anonymous account links when no user is authenticated', async () => {
    const { element } = await setupApp();

    expect(element.querySelector('.app-shell')).not.toBeNull();
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Log in');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Create account');
    expect(element.querySelector('.site-nav')).toBeNull();
  });

  it('hides the redundant login link on the login page', async () => {
    const { element, http } = await setupApp({ path: '/login' });

    expect(element.querySelector('.auth-nav')?.textContent).not.toContain('Log in');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Create account');
    http.expectOne(`${environment.apiUrl}/health`).flush('Healthy');
    http.verify();
  });

  it('keeps the neutral header until the initial login navigation finishes', async () => {
    const { auth, element, fixture, http, router } = await setupApp({
      skipInitialNavigation: true,
      status: 'checking'
    });

    auth.setStatus('unauthenticated');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).not.toBeNull();
    expect(element.querySelector('.auth-nav')).toBeNull();

    await router.navigateByUrl('/login');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).toBeNull();
    expect(element.querySelector('.auth-nav')?.textContent).not.toContain('Log in');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Create account');
    http.expectOne(`${environment.apiUrl}/health`).flush('Healthy');
    http.verify();
  });

  it('renders primary navigation for authenticated users', async () => {
    const { element } = await setupApp({ status: 'authenticated' });

    expect(element.querySelectorAll('nav a')).toHaveLength(5);
    expect(element.querySelector('[data-testid="logout-button"]')).not.toBeNull();
  });

  it('renders primary navigation after authentication initialization succeeds', async () => {
    const { auth, element, fixture } = await setupApp({ status: 'checking' });

    auth.setStatus('authenticated');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).toBeNull();
    expect(element.querySelector('.site-nav')).not.toBeNull();
    expect(element.querySelector('.auth-nav')).toBeNull();
  });

  it('renders public navigation only after authentication is confirmed unauthenticated', async () => {
    const { auth, element, fixture } = await setupApp({ status: 'checking' });

    expect(element.querySelector('.auth-nav')).toBeNull();

    auth.setStatus('unauthenticated');
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).toBeNull();
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Log in');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Create account');
    expect(element.querySelector('.site-nav')).toBeNull();
  });

  it('neutralizes the authenticated page while navigating immediately after logout', async () => {
    const { auth, element, fixture, router } = await setupApp({ status: 'authenticated' });
    let resolveNavigation!: (navigated: boolean) => void;
    const navigation = new Promise<boolean>((resolve) => {
      resolveNavigation = resolve;
    });
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockReturnValue(navigation);
    const logoutButton = element.querySelector(
      '[data-testid="logout-button"]'
    ) as HTMLButtonElement;

    logoutButton.click();
    fixture.detectChanges();

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(element.querySelector('.site-nav')).toBeNull();
    expect(element.querySelector('.auth-nav')).toBeNull();
    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).not.toBeNull();
    expect(element.querySelector('.app-main')?.classList).toContain('app-main-logging-out');
    expect(navigateByUrl).toHaveBeenCalledWith('/login');

    resolveNavigation(true);
    await navigation;
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).toBeNull();
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Log in');
    expect(element.querySelector('.app-main')?.classList).not.toContain('app-main-logging-out');
  });
});

type SetupOptions = Readonly<{
  path?: string;
  skipInitialNavigation?: boolean;
  status?: AuthStatus;
}>;

async function setupApp(options: SetupOptions = {}): Promise<{
  auth: AuthServiceStub;
  element: HTMLElement;
  fixture: ComponentFixture<AppComponent>;
  http: HttpTestingController;
  router: Router;
}> {
  const auth = new AuthServiceStub(options.status ?? 'unauthenticated');

  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth }
    ]
  }).compileComponents();

  const router = TestBed.inject(Router);

  if (!options.skipInitialNavigation) {
    await router.navigateByUrl(options.path ?? '/forgot-password');
  }

  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();

  return {
    auth,
    element: fixture.nativeElement as HTMLElement,
    fixture,
    http: TestBed.inject(HttpTestingController),
    router
  };
}

class AuthServiceStub {
  readonly authRequired = true;
  private readonly status = signal<AuthStatus>('checking');
  readonly authStatus = this.status.asReadonly();
  readonly isCheckingAuth = () => this.status() === 'checking';
  readonly isAuthenticated = () => this.status() === 'authenticated';
  readonly isUnauthenticated = () => this.status() === 'unauthenticated';
  readonly emailVerificationNotice = signal<string | null>(null).asReadonly();
  readonly dismissEmailVerificationNotice = vi.fn();
  readonly clearSession = vi.fn(() => this.status.set('unauthenticated'));
  readonly logout = vi.fn((): Observable<void> => {
    this.status.set('unauthenticated');
    return of(undefined);
  });

  constructor(status: AuthStatus) {
    this.status.set(status);
  }

  setStatus(status: AuthStatus): void {
    this.status.set(status);
  }

  hasToken(): boolean {
    return this.isAuthenticated();
  }

  initializeAuth(): Observable<AuthStatus> {
    return of(this.status());
  }

  ensureCurrentUser(): Observable<MeResponse> {
    return this.isAuthenticated()
      ? of({} as MeResponse)
      : throwError(() => new Error('No session'));
  }
}
