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
import { AuthService } from './auth/auth.service';

describe('AppComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

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

  it('renders primary navigation for authenticated users', async () => {
    const { element } = await setupApp({ authenticated: true });

    expect(element.querySelectorAll('nav a')).toHaveLength(5);
    expect(element.querySelector('[data-testid="logout-button"]')).not.toBeNull();
  });

  it('hides authenticated navigation immediately after logout', async () => {
    const { auth, element, fixture, router } = await setupApp({ authenticated: true });
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const logoutButton = element.querySelector(
      '[data-testid="logout-button"]'
    ) as HTMLButtonElement;

    logoutButton.click();
    fixture.detectChanges();

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(element.querySelector('.site-nav')).toBeNull();
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Log in');
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });
});

type SetupOptions = Readonly<{
  authenticated?: boolean;
  path?: string;
}>;

async function setupApp(options: SetupOptions = {}): Promise<{
  auth: AuthServiceStub;
  element: HTMLElement;
  fixture: ComponentFixture<AppComponent>;
  http: HttpTestingController;
  router: Router;
}> {
  const auth = new AuthServiceStub(options.authenticated ?? false);

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

  if (options.path) {
    await router.navigateByUrl(options.path);
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
  private readonly authenticated = signal(false);
  readonly isAuthenticated = this.authenticated.asReadonly();
  readonly emailVerificationNotice = signal<string | null>(null).asReadonly();
  readonly dismissEmailVerificationNotice = vi.fn();
  readonly clearSession = vi.fn(() => this.authenticated.set(false));
  readonly logout = vi.fn((): Observable<void> => {
    this.authenticated.set(false);
    return of(undefined);
  });

  constructor(authenticated: boolean) {
    this.authenticated.set(authenticated);
  }

  hasToken(): boolean {
    return this.authenticated();
  }

  ensureCurrentUser(): Observable<MeResponse> {
    return this.authenticated()
      ? of({} as MeResponse)
      : throwError(() => new Error('No session'));
  }
}
