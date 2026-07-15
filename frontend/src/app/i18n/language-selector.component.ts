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
      class="form-select language-select"
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
    :host {
      align-items: center;
      display: inline-flex;
      max-width: 100%;
    }

    :host(.auth-header-control) {
      min-width: 0;
    }

    .language-select {
      appearance: none;
      background-color: rgba(255, 255, 255, .94);
      background-position: right .8rem center;
      background-size: .75rem .55rem;
      border-color: var(--lh-emerald, #206c53);
      color: var(--lh-emerald-strong, #164d3e);
      cursor: pointer;
      font-size: .92rem;
      font-weight: 800;
      height: 2.75rem;
      line-height: 1.25;
      min-width: 7.25rem;
      padding-block: 0;
      padding-inline: 1.1rem 2.35rem;
      transition:
        background-color 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease,
        color 160ms ease;
      width: auto;
    }

    :host(.auth-header-control) .language-select {
      border-radius: inherit;
      font-size: inherit;
      font-weight: inherit;
      height: 100%;
      padding-left: var(--auth-header-control-padding-inline, 1.1rem);
      transition: inherit;
    }

    .language-select:hover {
      background-color: rgba(32, 108, 83, .07);
      border-color: var(--lh-emerald-strong, #164d3e);
    }

    .language-select:focus {
      background-color: rgba(255, 255, 255, .98);
      border-color: var(--lh-emerald, #206c53);
      box-shadow: 0 0 0 .2rem rgba(32, 108, 83, .2);
      outline: 0;
    }

    @media (max-width: 575.98px) {
      .language-select { min-width: 6.25rem; }
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
