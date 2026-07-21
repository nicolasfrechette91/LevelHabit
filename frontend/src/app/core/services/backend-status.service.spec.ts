import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { SKIP_AUTH } from '../../auth/auth-http.context';
import {
  BACKEND_MAX_ATTEMPTS,
  BACKEND_RETRY_INTERVAL_MS,
  BackendStatusService
} from './backend-status.service';

describe('BackendStatusService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('starts in checking and marks any successful response as available', async () => {
    const { http, service } = setup();

    expect(service.status()).toBe('checking');
    service.startCheck();
    await vi.advanceTimersByTimeAsync(0);

    const request = expectHealthRequest(http);
    expect(request.request.context.get(SKIP_AUTH)).toBe(true);
    request.flush('Healthy', { status: 204, statusText: 'No Content' });

    expect(service.status()).toBe('available');
    http.verify();
  });

  it('retries failed checks at the configured interval', async () => {
    const { http, service } = setup();

    service.startCheck();
    await vi.advanceTimersByTimeAsync(0);
    failHealthRequest(http);

    await vi.advanceTimersByTimeAsync(BACKEND_RETRY_INTERVAL_MS - 1);
    http.expectNone(`${environment.apiUrl}/health`);
    await vi.advanceTimersByTimeAsync(1);

    expectHealthRequest(http).flush('Healthy');
    expect(service.status()).toBe('available');
    http.verify();
  });

  it('stops automatic retries immediately after success', async () => {
    const { http, service } = setup();

    service.startCheck();
    await vi.advanceTimersByTimeAsync(0);
    expectHealthRequest(http).flush('Healthy');

    await vi.advanceTimersByTimeAsync(BACKEND_RETRY_INTERVAL_MS * 3);
    http.expectNone(`${environment.apiUrl}/health`);
    expect(service.status()).toBe('available');
    http.verify();
  });

  it('becomes unavailable after the retry limit', async () => {
    const { http, service } = setup();

    service.startCheck();

    for (let attempt = 0; attempt < BACKEND_MAX_ATTEMPTS; attempt += 1) {
      await vi.advanceTimersByTimeAsync(
        attempt === 0 ? 0 : BACKEND_RETRY_INTERVAL_MS
      );
      failHealthRequest(http);
    }

    expect(service.status()).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(BACKEND_RETRY_INTERVAL_MS * 2);
    http.expectNone(`${environment.apiUrl}/health`);
    http.verify();
  });

  it('restarts checking after the user retries', async () => {
    const { http, service } = setup();

    service.startCheck();
    for (let attempt = 0; attempt < BACKEND_MAX_ATTEMPTS; attempt += 1) {
      await vi.advanceTimersByTimeAsync(
        attempt === 0 ? 0 : BACKEND_RETRY_INTERVAL_MS
      );
      failHealthRequest(http);
    }

    service.startCheck();
    expect(service.status()).toBe('checking');
    await vi.advanceTimersByTimeAsync(0);
    expectHealthRequest(http).flush('Healthy');

    expect(service.status()).toBe('available');
    http.verify();
  });

  it('does not create simultaneous health checks', async () => {
    const { http, service } = setup();

    service.startCheck();
    service.startCheck();
    service.startCheck();
    await vi.advanceTimersByTimeAsync(0);

    expect(http.match(`${environment.apiUrl}/health`)).toHaveLength(1);
  });

  it('allows availability waiters to continue after success', async () => {
    const { http, service } = setup();
    const available = firstValueFrom(service.whenAvailable());

    await vi.advanceTimersByTimeAsync(0);
    expectHealthRequest(http).flush('Healthy');

    await expect(available).resolves.toBeUndefined();
    http.verify();
  });

  it('cleans up its active request and retry timer when destroyed', async () => {
    const { http, service } = setup();

    service.startCheck();
    await vi.advanceTimersByTimeAsync(0);
    const request = expectHealthRequest(http);

    TestBed.resetTestingModule();

    expect(request.cancelled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

function setup(): {
  http: HttpTestingController;
  service: BackendStatusService;
} {
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(BackendStatusService)
  };
}

function expectHealthRequest(http: HttpTestingController) {
  const request = http.expectOne(`${environment.apiUrl}/health`);

  expect(request.request.method).toBe('GET');
  expect(request.request.responseType).toBe('text');
  return request;
}

function failHealthRequest(http: HttpTestingController): void {
  expectHealthRequest(http).flush('Unavailable', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}
