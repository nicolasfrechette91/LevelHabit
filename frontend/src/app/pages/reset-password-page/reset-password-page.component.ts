import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { TranslatePipe } from '../../i18n/i18n.pipes';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './reset-password-page.component.html',
  styleUrls: ['./reset-password-page.component.scss']
})
export class ResetPasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal(
    this.route.snapshot.queryParamMap.get('email') ?? ''
  );
  protected readonly token = signal(
    this.route.snapshot.queryParamMap.get('token') ?? ''
  );
  protected readonly missingLinkData = computed(
    () => this.email().trim().length === 0 || this.token().trim().length === 0
  );
  protected readonly pending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly passwordMismatch = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });

  protected submit(): void {
    this.submitted.set(true);
    this.passwordMismatch.set(false);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.missingLinkData()) {
      this.errorMessage.set('passwordRecovery.missingDetails');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (value.newPassword !== value.confirmPassword) {
      this.passwordMismatch.set(true);
      return;
    }

    this.pending.set(true);

    this.auth
      .resetPassword(
        this.email().trim(),
        this.token().trim(),
        value.newPassword
      )
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('passwordRecovery.resetSuccess');
          this.form.disable();
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.readErrorMessage(error));
        }
      });
  }

  protected shouldShowError(control: AbstractControl<string>): boolean {
    return control.invalid && (control.dirty || control.touched || this.submitted());
  }

  private readErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'errors.resetInvalid';
    }

    if (error.status === 0) {
      return 'errors.apiUnavailable';
    }

    return 'errors.resetInvalid';
  }
}
