import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BackendWakeupComponent } from './backend-wakeup.component';

describe('BackendWakeupComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders an accessible, calm checking state', async () => {
    const { element } = await setup('checking');

    expect(element.querySelector('main')?.getAttribute('aria-labelledby')).toBe(
      'wakeup-title'
    );
    expect(element.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(element.querySelector('[role="status"] .visually-hidden')?.textContent)
      .toContain('Loading your habits');
    expect(element.textContent).not.toContain('Render');
    expect(element.textContent).not.toContain('HTTP');
  });

  it('emits retry from the unavailable state', async () => {
    const { component, element } = await setup('unavailable');
    const retry = vi.fn();
    component.retry.subscribe(retry);

    const button = element.querySelector('.wakeup-retry') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();

    expect(retry).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('Your data is safe');
  });
});

async function setup(status: 'checking' | 'unavailable'): Promise<{
  component: BackendWakeupComponent;
  element: HTMLElement;
  fixture: ComponentFixture<BackendWakeupComponent>;
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
    fixture
  };
}
