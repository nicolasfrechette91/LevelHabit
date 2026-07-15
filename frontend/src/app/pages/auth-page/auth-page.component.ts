import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';

import type { AuthResponse, LoginRequest, RegisterRequest } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';
import { BackendHealthService } from '../../backend-health.service';
import { TranslatePipe } from '../../i18n/i18n.pipes';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './auth-page.component.html',
  styleUrls: ['./auth-page.component.scss']
})
export class AuthPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly backendHealth = inject(BackendHealthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data
  });

  protected readonly pending = signal(false);
  protected readonly loginPasswordVisible = signal(false);
  protected readonly registerPasswordVisible = signal(false);
  protected readonly loginSubmitted = signal(false);
  protected readonly registerSubmitted = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly unconfirmedEmail = signal<string | null>(null);
  protected readonly mode = computed<AuthMode>(() =>
    this.routeData()['mode'] === 'register' ? 'register' : 'login'
  );

  protected readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  protected readonly registerForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    progressDisplayName: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(80)]
    ]
  });

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('verified') === 'email-confirmed') {
      this.successMessage.set(
        'auth.emailConfirmed'
      );
    }

    this.backendHealth
      .warmUp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  protected submitLogin(): void {
    this.loginSubmitted.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.unconfirmedEmail.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitAuth(this.auth.login(this.loginForm.getRawValue() satisfies LoginRequest));
  }

  protected submitRegister(): void {
    this.registerSubmitted.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.unconfirmedEmail.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const request = this.registerForm.getRawValue() satisfies RegisterRequest;

    this.pending.set(true);

    this.auth.register(request).pipe(finalize(() => this.pending.set(false))).subscribe({
      next: (response) => {
        const email = response.email || request.email;

        this.auth.rememberVerificationCodeSent(email);
        void this.router.navigate(['/verify-email'], {
          queryParams: {
            email
          }
        });
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.readErrorMessage(error));
      }
    });
  }

  protected shouldShowLoginError(control: AbstractControl<string>): boolean {
    return this.shouldShowControlError(control, this.loginSubmitted());
  }

  protected shouldShowRegisterError(control: AbstractControl<string>): boolean {
    return this.shouldShowControlError(control, this.registerSubmitted());
  }

  protected toggleLoginPasswordVisibility(): void {
    this.loginPasswordVisible.update((visible) => !visible);
  }

  protected toggleRegisterPasswordVisibility(): void {
    this.registerPasswordVisible.update((visible) => !visible);
  }

  private submitAuth(
    request: Observable<AuthResponse>,
    onSuccess?: () => void
  ): void {
    this.pending.set(true);
    this.errorMessage.set(null);

    request.pipe(finalize(() => this.pending.set(false))).subscribe({
      next: () => {
        onSuccess?.();
        void this.router.navigateByUrl(this.getReturnUrl());
      },
      error: (error: unknown) => {
        if (this.readErrorCode(error) === 'EMAIL_NOT_CONFIRMED') {
          this.unconfirmedEmail.set(this.loginForm.controls.email.value.trim());
        }

        this.errorMessage.set(this.readErrorMessage(error));
      }
    });
  }

  private getReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    if (!returnUrl || returnUrl.startsWith('/login') || returnUrl.startsWith('/register')) {
      return '/dashboard';
    }

    return returnUrl;
  }

  private readErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'errors.authentication';
    }

    if (error.status === 0) {
      return 'errors.apiUnavailable';
    }

    if (this.readErrorCode(error) === 'EMAIL_NOT_CONFIRMED') {
      return 'errors.emailNotConfirmed';
    }

    if (error.status === 401) {
      return 'errors.invalidCredentials';
    }

    return 'errors.authentication';
  }

  private readErrorCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    const problem = error.error as { code?: unknown } | undefined;

    return typeof problem?.code === 'string' ? problem.code : null;
  }

  private shouldShowControlError(
    control: AbstractControl<string>,
    submitted: boolean
  ): boolean {
    return control.invalid && (control.dirty || control.touched || submitted);
  }
}
