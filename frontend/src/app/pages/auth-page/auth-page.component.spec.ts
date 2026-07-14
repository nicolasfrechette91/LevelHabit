import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { environment } from '../../../environments/environment';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse
} from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { AuthPageComponent } from './auth-page.component';

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

type AuthMode = 'login' | 'register';

type ActivatedRouteStub = Pick<ActivatedRoute, 'data'> & {
  snapshot: Pick<ActivatedRoute['snapshot'], 'data' | 'queryParamMap'>;
};

class AuthServiceStub {
  readonly login = vi.fn((request: LoginRequest): Observable<AuthResponse> =>
    of(AUTH_RESPONSE)
  );
  readonly register = vi.fn((request: RegisterRequest): Observable<RegisterResponse> =>
    of(REGISTER_RESPONSE)
  );
  readonly rememberVerificationCodeSent = vi.fn((email: string): void => undefined);
  readonly showEmailVerificationNotice = vi.fn((email: string): void => undefined);
}

describe('AuthPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('calls the backend health endpoint when initialized', async () => {
    const { http } = await setup('login', { flushWarmUp: false });

    const request = http.expectOne(`${environment.apiUrl}/health`);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('text');

    request.flush('Healthy');
    http.verify();
  });

  it('keeps login usable when backend warm-up fails', async () => {
    const { auth, fixture, http, nativeElement, navigateByUrl } = await setup('login', {
      flushWarmUp: false
    });

    const request = http.expectOne(`${environment.apiUrl}/health`);
    request.flush('Unavailable', {
      status: 503,
      statusText: 'Service Unavailable'
    });

    setInputValue(fixture, '#login-email', 'player@example.com');
    setInputValue(fixture, '#login-password', 'CorrectHorse123!');
    submitForm(fixture);

    expect(auth.login).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'CorrectHorse123!'
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(nativeElement.querySelector('[role="alert"]')).toBeNull();
    http.verify();
  });

  it('prevents login submit when the email format is invalid', async () => {
    const { auth, fixture, nativeElement } = await setup('login');

    setInputValue(fixture, '#login-email', 'not-an-email');
    setInputValue(fixture, '#login-password', 'CorrectHorse123!');
    submitForm(fixture);

    expect(auth.login).not.toHaveBeenCalled();
    expect(nativeElement.querySelector('#login-email')?.classList).toContain('is-invalid');
    expect(nativeElement.querySelector('#login-email-error')?.textContent).toContain(
      'Please enter a valid email address.'
    );
    expect(nativeElement.querySelector('#login-password-error')).toBeNull();
  });

  it('shows required register validation errors after a submit attempt', async () => {
    const { auth, fixture, nativeElement } = await setup('register');

    expect(nativeElement.querySelector('.invalid-feedback')).toBeNull();

    submitForm(fixture);

    expect(auth.register).not.toHaveBeenCalled();
    expect(nativeElement.querySelectorAll('.is-invalid')).toHaveLength(4);
    expect(nativeElement.querySelector('#register-email-error')?.textContent).toContain(
      'Email is required.'
    );
    expect(nativeElement.querySelector('#register-password-error')?.textContent).toContain(
      'Password is required.'
    );
    expect(nativeElement.querySelector('#display-name-error')?.textContent).toContain(
      'Display name is required.'
    );
    expect(nativeElement.querySelector('#progress-display-name-error')?.textContent).toContain(
      'Progress display name is required.'
    );
  });

  it('calls AuthService for a valid login form', async () => {
    const { auth, fixture, navigateByUrl } = await setup('login');

    setInputValue(fixture, '#login-email', 'player@example.com');
    setInputValue(fixture, '#login-password', 'CorrectHorse123!');
    submitForm(fixture);

    expect(auth.login).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'CorrectHorse123!'
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('calls AuthService for a valid register form', async () => {
    const { auth, fixture, navigate } = await setup('register');

    setInputValue(fixture, '#register-email', 'player@example.com');
    setInputValue(fixture, '#register-password', 'CorrectHorse123!');
    setInputValue(fixture, '#display-name', 'Player One');
    setInputValue(fixture, '#progress-display-name', 'Morning Warden');
    submitForm(fixture);

    expect(auth.register).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'CorrectHorse123!',
      displayName: 'Player One',
      progressDisplayName: 'Morning Warden'
    });
    expect(auth.rememberVerificationCodeSent).toHaveBeenCalledWith(
      'player@example.com'
    );
    expect(auth.showEmailVerificationNotice).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/verify-email'], {
      queryParams: {
        email: 'player@example.com'
      }
    });
  });

  it('shows the email confirmed success message on the login page', async () => {
    const { nativeElement } = await setup('login', {
      queryParams: {
        verified: 'email-confirmed'
      }
    });

    expect(nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Your email has been confirmed. You can now log in.'
    );
  });

  it('offers verification when login fails because email is unconfirmed', async () => {
    const { auth, fixture, nativeElement } = await setup('login');
    auth.login.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              code: 'EMAIL_NOT_CONFIRMED',
              detail: 'Please confirm your email address before logging in.'
            }
          })
      )
    );

    setInputValue(fixture, '#login-email', 'player@example.com');
    setInputValue(fixture, '#login-password', 'CorrectHorse123!');
    submitForm(fixture);

    const verificationLink = Array.from(nativeElement.querySelectorAll('a')).find(
      (link) => link.textContent?.includes('Enter verification code')
    );

    expect(auth.login).toHaveBeenCalledOnce();
    expect(nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Please confirm your email address before logging in.'
    );
    expect(verificationLink).toBeDefined();
  });

  it('still displays backend authentication errors', async () => {
    const { auth, fixture, nativeElement } = await setup('login');
    auth.login.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: {
              detail: 'Email or password was not recognized.'
            }
          })
      )
    );

    setInputValue(fixture, '#login-email', 'player@example.com');
    setInputValue(fixture, '#login-password', 'WrongPassword123!');
    submitForm(fixture);

    expect(auth.login).toHaveBeenCalledOnce();
    expect(nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Email or password was not recognized.'
    );
  });
});

