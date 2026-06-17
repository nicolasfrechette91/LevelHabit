import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../app.routes';
import { PrototypePageComponent } from '../pages/prototype-page/prototype-page.component';
import { LevelHabitStateService } from '../state/levelhabit-state.service';

export function resetPrototypeStorage(): void {
  localStorage.clear();
}

export async function renderPrototypeRoute(path: string): Promise<{
  harness: RouterTestingHarness;
  nativeElement: HTMLElement;
  component: PrototypePageComponent;
  state: LevelHabitStateService;
}> {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes)]
  });

  const harness = await RouterTestingHarness.create(path);
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
