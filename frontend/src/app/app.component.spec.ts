import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppComponent } from './app.component';
import { routes } from './app.routes';
import type { MeResponse } from './auth/auth.models';
import { type AuthStatus, AuthService } from './auth/auth.service';
import {
  type BackendStatus,
  BackendStatusService
} from './core/services/backend-status.service';

describe('AppComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the backend checking screen before rendering the application', async () => {
    const { element } = await setupApp({ backendStatus: 'checking' });

    expect(element.textContent).toContain('LevelHabit is getting ready');
    expect(element.textContent).toContain('Loading your habits');
    expect(element.querySelector('.spinner-border')).not.toBeNull();
    expect(element.querySelector('.app-shell')).toBeNull();
  });

  it('renders the application automatically after the backend becomes available', async () => {
    const { auth, backend, element, fixture } = await setupApp({
      backendStatus: 'checking'
    });

    backend.setStatus('available');
    fixture.detectChanges();

    expect(element.querySelector('app-backend-wakeup')).toBeNull();
    expect(element.querySelector('.app-shell')).not.toBeNull();
    expect(auth.initializeAuth).toHaveBeenCalledOnce();
  });

  it('restarts the backend check from the unavailable screen', async () => {
    const { backend, element, fixture } = await setupApp({
      backendStatus: 'unavailable'
    });

    expect(element.textContent).toContain('taking longer than expected');
    const retry = element.querySelector('.wakeup-retry') as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    expect(backend.startCheck).toHaveBeenCalledTimes(2);
    expect(backend.status()).toBe('checking');
    expect(element.textContent).toContain('LevelHabit is getting ready');
  });

  it('does not restart the warm-up check during normal navigation', async () => {
    const { backend, fixture, router } = await setupApp();

    await router.navigateByUrl('/reset-password');
    fixture.detectChanges();

    expect(backend.startCheck).toHaveBeenCalledOnce();
  });

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
    const { element } = await setupApp({ path: '/login' });

    expect(element.querySelector('.auth-nav')?.textContent).not.toContain('Log in');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Create account');
  });

  it('keeps the neutral header until the initial login navigation finishes', async () => {
    const { auth, element, fixture, router } = await setupApp({
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

  it('neutralizes the authenticated page and waits for logout before replacing the route', async () => {
    const { auth, element, fixture, router } = await setupApp({ status: 'authenticated' });
    const logoutCompletion = new Subject<void>();
    auth.logout.mockReturnValue(logoutCompletion);
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
    expect(navigateByUrl).not.toHaveBeenCalled();

    logoutCompletion.next();
    expect(navigateByUrl).not.toHaveBeenCalled();
    auth.setStatus('unauthenticated');
    logoutCompletion.complete();
    expect(navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });

    resolveNavigation(true);
    await navigation;
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="auth-initializing-placeholder"]')).toBeNull();
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Log in');
    expect(element.querySelector('.app-main')?.classList).not.toContain('app-main-logging-out');
  });

  it('navigates to login after the logout request safely fails', async () => {
    const { auth, element, router } = await setupApp({ status: 'authenticated' });
    auth.logout.mockReturnValue(throwError(() => new Error('network failure')));
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const logoutButton = element.querySelector(
      '[data-testid="logout-button"]'
    ) as HTMLButtonElement;

    logoutButton.click();
    await Promise.resolve();

    expect(navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});

type SetupOptions = Readonly<{
  backendStatus?: BackendStatus;
  path?: string;
  skipInitialNavigation?: boolean;
  status?: AuthStatus;
}>;

async function setupApp(options: SetupOptions = {}): Promise<{
  auth: AuthServiceStub;
  backend: BackendStatusServiceStub;
  element: HTMLElement;
  fixture: ComponentFixture<AppComponent>;
  http: HttpTestingController;
  router: Router;
}> {
  const auth = new AuthServiceStub(options.status ?? 'unauthenticated');
  const backend = new BackendStatusServiceStub(
    options.backendStatus ?? 'available'
  );

  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: BackendStatusService, useValue: backend }
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
    backend,
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
  readonly user = signal(null).asReadonly();
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

  readonly initializeAuth = vi.fn((): Observable<AuthStatus> => of(this.status()));

  ensureCurrentUser(): Observable<MeResponse> {
    return this.isAuthenticated()
      ? of({} as MeResponse)
      : throwError(() => new Error('No session'));
  }
}

class BackendStatusServiceStub {
  private readonly statusSignal = signal<BackendStatus>('checking');
  readonly status = this.statusSignal.asReadonly();
  private hasStarted = false;
  readonly startCheck = vi.fn(() => {
    if (this.hasStarted && this.statusSignal() === 'unavailable') {
      this.statusSignal.set('checking');
    }

    this.hasStarted = true;
  });

  constructor(status: BackendStatus) {
    this.statusSignal.set(status);
  }

  setStatus(status: BackendStatus): void {
    this.statusSignal.set(status);
  }

  whenAvailable(): Observable<void> {
    return this.statusSignal() === 'available' ? of(undefined) : new Subject<void>();
  }
}
