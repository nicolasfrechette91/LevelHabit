import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LANGUAGE_STORAGE_KEY,
  LanguageService
} from './language.service';

describe('LanguageService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses English as the default fallback', () => {
    mockBrowserLanguage('es-MX');

    const language = TestBed.inject(LanguageService);

    expect(language.currentLanguage()).toBe('en');
    expect(language.locale()).toBe('en-CA');
    expect(document.documentElement.lang).toBe('en');
  });

  it('selects French for a French browser when no preference is saved', () => {
    mockBrowserLanguage('fr-FR');

    const language = TestBed.inject(LanguageService);

    expect(language.currentLanguage()).toBe('fr');
    expect(language.locale()).toBe('fr-CA');
  });

  it('restores a saved language preference before browser detection', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    mockBrowserLanguage('en-US');

    expect(TestBed.inject(LanguageService).currentLanguage()).toBe('fr');
  });

  it('falls back to English for an invalid saved language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    mockBrowserLanguage('fr-CA');

    expect(TestBed.inject(LanguageService).currentLanguage()).toBe('en');
  });

  it('persists language changes and updates the document language', () => {
    mockBrowserLanguage('en-CA');
    const language = TestBed.inject(LanguageService);

    language.setLanguage('fr');

    expect(language.currentLanguage()).toBe('fr');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('supports interpolation and Canadian plural rules', () => {
    const language = TestBed.inject(LanguageService);

    expect(language.translate('auth.verificationNotice', { email: 'joueur@example.com' }))
      .toContain('joueur@example.com');
    expect(language.translateCount('analytics.habitCount', 1)).toBe('1 habit');
    expect(language.translateCount('analytics.habitCount', 2)).toBe('2 habits');

    language.setLanguage('fr');

    expect(language.translateCount('analytics.habitCount', 1)).toBe('1 habitude');
    expect(language.translateCount('analytics.habitCount', 2)).toBe('2 habitudes');
  });

  it('formats dates with the selected Canadian locale', () => {
    const language = TestBed.inject(LanguageService);
    const date = new Date('2026-07-14T12:00:00Z');
    const english = language.formatDate(date, { month: 'long', day: 'numeric', timeZone: 'UTC' });

    language.setLanguage('fr');
    const french = language.formatDate(date, { month: 'long', day: 'numeric', timeZone: 'UTC' });

    expect(english).toContain('July');
    expect(french).toContain('juillet');
  });

  it('formats numbers and percentages with the selected Canadian locale', () => {
    const language = TestBed.inject(LanguageService);

    expect(language.formatNumber(12345)).toBe('12,345');
    expect(language.formatNumber(0.75, { style: 'percent' })).toBe('75%');

    language.setLanguage('fr');

    expect(language.formatNumber(12345)).toMatch(/^12\s345$/);
    expect(language.formatNumber(0.75, { style: 'percent' })).toMatch(/^75\s%$/);
  });
});

function mockBrowserLanguage(language: string): void {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
}
