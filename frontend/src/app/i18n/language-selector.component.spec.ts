import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { TranslatePipe } from './i18n.pipes';
import { LanguageSelectorComponent } from './language-selector.component';
import { LANGUAGE_STORAGE_KEY } from './language.service';

@Component({
  imports: [LanguageSelectorComponent, TranslatePipe],
  template: `
    <app-language-selector />
    <p data-testid="translated-text">{{ 'navigation.login' | translate }}</p>
  `
})
class LanguageSelectorHostComponent {}

describe('LanguageSelectorComponent', () => {
  let fixture: ComponentFixture<LanguageSelectorHostComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LanguageSelectorHostComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(LanguageSelectorHostComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('has a connected accessible label and keyboard-focusable native selector', () => {
    const select = element.querySelector('select') as HTMLSelectElement;
    const label = element.querySelector('label') as HTMLLabelElement;

    select.focus();

    expect(label.htmlFor).toBe(select.id);
    expect(select.getAttribute('aria-label')).toBe('Language');
    expect(document.activeElement).toBe(select);
    expect(Array.from(select.options).map((option) => option.text)).toEqual([
      'English',
      'Français'
    ]);
  });

  it('updates visible text immediately when the language changes', () => {
    const select = element.querySelector('select') as HTMLSelectElement;

    select.value = 'fr';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="translated-text"]')?.textContent)
      .toContain('Se connecter');
    expect(select.getAttribute('aria-label')).toBe('Langue');
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr');
  });

  it('shows a restored French preference as selected', async () => {
    TestBed.resetTestingModule();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    await TestBed.configureTestingModule({
      imports: [LanguageSelectorHostComponent]
    }).compileComponents();
    const restoredFixture = TestBed.createComponent(LanguageSelectorHostComponent);
    restoredFixture.detectChanges();
    const select = restoredFixture.nativeElement.querySelector('select') as HTMLSelectElement;

    expect(select.value).toBe('fr');
    expect(select.selectedOptions[0]?.text).toBe('Français');
  });
});
