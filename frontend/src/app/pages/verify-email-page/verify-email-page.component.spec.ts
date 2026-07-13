import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { AuthMessageResponse } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { VerifyEmailPageComponent } from './verify-email-page.component';

class AuthServiceStub {
  private readonly sentAtByEmail = new Map<string, number>();

  readonly confirmEmail = vi.fn(
    (email: string, code: string): Observable<AuthMessageResponse> =>
      of({
        message: 'Your email has been confirmed successfully.'
      })
  );

  readonly resendVerificationCode = vi.fn(
    (email: string): Observable<AuthMessageResponse> =>
      of({
        message:
          'If an unconfirmed account exists for this email, a verification code has been sent.'
      })
  );

  rememberVerificationCodeSent(email: string, sentAt = Date.now()): void {
    this.sentAtByEmail.set(email.trim().toLowerCase(), sentAt);
  }

  verificationResendRemainingSeconds(
    email: string,
    cooldownSeconds: number
  ): number {
    const sentAt = this.sentAtByEmail.get(email.trim().toLowerCase());

    if (!sentAt) {
      return 0;
    }

    const elapsedSeconds = Math.floor((Date.now() - sentAt) / 1000);

    return Math.max(0, cooldownSeconds - elapsedSeconds);
  }
}

describe('VerifyEmailPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('accepts digits only and limits the code to six characters', async () => {
    const { fixture, nativeElement } = await setup();
    const input = nativeElement.querySelector(
      '#verification-code'
    ) as HTMLInputElement;

    input.value = '00a4827';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(input.value).toBe('004827');
  });

  it('shows validation when the submitted code is incomplete', async () => {
    const { auth, fixture, nativeElement } = await setup();

    setInputValue(fixture, '#verification-code', '123');
    submitForm(fixture);

    expect(auth.confirmEmail).not.toHaveBeenCalled();
    expect(nativeElement.querySelector('#verification-code-error')?.textContent).toContain(
      'Enter the six-digit verification code.'
    );
  });

  it('confirms the email and redirects to login', async () => {
    const { auth, fixture, nativeElement, navigate } = await setup();

    setInputValue(fixture, '#verification-code', '004827');
    submitForm(fixture);

    expect(auth.confirmEmail).toHaveBeenCalledWith(
      'player@example.com',
      '004827'
    );
    expect(nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Your email has been confirmed successfully.'
    );
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: {
        verified: 'email-confirmed'
      }
    });
  });

  it('displays invalid-code errors from the backend', async () => {
    const { auth, fixture, nativeElement } = await setup();
    auth.confirmEmail.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              detail: 'The verification code is invalid or expired.'
            }
          })
      )
    );

    setInputValue(fixture, '#verification-code', '123456');
    submitForm(fixture);

    expect(nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'The verification code is invalid or expired.'
    );
  });

  it('resends the code and starts a cooldown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00Z'));
    const { auth, fixture, nativeElement } = await setup();

    clickButton(nativeElement, '[data-testid="resend-code-button"]');
    fixture.detectChanges();

    expect(auth.resendVerificationCode).toHaveBeenCalledWith('player@example.com');
    expect(nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'verification code has been sent'
    );
    expect(
      (nativeElement.querySelector('[data-testid="resend-code-button"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    fixture.detectChanges();

    expect(
      (nativeElement.querySelector('[data-testid="resend-code-button"]') as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it('shows an existing resend cooldown after refresh', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00Z'));
    const auth = new AuthServiceStub();
    auth.rememberVerificationCodeSent('player@example.com', Date.now());
    const { nativeElement } = await setup({ auth });

    expect(nativeElement.querySelector('.resend-countdown')?.textContent).toContain(
      'Resend available in'
    );
  });
});

type SetupOptions = Readonly<{
  auth?: AuthServiceStub;
  email?: string;
}>;

async function setup(options: SetupOptions = {}): Promise<{
  auth: AuthServiceStub;
  fixture: ComponentFixture<VerifyEmailPageComponent>;
  nativeElement: HTMLElement;
  navigate: MockInstance<Router['navigate']>;
}> {
  const auth = options.auth ?? new AuthServiceStub();

  await TestBed.configureTestingModule({
    imports: [VerifyEmailPageComponent],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap({
              email: options.email ?? 'player@example.com'
            })
          }
        }
      },
      { provide: AuthService, useValue: auth }
    ]
  }).compileComponents();

  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(VerifyEmailPageComponent);
  fixture.detectChanges();

  return {
    auth,
    fixture,
    nativeElement: fixture.nativeElement as HTMLElement,
    navigate
  };
}

function setInputValue(
  fixture: ComponentFixture<VerifyEmailPageComponent>,
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

function submitForm(fixture: ComponentFixture<VerifyEmailPageComponent>): void {
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement | null;

  if (!form) {
    throw new Error('Verification form not found.');
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}

function clickButton(nativeElement: HTMLElement, selector: string): void {
  const button = nativeElement.querySelector(selector) as HTMLButtonElement | null;

  if (!button) {
    throw new Error(`Button not found: ${selector}`);
  }

  button.click();
}
