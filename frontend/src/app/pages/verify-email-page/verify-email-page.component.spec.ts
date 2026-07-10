import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthMessageResponse } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { VerifyEmailPageComponent } from './verify-email-page.component';

class AuthServiceStub {
  readonly verifyEmail = vi.fn(
    (email: string, token: string): Observable<AuthMessageResponse> =>
      of({
        message: 'Your email has been verified.'
      })
  );
}

describe('VerifyEmailPageComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('verifies the email from query params on init', async () => {
    const auth = new AuthServiceStub();

    await TestBed.configureTestingModule({
      imports: [VerifyEmailPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                email: 'player@example.com',
                token: 'verification-token'
              })
            }
          }
        },
        { provide: AuthService, useValue: auth }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(VerifyEmailPageComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(auth.verifyEmail).toHaveBeenCalledWith(
      'player@example.com',
      'verification-token'
    );
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Your email has been verified.'
    );
  });
});
