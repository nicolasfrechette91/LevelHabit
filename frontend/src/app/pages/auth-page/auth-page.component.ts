import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';

import type { AuthResponse, LoginRequest, RegisterRequest } from '../../auth/auth.models';
import { AuthService } from '../../auth/auth.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.component.html',
  styleUrls: ['./auth-page.component.scss']
})
export class AuthPageComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data
  });

  protected readonly pending = signal(false);
  protected readonly loginSubmitted = signal(false);
  protected readonly registerSubmitted = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
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
    heroName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]]
  });

  protected submitLogin(): void {
    this.loginSubmitted.set(true);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitAuth(this.auth.login(this.loginForm.getRawValue() satisfies LoginRequest));
  }

  protected submitRegister(): void {
    console.log('submitRegister fired');
    console.log('valid:', this.registerForm.valid);
    console.log('errors:', {
      email: this.registerForm.controls.email.errors,
      password: this.registerForm.controls.password.errors,
      displayName: this.registerForm.controls.displayName.errors,
      heroName: this.registerForm.controls.heroName.errors
    });
    this.registerSubmitted.set(true);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.submitAuth(this.auth.register(this.registerForm.getRawValue() satisfies RegisterRequest));
  }

  private submitAuth(request: Observable<AuthResponse>): void {
    this.pending.set(true);
    this.errorMessage.set(null);

    request.pipe(finalize(() => this.pending.set(false))).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.getReturnUrl());
      },
      error: (error: unknown) => {
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
      return 'Authentication failed. Please try again.';
    }

    if (error.status === 0) {
      return 'LevelHabit API is not reachable right now. Please try again in a moment.';
    }

    const problem = error.error as
      | { detail?: unknown; title?: unknown; errors?: Record<string, string[]> }
      | undefined;

    if (typeof problem?.detail === 'string') {
      return problem.detail;
    }

    if (problem?.errors) {
      const firstError = Object.values(problem.errors)[0]?.[0];

      if (firstError) {
        return firstError;
      }
    }

    if (typeof problem?.title === 'string') {
      return problem.title;
    }

    return 'Authentication failed. Please try again.';
  }
}
