import { Pipe, PipeTransform, inject } from '@angular/core';

import { LanguageService, type TranslationParams } from './language.service';

@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(key: string | null | undefined, params: TranslationParams = {}): string {
    return key ? this.language.translate(key, params) : '';
  }
}

@Pipe({ name: 'translateCount', pure: false })
export class TranslateCountPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(
    key: string,
    count: number,
    params: TranslationParams = {}
  ): string {
    return this.language.translateCount(key, count, params);
  }
}

@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(
    value: string | number | Date | null | undefined,
    format: 'short' | 'mediumDate' | 'longDate' | 'weekdayShort' = 'mediumDate'
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    const options: Record<typeof format, Intl.DateTimeFormatOptions> = {
      short: { dateStyle: 'short', timeStyle: 'short' },
      mediumDate: { dateStyle: 'medium' },
      longDate: { dateStyle: 'long' },
      weekdayShort: { weekday: 'short', timeZone: 'UTC' }
    };

    return this.language.formatDate(value, options[format]);
  }
}

@Pipe({ name: 'localNumber', pure: false })
export class LocalNumberPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number, maximumFractionDigits = 0): string {
    return this.language.formatNumber(value, { maximumFractionDigits });
  }
}

@Pipe({ name: 'localPercent', pure: false })
export class LocalPercentPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number, maximumFractionDigits = 0): string {
    return this.language.formatNumber(value, {
      style: 'percent',
      maximumFractionDigits
    });
  }
}
