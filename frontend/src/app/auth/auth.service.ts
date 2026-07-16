import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import { environment } from '../../environments/environment';
import { SKIP_AUTH_REFRESH } from './auth-http.context';
import type {
  AuthMessageResponse,
  AuthResponse,
  AuthUser,
  ConfirmEmailRequest,
  CsrfTokenResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  ProgressProfile,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationCodeRequest,
  ResetPasswordRequest
} from './auth.models';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export const AUTH_STORAGE_KEY = 'levelhabit.auth.v1';
export const AUTH_CSRF_HEADER = 'X-LevelHabit-CSRF';
const EMAIL_VERIFICATION_SENT_STORAGE_PREFIX =
  'levelhabit.emailVerification.lastSent.v1.';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly expiresAtUtcSignal = signal<string | null>(null);
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly progressProfileSignal = signal<ProgressProfile | null>(null);
  private readonly emailVerificationNoticeSignal = signal<string | null>(null);
  private readonly authStatusSignal = signal<AuthStatus>('checking');
  private initializationRequest$: Observable<AuthStatus> | null = null;
  private refreshRequest$: Observable<AuthResponse> | null = null;
  private sessionVersion = 0;

  readonly user = this.userSignal.asReadonly();
  readonly progressProfile = this.progressProfileSignal.asReadonly();
  readonly emailVerificationNotice =
    this.emailVerificationNoticeSignal.asReadonly();
  readonly authStatus = this.authStatusSignal.asReadonly();
  readonly isAuthInitialized = computed(
    () => this.authStatusSignal() !== 'checking'
  );
  readonly isCheckingAuth = computed(
    () => this.authStatusSignal() === 'checking'
  );
  readonly isAuthenticated = computed(
    () => this.authStatusSignal() === 'authenticated'
  );
  readonly isUnauthenticated = computed(
    () => this.authStatusSignal() === 'unauthenticated'
  );
  readonly authRequired = environment.authRequired;
  readonly canUsePrototypeRoutes = computed(() =>
    !this.authRequired || this.isAuthenticated()
  );

  constructor() {
    this.removeLegacyStoredSession();
  }

  accessToken(): string | null {
    return this.accessTokenSignal();
  }

  hasToken(): boolean {
    return this.tokenIsUsable(
      this.accessTokenSignal(),
      this.expiresAtUtcSignal()
    );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${environment.apiUrl}/auth/register`,
      request,
      { context: this.skipRefreshContext() }
    );
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request, {
        context: this.skipRefreshContext(),
        withCredentials: true
      })
      .pipe(tap((response) => this.persistSession(response)));
  }

  forgotPassword(email: string): Observable<AuthMessageResponse> {
    const request: ForgotPasswordRequest = { email };

    return this.http.post<AuthMessageResponse>(
      `${environment.apiUrl}/auth/forgot-password`,
      request,
      { context: this.skipRefreshContext() }
    );
  }

  resetPassword(
    email: string,
    token: string,
    newPassword: string
  ): Observable<AuthMessageResponse> {
    const request: ResetPasswordRequest = { email, token, newPassword };

    return this.http.post<AuthMessageResponse>(
      `${environment.apiUrl}/auth/reset-password`,
      request,
      { context: this.skipRefreshContext() }
    );
  }

  confirmEmail(email: string, code: string): Observable<AuthMessageResponse> {
    const request: ConfirmEmailRequest = { email, code };

    return this.http.post<AuthMessageResponse>(
      `${environment.apiUrl}/auth/confirm-email`,
      request,
      { context: this.skipRefreshContext() }
    );
  }

  resendVerificationCode(email: string): Observable<AuthMessageResponse> {
    const request: ResendVerificationCodeRequest = { email };

    return this.http.post<AuthMessageResponse>(
      `${environment.apiUrl}/auth/resend-verification-code`,
      request,
      { context: this.skipRefreshContext() }
    );
  }

  rememberVerificationCodeSent(email: string, sentAt = Date.now()): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(
      this.verificationSentStorageKey(email),
      String(sentAt)
    );
  }

  verificationResendRemainingSeconds(
    email: string,
    cooldownSeconds: number
  ): number {
    if (typeof sessionStorage === 'undefined') {
      return 0;
    }

    const storedValue = sessionStorage.getItem(
      this.verificationSentStorageKey(email)
    );
    const sentAt = storedValue ? Number(storedValue) : Number.NaN;

    if (!Number.isFinite(sentAt)) {
      return 0;
    }

    const elapsedSeconds = Math.floor((Date.now() - sentAt) / 1000);

    return Math.max(0, cooldownSeconds - elapsedSeconds);
  }

  initializeAuth(): Observable<AuthStatus> {
    const currentStatus = this.authStatusSignal();

    if (currentStatus !== 'checking') {
      return of(currentStatus);
    }

    if (this.initializationRequest$) {
      return this.initializationRequest$;
    }

    this.initializationRequest$ = this.refreshSession().pipe(
      map(() => this.authStatusSignal()),
      catchError(() => of<AuthStatus>('unauthenticated')),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.initializationRequest$;
  }

  refreshSession(): Observable<AuthResponse> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const sessionVersion = this.sessionVersion;

    this.refreshRequest$ = this.requestCsrfToken().pipe(
      switchMap((csrfToken) =>
        this.http.post<AuthResponse>(
          `${environment.apiUrl}/auth/refresh`,
          {},
          {
            context: this.skipRefreshContext(),
            headers: { [AUTH_CSRF_HEADER]: csrfToken },
            withCredentials: true
          }
        )
      ),
      tap((response) => {
        if (this.sessionVersion === sessionVersion) {
          this.persistSession(response);
        }
      }),
      catchError((error: unknown) => {
        if (this.sessionVersion === sessionVersion) {
          this.clearSession();
        }

        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshRequest$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.refreshRequest$;
  }

  loadCurrentUser(): Observable<MeResponse> {
    return this.http
      .get<MeResponse>(`${environment.apiUrl}/auth/me`)
      .pipe(tap((response) => this.setCurrentUser(response)));
  }

  ensureCurrentUser(): Observable<MeResponse> {
    return this.initializeAuth().pipe(
      switchMap((status) => {
        if (status !== 'authenticated') {
          return throwError(() => new Error('Authentication is required.'));
        }

        if (!this.hasToken()) {
          return this.refreshSession().pipe(
            map((response) => ({
              user: response.user,
              progressProfile: response.progressProfile
            }))
          );
        }

        const user = this.userSignal();
        const progressProfile = this.progressProfileSignal();

        if (user && progressProfile) {
          return of({ user, progressProfile });
        }

        return this.loadCurrentUser();
      })
    );
  }

  updateProgressProfile(progressProfile: ProgressProfile): void {
    this.progressProfileSignal.set(progressProfile);
  }

  showEmailVerificationNotice(email: string): void {
    this.emailVerificationNoticeSignal.set(email.trim());
  }

  dismissEmailVerificationNotice(): void {
    this.emailVerificationNoticeSignal.set(null);
  }

  logout(): Observable<void> {
    this.clearSession();

    return this.requestCsrfToken().pipe(
      switchMap((csrfToken) =>
        this.http.post<void>(
          `${environment.apiUrl}/auth/logout`,
          {},
          {
            context: this.skipRefreshContext(),
            headers: { [AUTH_CSRF_HEADER]: csrfToken },
            withCredentials: true
          }
        )
      ),
      catchError(() => of(undefined))
    );
  }

  clearSession(): void {
    this.sessionVersion += 1;
    this.refreshRequest$ = null;
    this.accessTokenSignal.set(null);
    this.expiresAtUtcSignal.set(null);
    this.userSignal.set(null);
    this.progressProfileSignal.set(null);
    this.emailVerificationNoticeSignal.set(null);
    this.authStatusSignal.set('unauthenticated');
    this.removeLegacyStoredSession();
  }

  private requestCsrfToken(): Observable<string> {
    return this.http
      .get<CsrfTokenResponse>(`${environment.apiUrl}/auth/csrf`, {
        context: this.skipRefreshContext(),
        withCredentials: true
      })
      .pipe(map((response) => response.csrfToken));
  }

  private persistSession(response: AuthResponse): void {
    this.sessionVersion += 1;
    this.accessTokenSignal.set(response.accessToken);
    this.expiresAtUtcSignal.set(response.expiresAtUtc);
    this.setCurrentUser(response);
    this.authStatusSignal.set('authenticated');
    this.removeLegacyStoredSession();
  }

  private setCurrentUser(response: MeResponse): void {
    this.userSignal.set(response.user);
    this.progressProfileSignal.set(response.progressProfile);
  }

  private tokenIsUsable(token: string | null, expiresAtUtc: string | null): boolean {
    if (!token || !expiresAtUtc) {
      return false;
    }

    return Date.parse(expiresAtUtc) > Date.now();
  }

  private removeLegacyStoredSession(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  private verificationSentStorageKey(email: string): string {
    return `${EMAIL_VERIFICATION_SENT_STORAGE_PREFIX}${email.trim().toLowerCase()}`;
  }

  private skipRefreshContext(): HttpContext {
    return new HttpContext().set(SKIP_AUTH_REFRESH, true);
  }
}
