import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
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
  ForgotPasswordRequest,
  HeroProfile,
  LoginRequest,
  LogoutRequest,
  MeResponse,
  RefreshRequest,
  RegisterRequest,
  ResendEmailVerificationRequest,
  ResetPasswordRequest,
  VerifyEmailRequest
} from './auth.models';

export const AUTH_STORAGE_KEY = 'levelhabit.auth.v1';

type StoredAuth = Readonly<{
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
}>;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storedAuth = this.readStoredAuth();
  private readonly accessTokenSignal = signal<string | null>(
    this.storedAuth?.accessToken ?? null
  );
  private readonly expiresAtUtcSignal = signal<string | null>(
    this.storedAuth?.expiresAtUtc ?? null
  );
  private readonly refreshTokenSignal = signal<string | null>(
    this.storedAuth?.refreshToken ?? null
  );
  private readonly refreshTokenExpiresAtUtcSignal = signal<string | null>(
    this.storedAuth?.refreshTokenExpiresAtUtc ?? null
  );
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly heroProfileSignal = signal<HeroProfile | null>(null);
  private readonly emailVerificationNoticeSignal = signal<string | null>(null);
  private refreshRequest$: Observable<AuthResponse> | null = null;
  private sessionVersion = 0;

  readonly user = this.userSignal.asReadonly();
  readonly heroProfile = this.heroProfileSignal.asReadonly();
  readonly emailVerificationNotice =
    this.emailVerificationNoticeSignal.asReadonly();
  readonly isAuthenticated = computed(() =>
    this.hasToken() || this.hasRefreshToken()
  );
  readonly authRequired = environment.authRequired;
  readonly canUsePrototypeRoutes = computed(() =>
    !this.authRequired || this.isAuthenticated()
  );

  accessToken(): string | null {
    return this.accessTokenSignal();
  }

  refreshToken(): string | null {
    return this.refreshTokenSignal();
  }

  hasToken(): boolean {
    return this.tokenIsUsable(
      this.accessTokenSignal(),
      this.expiresAtUtcSignal()
    );
  }

  hasRefreshToken(): boolean {
    return this.tokenIsUsable(
      this.refreshTokenSignal(),
      this.refreshTokenExpiresAtUtcSignal()
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(tap((response) => this.persistSession(response)));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
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

  verifyEmail(email: string, token: string): Observable<AuthMessageResponse> {
    const request: VerifyEmailRequest = { email, token };

    return this.http.post<AuthMessageResponse>(
      `${environment.apiUrl}/auth/verify-email`,
      request,
      { context: this.skipRefreshContext() }
    );
  }

  resendEmailVerification(email: string): Observable<AuthMessageResponse> {
    const request: ResendEmailVerificationRequest = { email };

    return this.http.post<AuthMessageResponse>(
      `${environment.apiUrl}/auth/resend-email-verification`,
      request,
      { context: this.skipRefreshContext() }
    );
  }

  refreshSession(): Observable<AuthResponse> {
    const refreshToken = this.refreshTokenSignal();

    if (!refreshToken || !this.hasRefreshToken()) {
      this.clearSession();
      return throwError(() => new Error('A valid refresh token is required.'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const sessionVersion = this.sessionVersion;
    const request: RefreshRequest = { refreshToken };

    this.refreshRequest$ = this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, request, {
        context: this.skipRefreshContext()
      })
      .pipe(
        tap((response) => {
          if (
            this.sessionVersion === sessionVersion
            && this.refreshTokenSignal() === refreshToken
          ) {
            this.persistSession(response);
          }
        }),
        catchError((error: unknown) => {
          if (this.refreshTokenSignal() === refreshToken) {
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
    if (!this.hasToken()) {
      if (!this.hasRefreshToken()) {
        return throwError(() => new Error('A valid session is required.'));
      }

      return this.refreshSession().pipe(
        switchMap(() => this.loadCurrentUser())
      );
    }

    const user = this.userSignal();
    const heroProfile = this.heroProfileSignal();

    if (user && heroProfile) {
      return of({ user, heroProfile });
    }

    return this.loadCurrentUser();
  }

  updateHeroProfile(heroProfile: HeroProfile): void {
    this.heroProfileSignal.set(heroProfile);
  }

  showEmailVerificationNotice(email: string): void {
    const target = email.trim() || 'your inbox';

    this.emailVerificationNoticeSignal.set(
      `Account created. Check ${target} to verify your email address.`
    );
  }

  dismissEmailVerificationNotice(): void {
    this.emailVerificationNoticeSignal.set(null);
  }

  logout(): void {
    const refreshToken = this.refreshTokenSignal();

    this.clearSession();

    if (!refreshToken) {
      return;
    }

    const request: LogoutRequest = { refreshToken };

    this.http
      .post<void>(`${environment.apiUrl}/auth/logout`, request, {
        context: this.skipRefreshContext()
      })
      .pipe(catchError(() => of(undefined)))
      .subscribe();
  }

  clearSession(): void {
    this.sessionVersion += 1;
    this.refreshRequest$ = null;
    this.accessTokenSignal.set(null);
    this.expiresAtUtcSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.refreshTokenExpiresAtUtcSignal.set(null);
    this.userSignal.set(null);
    this.heroProfileSignal.set(null);
    this.emailVerificationNoticeSignal.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  private persistSession(response: AuthResponse): void {
    this.sessionVersion += 1;
    this.accessTokenSignal.set(response.accessToken);
    this.expiresAtUtcSignal.set(response.expiresAtUtc);
    this.refreshTokenSignal.set(response.refreshToken);
    this.refreshTokenExpiresAtUtcSignal.set(response.refreshTokenExpiresAtUtc);
    this.setCurrentUser(response);

    if (typeof localStorage === 'undefined') {
      return;
    }

    const storedAuth: StoredAuth = {
      accessToken: response.accessToken,
      expiresAtUtc: response.expiresAtUtc,
      refreshToken: response.refreshToken,
      refreshTokenExpiresAtUtc: response.refreshTokenExpiresAtUtc
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storedAuth));
  }

  private setCurrentUser(response: MeResponse): void {
    this.userSignal.set(response.user);
    this.heroProfileSignal.set(response.heroProfile);
  }

  private readStoredAuth(): StoredAuth | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);

      if (!stored) {
        return null;
      }

      const parsed: unknown = JSON.parse(stored);

      if (!this.isStoredAuth(parsed)) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }

      const accessExpiresAtMilliseconds = Date.parse(parsed.expiresAtUtc);
      const refreshExpiresAtMilliseconds = Date.parse(
        parsed.refreshTokenExpiresAtUtc
      );

      if (
        Number.isNaN(accessExpiresAtMilliseconds)
        || Number.isNaN(refreshExpiresAtMilliseconds)
        || refreshExpiresAtMilliseconds <= Date.now()
      ) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }

  private tokenIsUsable(token: string | null, expiresAtUtc: string | null): boolean {
    if (!token || !expiresAtUtc) {
      return false;
    }

    return Date.parse(expiresAtUtc) > Date.now();
  }

  private isStoredAuth(value: unknown): value is StoredAuth {
    return (
      this.isRecord(value)
      && typeof value['accessToken'] === 'string'
      && typeof value['expiresAtUtc'] === 'string'
      && typeof value['refreshToken'] === 'string'
      && typeof value['refreshTokenExpiresAtUtc'] === 'string'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private skipRefreshContext(): HttpContext {
    return new HttpContext().set(SKIP_AUTH_REFRESH, true);
  }
}
