import { Component, inject } from '@angular/core';

import { TranslatePipe } from './i18n.pipes';
import {
  LanguageService,
  type SupportedLanguage
} from './language.service';

@Component({
  selector: 'app-language-selector',
  imports: [TranslatePipe],
  template: `
    <label class="visually-hidden" [for]="selectId">
      {{ 'language.label' | translate }}
    </label>
    <select
      class="form-select form-select-sm language-select"
      [id]="selectId"
      [attr.aria-label]="'language.label' | translate"
      [value]="language.currentLanguage()"
      (change)="changeLanguage($event)"
    >
      @for (option of language.supportedLanguages; track option.value) {
        <option
          [value]="option.value"
          [selected]="option.value === language.currentLanguage()"
        >{{ option.label }}</option>
      }
    </select>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    .language-select {
      width: auto;
      min-width: 7.25rem;
      color: var(--lh-ink, #17372f);
      background-color: rgba(255, 255, 255, .92);
      border-color: rgba(23, 55, 47, .25);
      font-weight: 700;
    }
  `]
})
export class LanguageSelectorComponent {
  protected readonly language = inject(LanguageService);
  protected readonly selectId = `language-selector-${LanguageSelectorComponent.nextId++}`;
  private static nextId = 0;

  protected changeLanguage(event: Event): void {
    const select = event.target;

    if (select instanceof HTMLSelectElement) {
      this.language.setLanguage(select.value as SupportedLanguage);
    }
  }
}
