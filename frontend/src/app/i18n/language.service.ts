import { Injectable, computed, signal } from '@angular/core';

import en from '../../assets/i18n/en.json';
import fr from '../../assets/i18n/fr.json';

export type SupportedLanguage = 'en' | 'fr';
export type TranslationParams = Readonly<Record<string, string | number>>;

interface TranslationBranch {
  readonly [key: string]: TranslationNode;
}
type TranslationNode = string | TranslationBranch;
type TranslationDictionary = Readonly<Record<string, TranslationNode>>;

export const LANGUAGE_STORAGE_KEY = 'levelhabit.language.v1';

export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English', locale: 'en-CA' },
  { value: 'fr', label: 'Français', locale: 'fr-CA' }
] as const satisfies readonly Readonly<{
  value: SupportedLanguage;
  label: string;
  locale: string;
}>[];

const TRANSLATIONS: Readonly<Record<SupportedLanguage, TranslationDictionary>> = {
  en,
  fr
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly languageSignal = signal<SupportedLanguage>(
    this.resolveInitialLanguage()
  );

  readonly supportedLanguages = SUPPORTED_LANGUAGES;
  readonly currentLanguage = this.languageSignal.asReadonly();
  readonly locale = computed(() =>
    this.languageSignal() === 'fr' ? 'fr-CA' : 'en-CA'
  );

  constructor() {
    this.updateDocumentLanguage(this.languageSignal());
  }

  setLanguage(language: SupportedLanguage): void {
    if (!this.isSupportedLanguage(language)) {
      return;
    }

    this.languageSignal.set(language);
    this.updateDocumentLanguage(language);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {
        // The active language still works when browser storage is unavailable.
      }
    }
  }

  translate(key: string, params: TranslationParams = {}): string {
    this.languageSignal();
    const value = this.lookup(this.languageSignal(), key)
      ?? this.lookup('en', key);

    if (typeof value !== 'string') {
      return key;
    }

    return this.interpolate(value, params);
  }

  translateCount(
    key: string,
    count: number,
    params: TranslationParams = {}
  ): string {
    const category = new Intl.PluralRules(this.locale()).select(count);
    const pluralKey = `${key}.${category}`;
    const fallbackKey = `${key}.other`;
    const value = this.lookup(this.languageSignal(), pluralKey)
      ?? this.lookup(this.languageSignal(), fallbackKey)
      ?? this.lookup('en', pluralKey)
      ?? this.lookup('en', fallbackKey);

    return typeof value === 'string'
      ? this.interpolate(value, { ...params, count })
      : key;
  }

  formatDate(
    value: string | number | Date,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
  ): string {
    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat(this.locale(), options).format(date);
  }

  formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
    return new Intl.NumberFormat(this.locale(), options).format(value);
  }

  private resolveInitialLanguage(): SupportedLanguage {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);

        if (stored !== null) {
          return this.isSupportedLanguage(stored) ? stored : 'en';
        }
      } catch {
        return 'en';
      }
    }

    if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr')) {
      return 'fr';
    }

    return 'en';
  }

  private isSupportedLanguage(value: unknown): value is SupportedLanguage {
    return value === 'en' || value === 'fr';
  }

  private lookup(language: SupportedLanguage, key: string): TranslationNode | undefined {
    let current: TranslationNode = TRANSLATIONS[language];

    for (const segment of key.split('.')) {
      if (typeof current === 'string') {
        return undefined;
      }

      const next: TranslationNode | undefined = current[segment];

      if (next === undefined) {
        return undefined;
      }

      current = next;
    }

    return current;
  }

  private interpolate(value: string, params: TranslationParams): string {
    return value.replace(/{{\s*([\w]+)\s*}}/g, (match, key: string) => {
      const replacement = params[key];
      return replacement === undefined ? match : String(replacement);
    });
  }

  private updateDocumentLanguage(language: SupportedLanguage): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }
}
