import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { routes } from '../app.routes';
import { AuthService } from '../auth/auth.service';
import type { MeResponse } from '../auth/auth.models';
import { PrototypePageComponent } from '../pages/prototype-page/prototype-page.component';
import { LevelHabitStateService } from '../state/levelhabit-state.service';

export const AUTH_ME_RESPONSE: MeResponse = {
  user: {
    id: 'f972df99-805d-48a3-93e6-e5c469ba8be6',
    email: 'player@example.com',
    displayName: 'Player One',
    createdAtUtc: '2026-06-17T20:00:00Z'
  },
  heroProfile: {
    id: '883089e0-6d74-4564-814d-1a3c5fe1fcff',
    heroName: 'Morning Warden',
    level: 1,
    totalXp: 0,
    currentStreak: 0,
    createdAtUtc: '2026-06-17T20:00:00Z'
  }
};

export function resetPrototypeStorage(): void {
  TestBed.resetTestingModule();
  localStorage.clear();
}

export async function renderPrototypeRoute(path: string): Promise<{
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
  component: PrototypePageComponent;
  state: LevelHabitStateService;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: createAuthenticatedAuthService()
      }
    ]
  });

  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(path, PrototypePageComponent);
  const nativeElement = harness.routeNativeElement;

  if (!nativeElement) {
    throw new Error(`Route "${path}" did not render a native element.`);
  }

  return {
    harness,
    nativeElement,
    component,
    state: TestBed.inject(LevelHabitStateService)
  };
}

function createAuthenticatedAuthService(): Pick<
  AuthService,
  | 'authRequired'
  | 'canUsePrototypeRoutes'
  | 'ensureCurrentUser'
  | 'hasToken'
  | 'heroProfile'
  | 'isAuthenticated'
  | 'logout'
  | 'user'
> {
  const user = signal(AUTH_ME_RESPONSE.user);
  const heroProfile = signal(AUTH_ME_RESPONSE.heroProfile);
  const isAuthenticated = signal(true);
  const canUsePrototypeRoutes = signal(true);

  return {
    authRequired: false,
    canUsePrototypeRoutes: canUsePrototypeRoutes.asReadonly(),
    user: user.asReadonly(),
    heroProfile: heroProfile.asReadonly(),
    isAuthenticated: isAuthenticated.asReadonly(),
    hasToken: () => true,
    ensureCurrentUser: () => of(AUTH_ME_RESPONSE),
    logout: () => undefined
  };
}

export function textContent(element: Element): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function getButtonByText(container: ParentNode, label: RegExp): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    label.test(textContent(candidate))
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find button matching ${label}.`);
  }

  return button;
}

export function getQuestToggle(container: ParentNode, questTitle: string): HTMLButtonElement {
  const button = container.querySelector(
    `button[aria-label*="${questTitle}"]`
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find quest toggle for "${questTitle}".`);
  }

  return button;
}
