import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

const RESEND_COOLDOWN_SECONDS = 60;
const GENERIC_RESEND_MESSAGE =
  'If an unconfirmed account exists for this email, a verification code has been sent.';

@Component({
  selector: 'app-verify-email-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verify-email-page.component.html',
  styleUrls: ['./verify-email-page.component.scss']
})
export class VerifyEmailPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private countdownTimerId: ReturnType<typeof setInterval> | null = null;

  protected readonly email = signal('');
  protected readonly confirmPending = signal(false);
  protected readonly resendPending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly resendMessage = signal<string | null>(null);
  protected readonly resendRemainingSeconds = signal(0);
  protected readonly busy = computed(() =>
    this.confirmPending() || this.resendPending()
  );

  protected readonly form = this.formBuilder.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email')?.trim() ?? '';

    if (email.length === 0) {
      this.errorMessage.set('The email address for this verification request is missing.');
      return;
    }

    this.email.set(email);
    this.updateCooldown();
    this.startCountdownTimer();

    this.destroyRef.onDestroy(() => this.stopCountdownTimer());
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);

    if (input.value !== digits) {
      input.value = digits;
    }

    this.form.controls.code.setValue(digits, {
      emitEvent: false
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.email();

    if (!email) {
      this.errorMessage.set('The email address for this verification request is missing.');
      return;
    }

    this.confirmPending.set(true);

    this.auth
      .confirmEmail(email, this.form.controls.code.value)
      .pipe(finalize(() => this.confirmPending.set(false)))
      .subscribe({
        next: (response) => {
          this.successMessage.set(response.message);
          void this.router.navigate(['/login'], {
            queryParams: {
              verified: 'email-confirmed'
            }
          });
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.readErrorMessage(error));
        }
      });
  }

  protected resendCode(): void {
    const email = this.email();

    if (!email || this.resendRemainingSeconds() > 0) {
      return;
    }

    this.errorMessage.set(null);
    this.resendMessage.set(null);
    this.resendPending.set(true);

    this.auth
      .resendVerificationCode(email)
      .pipe(finalize(() => this.resendPending.set(false)))
      .subscribe({
        next: (response) => {
          this.auth.rememberVerificationCodeSent(email);
          this.resendMessage.set(response.message || GENERIC_RESEND_MESSAGE);
          this.updateCooldown();
          this.startCountdownTimer();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.readErrorMessage(error));
        }
      });
  }

  protected shouldShowError(control: AbstractControl<string>): boolean {
    return control.invalid && (control.dirty || control.touched || this.submitted());
  }

  private updateCooldown(): void {
    const email = this.email();

    this.resendRemainingSeconds.set(
      email
        ? this.auth.verificationResendRemainingSeconds(
            email,
            RESEND_COOLDOWN_SECONDS
          )
        : 0
    );
  }

  private startCountdownTimer(): void {
    this.stopCountdownTimer();

    if (this.resendRemainingSeconds() <= 0) {
      return;
    }

    this.countdownTimerId = setInterval(() => {
      this.updateCooldown();

      if (this.resendRemainingSeconds() <= 0) {
        this.stopCountdownTimer();
      }
    }, 1000);
  }

  private stopCountdownTimer(): void {
    if (this.countdownTimerId === null) {
      return;
    }

    clearInterval(this.countdownTimerId);
    this.countdownTimerId = null;
  }

  private readErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'The verification code is invalid or has expired.';
    }

    if (error.status === 0) {
      return 'LevelHabit API is not reachable right now. Please try again in a moment.';
    }

    const problem = error.error as
      | { detail?: unknown; title?: unknown; errors?: Record<string, string[]> }
      | undefined;

    if (problem?.errors) {
      const firstError = Object.values(problem.errors)[0]?.[0];

      if (firstError) {
        return firstError;
      }
    }

    if (typeof problem?.detail === 'string') {
      return problem.detail;
    }

    if (typeof problem?.title === 'string') {
      return problem.title;
    }

    return 'The verification code is invalid or has expired.';
  }
}