type SetupOptions = Readonly<{
  flushWarmUp?: boolean;
  queryParams?: Record<string, string>;
}>;

async function setup(mode: AuthMode, options: SetupOptions = {}): Promise<{
  auth: AuthServiceStub;
  fixture: ComponentFixture<AuthPageComponent>;
  http: HttpTestingController;
  nativeElement: HTMLElement;
  navigate: MockInstance<Router['navigate']>;
  navigateByUrl: MockInstance<Router['navigateByUrl']>;
}> {
  const auth = new AuthServiceStub();
  const route: ActivatedRouteStub = {
    data: of({ mode }),
    snapshot: {
      data: { mode },
      queryParamMap: convertToParamMap(options.queryParams ?? {})
    }
  };

  await TestBed.configureTestingModule({
    imports: [AuthPageComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: route },
      { provide: AuthService, useValue: auth }
    ]
  }).compileComponents();

  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(AuthPageComponent);
  fixture.detectChanges();

  if (options.flushWarmUp ?? true) {
    const request = http.expectOne(`${environment.apiUrl}/health`);
    request.flush('Healthy');
  }

  return {
    auth,
    fixture,
    http,
    nativeElement: fixture.nativeElement as HTMLElement,
    navigate,
    navigateByUrl
  };
}

function setInputValue(
  fixture: ComponentFixture<AuthPageComponent>,
  selector: string,
  value: string
): void {
  const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;

  if (!input) {
    throw new Error(`Input not found: ${selector}`);
  }

  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}

function submitForm(fixture: ComponentFixture<AuthPageComponent>): void {
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement | null;

  if (!form) {
    throw new Error('Auth form not found.');
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}
