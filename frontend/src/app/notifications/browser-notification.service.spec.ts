import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationResponse } from './notification-api.service';
import { BrowserNotificationService } from './browser-notification.service';

const REMINDER_NOTIFICATION: NotificationResponse = {
  id: '7f6ec74d-7581-4a3c-93d4-9aa7f4f6e945',
  userId: 'f972df99-805d-48a3-93e6-e5c469ba8be6',
  questId: 'f3d9d772-8e0d-47f7-970b-56f757f85f4d',
  type: 'QuestReminder',
  title: 'Quest reminder',
  message: 'Morning training is ready.',
  isRead: false,
  createdAtUtc: '2026-06-18T12:00:00Z',
  readAtUtc: null,
  referenceUrl: '/quests?questId=f3d9d772-8e0d-47f7-970b-56f757f85f4d'
};

describe('BrowserNotificationService', () => {
  let originalNotification: typeof Notification | undefined;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    originalNotification = window.Notification;
  });

  afterEach(() => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: originalNotification
    });
  });

  it('reports unsupported browsers', () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: undefined
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });

    const service = TestBed.inject(BrowserNotificationService);

    expect(service.permissionStatus()).toBe('unsupported');
    expect(service.canEnableBrowserNotifications()).toBe(false);
  });

  it('does not request permission when permission is denied', () => {
    const fakeNotification = createFakeNotification('denied');
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: fakeNotification
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });

    const service = TestBed.inject(BrowserNotificationService);
    service.enableBrowserNotifications();

    expect(fakeNotification.requestPermission).not.toHaveBeenCalled();
    expect(service.permissionStatus()).toBe('denied');
  });

  it('requests permission from an explicit enable action', async () => {
    const fakeNotification = createFakeNotification('default', 'granted');
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: fakeNotification
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });

    const service = TestBed.inject(BrowserNotificationService);
    service.enableBrowserNotifications();
    await Promise.resolve();

    expect(fakeNotification.requestPermission).toHaveBeenCalled();
    expect(service.permissionStatus()).toBe('granted');
    expect(service.browserNotificationsEnabled()).toBe(true);
  });

  it('shows each reminder notification once per browser session and navigates on click', async () => {
    const fakeNotification = createFakeNotification('granted');
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: fakeNotification
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const service = TestBed.inject(BrowserNotificationService);

    service.enableBrowserNotifications();
    service.showReminderNotification(REMINDER_NOTIFICATION);
    service.showReminderNotification(REMINDER_NOTIFICATION);

    expect(fakeNotification.instances).toHaveLength(1);

    fakeNotification.instances[0]?.onclick?.(new Event('click'));
    await Promise.resolve();

    expect(router.navigateByUrl).toHaveBeenCalledWith(REMINDER_NOTIFICATION.referenceUrl);
  });
});

function createFakeNotification(
  initialPermission: NotificationPermission,
  requestedPermission: NotificationPermission = initialPermission
): typeof Notification & {
  instances: Notification[];
  requestPermission: ReturnType<typeof vi.fn>;
} {
  const instances: Notification[] = [];
  const requestPermission = vi.fn(async () => {
    FakeNotification.permission = requestedPermission;

    return requestedPermission;
  });

  class FakeNotification {
    static permission: NotificationPermission = initialPermission;
    static requestPermission = requestPermission;

    onclick: ((event: Event) => void) | null = null;

    constructor(
      public readonly title: string,
      public readonly options?: NotificationOptions
    ) {
      instances.push(this as unknown as Notification);
    }

    close(): void {
      return undefined;
    }
  }

  return Object.assign(FakeNotification, {
    instances,
    requestPermission
  }) as unknown as typeof Notification & {
    instances: Notification[];
    requestPermission: ReturnType<typeof vi.fn>;
  };
}
