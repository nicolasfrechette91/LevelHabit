import { ErrorHandler, Injectable, type Provider } from '@angular/core';
import type { Breadcrumb, ErrorEvent as SentryErrorEvent } from '@sentry/angular';

import { environment } from '../../environments/environment';

type SentryAngular = typeof import('@sentry/angular');

const SENSITIVE_KEY_PATTERN =
  /(authorization|password|passwd|access.?token|refresh.?token|jwt|secret|postgres(?:ql)?|connection.?string|database.?url)/i;

let sentryModulePromise: Promise<SentryAngular> | null = null;

export async function initializeErrorTracking(): Promise<void> {
  if (!sentryIsEnabled()) {
    return;
  }

  try {
    const sentry = await loadSentry();

    sentry.init({
      dsn: environment.sentry.dsn,
      environment: environment.sentry.environment,
      sendDefaultPii: false,
      attachStacktrace: true,
      maxBreadcrumbs: 20,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb
    });
  } catch (error: unknown) {
    console.error(error);
  }
}

export function provideErrorTracking(): Provider[] {
  if (!sentryIsEnabled()) {
    return [];
  }

  return [
    {
      provide: ErrorHandler,
      useClass: LevelHabitSentryErrorHandler
    }
  ];
}

@Injectable()
class LevelHabitSentryErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    void captureAngularError(error);
  }
}

async function captureAngularError(error: unknown): Promise<void> {
  if (!sentryIsEnabled()) {
    return;
  }

  try {
    const sentry = await loadSentry();

    sentry.captureException(extractError(error), {
      mechanism: {
        type: 'auto.function.angular.error_handler',
        handled: false
      }
    });
  } catch (captureError: unknown) {
    console.error(captureError);
  }
}

function loadSentry(): Promise<SentryAngular> {
  sentryModulePromise ??= import('@sentry/angular');
  return sentryModulePromise;
}

function sentryIsEnabled(): boolean {
  return environment.production && environment.sentry.dsn.trim().length > 0;
}

function scrubEvent(event: SentryErrorEvent): SentryErrorEvent {
  const route = currentRoutePath();

  event.tags = {
    ...event.tags,
    'service.name': environment.sentry.serviceName,
    route
  };

  event.contexts = {
    ...event.contexts,
    route: {
      path: route
    }
  };

  delete event.user;

  if (event.request) {
    const url = stripQueryAndFragment(event.request.url);

    if (url) {
      event.request.url = url;
    } else {
      delete event.request.url;
    }

    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.env;
  }

  const extra = scrubRecord(event.extra);

  if (extra) {
    event.extra = extra;
  } else {
    delete event.extra;
  }

  return event;
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category?.startsWith('console')) {
    return null;
  }

  if (!breadcrumb.data) {
    return breadcrumb;
  }

  const nextBreadcrumb = { ...breadcrumb };
  const data = scrubRecord(breadcrumb.data);

  if (data) {
    nextBreadcrumb.data = data;
  } else {
    delete nextBreadcrumb.data;
  }

  return nextBreadcrumb;
}

function scrubRecord(
  record: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!record) {
    return undefined;
  }

  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    scrubbed[key] = key.toLowerCase().includes('url') && typeof value === 'string'
      ? stripQueryAndFragment(value)
      : value;
  }

  return Object.keys(scrubbed).length > 0 ? scrubbed : undefined;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function extractError(error: unknown): unknown {
  if (isRecord(error) && 'ngOriginalError' in error) {
    return error['ngOriginalError'] ?? 'Handled unknown error';
  }

  return error ?? 'Handled unknown error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function currentRoutePath(): string {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const hashPath = window.location.hash.replace(/^#/, '');
  const path = hashPath.length > 0 ? hashPath : window.location.pathname;

  return stripQueryAndFragment(path) ?? 'unknown';
}

function stripQueryAndFragment(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }

  try {
    const base =
      typeof window === 'undefined'
        ? 'https://levelhabit.local'
        : window.location.origin;
    const url = new URL(value, base);

    url.search = '';
    url.hash = '';

    if (/^https?:\/\//i.test(value)) {
      return url.toString();
    }

    return `${url.pathname}${url.hash}`;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
}
