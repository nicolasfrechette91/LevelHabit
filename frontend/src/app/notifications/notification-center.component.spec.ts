import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationResponse } from './notification-api.service';
import { NotificationCenterComponent } from './notification-center.component';
import { NotificationStoreService } from './notification-store.service';

const UNREAD_NOTIFICATION: NotificationResponse = {
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

const READ_NOTIFICATION: NotificationResponse = {
  ...UNREAD_NOTIFICATION,
  id: '7e784b9d-2104-4f1e-bdf7-7bba46c4609f',
  isRead: true,
  readAtUtc: '2026-06-18T12:05:00Z',
  referenceUrl: null
};

describe('NotificationCenterComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the unread badge when unread notifications exist', () => {
    const { element } = setup([UNREAD_NOTIFICATION], 1);

    expect(element.querySelector('[data-testid="notification-badge"]')?.textContent).toContain('1');
  });

  it('hides the unread badge when the unread count is zero', () => {
    const { element: emptyElement } = setup([], 0);

    expect(emptyElement.querySelector('[data-testid="notification-badge"]')).toBeNull();
  });

  it('opens and closes the notification panel', () => {
    const { element, fixture, store } = setup([UNREAD_NOTIFICATION], 1);

    click(element, '[data-testid="notification-bell"]');
    fixture.detectChanges();

    expect(store.togglePanel).toHaveBeenCalled();
    expect(element.querySelector('[data-testid="notification-panel"]')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="notification-panel"]')).toBeNull();
  });

  it('marks one notification as read', () => {
    const { element, fixture, store } = setup([UNREAD_NOTIFICATION], 1, true);

    click(element, '[data-testid="mark-read-button"]');
    fixture.detectChanges();

    expect(store.markRead).toHaveBeenCalledWith(UNREAD_NOTIFICATION);
  });

  it('marks all notifications as read', () => {
    const { element, fixture, store } = setup([UNREAD_NOTIFICATION], 1, true);

    click(element, '[data-testid="mark-all-read-button"]');
    fixture.detectChanges();

    expect(store.markAllRead).toHaveBeenCalled();
  });

  it('deletes a notification', () => {
    const { element, fixture, store } = setup([READ_NOTIFICATION], 0, true);

    click(element, '[data-testid="delete-notification-button"]');
    fixture.detectChanges();

    expect(store.delete).toHaveBeenCalledWith(READ_NOTIFICATION);
  });

  it('shows an empty notification state', () => {
    const { element } = setup([], 0, true);

    expect(element.querySelector('[data-testid="notification-empty-state"]')?.textContent).toContain(
      'No notifications yet.'
    );
  });
});

type NotificationStoreStub = Pick<
  NotificationStoreService,
  | 'closePanel'
  | 'delete'
  | 'error'
  | 'loadUnreadCount'
  | 'loading'
  | 'markAllRead'
  | 'markRead'
  | 'notifications'
  | 'panelOpen'
  | 'refreshBrowserNotifications'
  | 'startAutoRefresh'
  | 'stopAutoRefresh'
  | 'togglePanel'
  | 'unreadCount'
>;

function setup(
  notifications: NotificationResponse[],
  unreadCount: number,
  panelStartsOpen = false
): {
  element: HTMLElement;
  fixture: ComponentFixture<NotificationCenterComponent>;
  store: NotificationStoreStub;
} {
  const notificationsSignal = signal(notifications);
  const unreadCountSignal = signal(unreadCount);
  const loadingSignal = signal(false);
  const errorSignal = signal<string | null>(null);
  const panelOpenSignal = signal(panelStartsOpen);
  const store: NotificationStoreStub = {
    notifications: notificationsSignal.asReadonly(),
    unreadCount: unreadCountSignal.asReadonly(),
    loading: loadingSignal.asReadonly(),
    error: errorSignal.asReadonly(),
    panelOpen: panelOpenSignal.asReadonly(),
    togglePanel: vi.fn(() => panelOpenSignal.update((isOpen) => !isOpen)),
    closePanel: vi.fn(() => panelOpenSignal.set(false)),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
    loadUnreadCount: vi.fn(),
    refreshBrowserNotifications: vi.fn(),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn()
  };

  TestBed.configureTestingModule({
    imports: [NotificationCenterComponent],
    providers: [
      provideRouter([]),
      {
        provide: NotificationStoreService,
        useValue: store
      }
    ]
  });

  const fixture = TestBed.createComponent(NotificationCenterComponent);
  fixture.detectChanges();

  return {
    element: fixture.nativeElement as HTMLElement,
    fixture,
    store
  };
}

function click(container: ParentNode, selector: string): void {
  const element = container.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Element not found: ${selector}`);
  }

  element.click();
}
