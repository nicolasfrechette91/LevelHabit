import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthMessageResponse } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { ForgotPasswordPageComponent } from './forgot-password-page.component';

class AuthServiceStub {
  readonly forgotPassword = vi.fn((email: string): Observable<AuthMessageResponse> =>
    of({
      message: 'If an account exists for that email, a password reset link has been sent.'
    })
  );
}

describe('ForgotPasswordPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('submits an email and shows the generic success message', async () => {
    const auth = new AuthServiceStub();

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ForgotPasswordPageComponent);
    fixture.detectChanges();

    setInputValue(fixture, '#forgot-password-email', 'player@example.com');
    submitForm(fixture);

    const element = fixture.nativeElement as HTMLElement;

    expect(auth.forgotPassword).toHaveBeenCalledWith('player@example.com');
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'If an account exists for that email, a password reset link has been sent.'
    );
  });
});

function setInputValue(
  fixture: ComponentFixture<ForgotPasswordPageComponent>,
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

function submitForm(fixture: ComponentFixture<ForgotPasswordPageComponent>): void {
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement | null;

  if (!form) {
    throw new Error('Forgot password form not found.');
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}
