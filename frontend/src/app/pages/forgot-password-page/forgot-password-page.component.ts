import { Component, signal, inject } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { TranslatePipe } from '../../i18n/i18n.pipes';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './forgot-password-page.component.html',
  styleUrls: ['./forgot-password-page.component.scss']
})
export class ForgotPasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly pending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]]
  });

  protected submit(): void {
    this.submitted.set(true);
    this.successMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.controls.email.value.trim();
    this.pending.set(true);

    this.auth
      .forgotPassword(email)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('passwordRecovery.sent');
        },
        error: () => {
          this.successMessage.set('passwordRecovery.sent');
        }
      });
  }

  protected shouldShowError(control: AbstractControl<string>): boolean {
    return control.invalid && (control.dirty || control.touched || this.submitted());
  }
}
