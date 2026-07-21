import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageService } from '../../../i18n/language.service';
import { BackendWakeupComponent } from './backend-wakeup.component';

describe('BackendWakeupComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('renders an accessible, calm checking state', async () => {
    const { element, language } = await setup('checking');

    expect(element.querySelector('main')?.getAttribute('aria-labelledby')).toBe(
      'wakeup-title'
    );
    expect(element.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(element.querySelector('[role="status"] .visually-hidden')?.textContent)
      .toContain(language.translate('backendWakeup.checking.loadingLabel'));
    expect(element.querySelector('#wakeup-title')?.textContent)
      .toContain(language.translate('backendWakeup.checking.title'));
    expect(element.textContent).not.toContain('Render');
    expect(element.textContent).not.toContain('HTTP');
  });

  it('emits retry from the unavailable state', async () => {
    const { component, element, language } = await setup('unavailable');
    const retry = vi.fn();
    component.retry.subscribe(retry);

    const button = element.querySelector('.wakeup-retry') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();

    expect(retry).toHaveBeenCalledOnce();
    expect(element.textContent).toContain(
      language.translate('backendWakeup.unavailable.description')
    );
  });

  it('updates visible and accessible text after a runtime language change', async () => {
    const { element, fixture, language } = await setup('checking');

    language.setLanguage('fr');
    fixture.detectChanges();

    expect(element.querySelector('.wakeup-brand')?.getAttribute('aria-label'))
      .toBe(language.translate('backendWakeup.brand'));
    expect(element.querySelector('#wakeup-title')?.textContent)
      .toContain(language.translate('backendWakeup.checking.title'));
    expect(element.querySelector('[role="status"] .visually-hidden')?.textContent)
      .toContain(language.translate('backendWakeup.checking.loadingLabel'));
    expect(element.querySelector('.wakeup-progress')?.textContent)
      .toContain(language.translate('backendWakeup.checking.progress'));
  });
});

async function setup(status: 'checking' | 'unavailable'): Promise<{
  component: BackendWakeupComponent;
  element: HTMLElement;
  fixture: ComponentFixture<BackendWakeupComponent>;
  language: LanguageService;
}> {
  await TestBed.configureTestingModule({
    imports: [BackendWakeupComponent]
  }).compileComponents();

  const fixture = TestBed.createComponent(BackendWakeupComponent);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();

  return {
    component: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
    fixture,
    language: TestBed.inject(LanguageService)
  };
}
