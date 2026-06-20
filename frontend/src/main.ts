import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideZoneChangeDetection, type Provider } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authTokenInterceptor } from './app/auth/auth-token.interceptor';
import { environment } from './environments/environment';

bootstrapLevelHabit().catch((error: unknown) => console.error(error));

async function bootstrapLevelHabit(): Promise<void> {
  const errorTrackingProviders = await loadErrorTrackingProviders();

  await bootstrapApplication(AppComponent, {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      ...errorTrackingProviders,
      provideHttpClient(withInterceptors([authTokenInterceptor])),
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
