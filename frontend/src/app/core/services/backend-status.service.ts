import { HttpClient, HttpContext } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  inject,
  signal
} from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  catchError,
  exhaustMap,
  filter,
  map,
  of,
  take,
  timeout,
  timer
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { SKIP_AUTH } from '../../auth/auth-http.context';

export type BackendStatus = 'checking' | 'available' | 'unavailable';

export const BACKEND_RETRY_INTERVAL_MS = 4_000;
export const BACKEND_REQUEST_TIMEOUT_MS = 8_000;
export const BACKEND_MAX_ATTEMPTS = 6;

@Injectable({
  providedIn: 'root'
})
export class BackendStatusService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly statusSignal = signal<BackendStatus>('checking');
  private readonly statusChanges = new BehaviorSubject<BackendStatus>('checking');
  private checkSubscription: Subscription | null = null;

  readonly status = this.statusSignal.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopChecking();
      this.statusChanges.complete();
    });
  }

  startCheck(): void {
    if (
      this.statusSignal() === 'available'
      || (this.checkSubscription && !this.checkSubscription.closed)
    ) {
      return;
    }

    this.stopChecking();
    this.setStatus('checking');

    this.checkSubscription = timer(0, BACKEND_RETRY_INTERVAL_MS)
      .pipe(
        exhaustMap(() => this.requestAvailability()),
        take(BACKEND_MAX_ATTEMPTS)
      )
      .subscribe({
        next: (available) => {
          if (available) {
            this.setStatus('available');
            this.stopChecking();
          }
        },
        complete: () => {
          this.checkSubscription = null;

          if (this.statusSignal() === 'checking') {
            this.setStatus('unavailable');
          }
        }
      });
  }

  whenAvailable(): Observable<void> {
    this.startCheck();

    return this.statusChanges.pipe(
      filter((status) => status === 'available'),
      take(1),
      map(() => undefined)
    );
  }

  private requestAvailability(): Observable<boolean> {
    return this.http
      .get(`${environment.apiUrl}/health`, {
        context: new HttpContext().set(SKIP_AUTH, true),
        responseType: 'text'
      })
      .pipe(
        timeout({ each: BACKEND_REQUEST_TIMEOUT_MS }),
        map(() => true),
        catchError(() => of(false))
      );
  }

  private stopChecking(): void {
    this.checkSubscription?.unsubscribe();
    this.checkSubscription = null;
  }

  private setStatus(status: BackendStatus): void {
    this.statusSignal.set(status);
    this.statusChanges.next(status);
  }
}
