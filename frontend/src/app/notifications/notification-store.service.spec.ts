import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../auth/auth.models';
import { BrowserNotificationService } from './browser-notification.service';
import {
  NotificationApiService,
  type NotificationListOptions,
  type NotificationListResponse,
  type NotificationResponse,
  type NotificationUnreadCountResponse
} from './notification-api.service';
import { NotificationStoreService } from './notification-store.service';

const USER: AuthUser = {
  id: 'f972df99-805d-48a3-93e6-e5c469ba8be6',
  email: 'player@example.com',
  displayName: 'Player One',
  createdAtUtc: '2026-06-17T20:00:00Z'
};

const NOTIFICATION: NotificationResponse = {
  id: '7f6ec74d-7581-4a3c-93d4-9aa7f4f6e945',
  userId: USER.id,
  habitId: 'f3d9d772-8e0d-47f7-970b-56f757f85f4d',
  type: 'HabitReminder',
  title: 'Habit reminder',
  message: 'Morning training is ready.',
  isRead: false,
  createdAtUtc: '2026-06-18T12:00:00Z',
  readAtUtc: null,
  referenceUrl: '/habits'
};

describe('NotificationStoreService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads latest notifications and unread count', () => {
    const { api, store } = setup();

    store.openPanel();

    expect(api.unreadCount).toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      unreadOnly: false
    });
    expect(store.notifications()).toEqual([NOTIFICATION]);
    expect(store.unreadCount()).toBe(1);
  });

  it('updates state when marking one notification as read', () => {
    const { store } = setup();

    store.openPanel();
    store.markRead(NOTIFICATION);

    expect(store.notifications()[0]?.isRead).toBe(true);
    expect(store.unreadCount()).toBe(0);
  });

  it('updates state when marking all notifications as read', () => {
    const { store } = setup();

    store.openPanel();
    store.markAllRead();

    expect(store.notifications().every((notification) => notification.isRead)).toBe(true);
    expect(store.unreadCount()).toBe(0);
  });

  it('updates state when deleting a notification', () => {
    const { store } = setup();

    store.openPanel();
    store.delete(NOTIFICATION);

    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });

  it('clears notification state after logout changes the active user', () => {
    const { authUser, store } = setup();

    store.openPanel();
    expect(store.notifications()).toEqual([NOTIFICATION]);

    authUser.set(null);
    TestBed.flushEffects();

    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.panelOpen()).toBe(false);
  });
});

class NotificationApiServiceStub
  implements Pick<
    NotificationApiService,
    'delete' | 'list' | 'markAllRead' | 'markRead' | 'unreadCount'
  >
{
  readonly list = vi.fn((
    options: NotificationListOptions = {}
  ): Observable<NotificationListResponse> =>
    of({
      items: options.unreadOnly ? [NOTIFICATION] : [NOTIFICATION],
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 20,
      totalCount: 1,
      unreadOnly: options.unreadOnly ?? false
    })
  );

  readonly unreadCount = vi.fn((): Observable<NotificationUnreadCountResponse> =>
    of({ count: 1 })
  );

  readonly markRead = vi.fn((_id: string): Observable<NotificationResponse> =>
    of({
      ...NOTIFICATION,
      isRead: true,
      readAtUtc: '2026-06-18T12:05:00Z'
    })
  );

  readonly markAllRead = vi.fn((): Observable<void> => of(void 0));

  readonly delete = vi.fn((_id: string): Observable<void> => of(void 0));
}

function setup(): {
  api: NotificationApiServiceStub;
  authUser: ReturnType<typeof signal<AuthUser | null>>;
  store: NotificationStoreService;
} {
  const authUser = signal<AuthUser | null>(USER);
  const api = new NotificationApiServiceStub();

  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthService,
        useValue: {
          user: authUser.asReadonly()
        }
      },
      {
        provide: NotificationApiService,
        useValue: api
      },
      {
        provide: BrowserNotificationService,
        useValue: {
          clearSessionShownNotifications: vi.fn(),
          rememberNotificationShown: vi.fn(),
          showReminderNotification: vi.fn()
        }
      }
    ]
  });

  const store = TestBed.inject(NotificationStoreService);
  TestBed.flushEffects();

  return {
    api,
    authUser,
    store
  };
}
