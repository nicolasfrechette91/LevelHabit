import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-verify-email-page',
  imports: [RouterLink],
  templateUrl: './verify-email-page.component.html',
  styleUrls: ['./verify-email-page.component.scss']
})
export class VerifyEmailPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly pending = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email') ?? '';
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (email.trim().length === 0 || token.trim().length === 0) {
      this.errorMessage.set('This verification link is missing required details.');
      return;
    }

    this.pending.set(true);

    this.auth
      .verifyEmail(email.trim(), token.trim())
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (response) => {
          this.successMessage.set(response.message);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.readErrorMessage(error));
        }
      });
  }

  private readErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'This verification link is invalid or has expired.';
    }

    if (error.status === 0) {
      return 'LevelHabit API is not reachable right now. Please try again in a moment.';
    }

    const problem = error.error as { detail?: unknown; title?: unknown } | undefined;

    if (typeof problem?.detail === 'string') {
      return problem.detail;
    }

    if (typeof problem?.title === 'string') {
      return problem.title;
    }

    return 'This verification link is invalid or has expired.';
  }
}
