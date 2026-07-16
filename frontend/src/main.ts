import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEnCa from '@angular/common/locales/en-CA';
import localeFrCa from '@angular/common/locales/fr-CA';
import {
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
  type Provider
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AuthService } from './app/auth/auth.service';
import { authTokenInterceptor } from './app/auth/auth-token.interceptor';
import { environment } from './environments/environment';

registerLocaleData(localeEnCa);
registerLocaleData(localeFrCa);

bootstrapLevelHabit().catch((error: unknown) => console.error(error));

async function bootstrapLevelHabit(): Promise<void> {
  const errorTrackingProviders = await loadErrorTrackingProviders();

  await bootstrapApplication(AppComponent, {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      ...errorTrackingProviders,
      provideHttpClient(withInterceptors([authTokenInterceptor])),
      provideAppInitializer(() => {
        inject(AuthService).initializeAuth().subscribe();
      }),
      provideRouter(
        routes,
        withHashLocation(),
        withInMemoryScrolling({
          anchorScrolling: 'enabled',
          scrollPositionRestoration: 'top'
        })
      )
    ]
  });
}

async function loadErrorTrackingProviders(): Promise<Provider[]> {
  if (!environment.production || environment.sentry.dsn.trim().length === 0) {
    return [];
  }

  const errorTracking = await import(
    './app/observability/sentry-error-tracking'
  );

  await errorTracking.initializeErrorTracking();
  return errorTracking.provideErrorTracking();
}
