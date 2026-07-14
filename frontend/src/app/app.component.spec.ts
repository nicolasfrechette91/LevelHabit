import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { AUTH_STORAGE_KEY } from './auth/auth.service';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('renders anonymous account links when no user is authenticated', async () => {
    const { element, http } = await setupApp();

    expect(element.querySelector('.app-shell')).not.toBeNull();
    expect(element.querySelector('.navbar-brand')?.textContent).toContain('Level Habit');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Log in');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Create account');
    expect(element.querySelector('.site-nav')).toBeNull();
    expect(element.querySelector('[data-testid="logout-button"]')).toBeNull();
    expect(element.querySelector('[data-testid="nav-dashboard"]')).toBeNull();
    http.verify();
  });

  it('hides the redundant login link on the login page', async () => {
    const { element, http } = await setupApp({ path: '/login' });

    expect(element.querySelector('.auth-nav')?.textContent).not.toContain('Log in');
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Create account');

    http.expectOne(`${environment.apiUrl}/health`).flush('Healthy');
    http.verify();
  });

  it('renders the app shell, brand, and primary navigation for authenticated users', async () => {
    const { element, http } = await setupApp({ authenticated: true });

    expect(element.querySelector('.app-shell')).not.toBeNull();
    expect(element.querySelector('.navbar-brand')?.textContent).toContain('Level Habit');
    expect(element.querySelector('nav')).not.toBeNull();
    expect(element.querySelectorAll('nav a')).toHaveLength(5);
    expect(element.querySelector('[data-testid="logout-button"]')).not.toBeNull();
    http.verify();
  });

  it('hides authenticated navigation immediately after logout', async () => {
    const { element, fixture, http } = await setupApp({ authenticated: true });
    const logoutButton = element.querySelector(
      '[data-testid="logout-button"]'
    ) as HTMLButtonElement | null;

    expect(logoutButton).not.toBeNull();

    logoutButton?.click();
    fixture.detectChanges();

    expect(element.querySelector('.site-nav')).toBeNull();
    expect(element.querySelector('.auth-nav')?.textContent).toContain('Log in');
    expect(element.querySelector('[data-testid="logout-button"]')).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();

    const request = http.expectOne(`${environment.apiUrl}/auth/logout`);

    expect(request.request.method).toBe('POST');
    request.flush(null);
    http.verify();
  });
});

type SetupOptions = Readonly<{
  authenticated?: boolean;
  path?: string;
}>;

async function setupApp(options: SetupOptions = {}): Promise<{
  element: HTMLElement;
  fixture: ComponentFixture<AppComponent>;
  http: HttpTestingController;
}> {
  if (options.authenticated) {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: 'test-access-token',
        expiresAtUtc: '2099-01-01T00:00:00Z',
        refreshToken: 'test-refresh-token',
        refreshTokenExpiresAtUtc: '2099-02-01T00:00:00Z'
      })
    );
  }

  await TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting()
    ]
  }).compileComponents();

  const router = TestBed.inject(Router);

  if (options.path) {
    await router.navigateByUrl(options.path);
  }

  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();

  return {
    element: fixture.nativeElement as HTMLElement,
    fixture,
    http: TestBed.inject(HttpTestingController)
  };
}
