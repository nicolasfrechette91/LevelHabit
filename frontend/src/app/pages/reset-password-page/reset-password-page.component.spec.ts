import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthMessageResponse } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { ResetPasswordPageComponent } from './reset-password-page.component';

class AuthServiceStub {
  readonly resetPassword = vi.fn(
    (
      email: string,
      token: string,
      newPassword: string
    ): Observable<AuthMessageResponse> =>
      of({
        message: 'Your password has been reset.'
      })
  );
}

describe('ResetPasswordPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('uses query params to reset the password and shows success', async () => {
    const auth = new AuthServiceStub();

    await TestBed.configureTestingModule({
      imports: [ResetPasswordPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                email: 'player@example.com',
                token: 'reset-token'
              })
            }
          }
        },
        { provide: AuthService, useValue: auth }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    setInputValue(fixture, '#new-password', 'NewPassword123!');
    setInputValue(fixture, '#confirm-password', 'NewPassword123!');
    submitForm(fixture);

    const element = fixture.nativeElement as HTMLElement;

    expect(auth.resetPassword).toHaveBeenCalledWith(
      'player@example.com',
      'reset-token',
      'NewPassword123!'
    );
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Your password has been reset.'
    );
  });
});

function setInputValue(
  fixture: ComponentFixture<ResetPasswordPageComponent>,
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

function submitForm(fixture: ComponentFixture<ResetPasswordPageComponent>): void {
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement | null;

  if (!form) {
    throw new Error('Reset password form not found.');
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}
