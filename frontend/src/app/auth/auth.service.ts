import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import type {
  AuthResponse,
  AuthUser,
  HeroProfile,
  LoginRequest,
  MeResponse,
  RegisterRequest
} from './auth.models';

export const AUTH_STORAGE_KEY = 'levelhabit.auth.v1';

type StoredAuth = Readonly<{
  accessToken: string;
  expiresAtUtc: string;
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
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly heroProfileSignal = signal<HeroProfile | null>(null);

  readonly user = this.userSignal.asReadonly();
  readonly heroProfile = this.heroProfileSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.hasToken());
  readonly authRequired = environment.authRequired;
  readonly canUsePrototypeRoutes = computed(() =>
    !this.authRequired || this.isAuthenticated()
  );

  accessToken(): string | null {
    return this.accessTokenSignal();
  }

  hasToken(): boolean {
    const token = this.accessTokenSignal();
    const expiresAtUtc = this.expiresAtUtcSignal();

    if (!token || !expiresAtUtc) {
      return false;
    }

    return Date.parse(expiresAtUtc) > Date.now();
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

  loadCurrentUser(): Observable<MeResponse> {
    return this.http
      .get<MeResponse>(`${environment.apiUrl}/auth/me`)
      .pipe(tap((response) => this.setCurrentUser(response)));
  }

  ensureCurrentUser(): Observable<MeResponse> {
    if (!this.hasToken()) {
      return throwError(() => new Error('A valid access token is required.'));
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

  logout(): void {
    this.accessTokenSignal.set(null);
    this.expiresAtUtcSignal.set(null);
    this.userSignal.set(null);
    this.heroProfileSignal.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  private persistSession(response: AuthResponse): void {
    this.accessTokenSignal.set(response.accessToken);
    this.expiresAtUtcSignal.set(response.expiresAtUtc);
    this.setCurrentUser(response);

    if (typeof localStorage === 'undefined') {
      return;
    }

    // Prototype auth storage: localStorage keeps refreshes simple until a
    // production backend/frontend deployment can choose a stronger strategy.
    const storedAuth: StoredAuth = {
      accessToken: response.accessToken,
      expiresAtUtc: response.expiresAtUtc
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

      const parsed = JSON.parse(stored) as Partial<StoredAuth>;

      if (
        typeof parsed.accessToken !== 'string' ||
        typeof parsed.expiresAtUtc !== 'string'
      ) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }

      const expiresAtMilliseconds = Date.parse(parsed.expiresAtUtc);

      if (
        Number.isNaN(expiresAtMilliseconds) ||
        expiresAtMilliseconds <= Date.now()
      ) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }

      return {
        accessToken: parsed.accessToken,
        expiresAtUtc: parsed.expiresAtUtc
      };
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }
}
