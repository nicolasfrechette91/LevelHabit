import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { BrowserNotificationService } from './browser-notification.service';
import {
  NotificationApiService,
  type NotificationResponse
} from './notification-api.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationStoreService {
  private readonly api = inject(NotificationApiService);
  private readonly auth = inject(AuthService);
  private readonly browserNotifications = inject(BrowserNotificationService);
  private readonly notificationsSignal = signal<NotificationResponse[]>([]);
  private readonly unreadCountSignal = signal(0);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly panelOpenSignal = signal(false);
  private readonly browserDetectionSeededSignal = signal(false);
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private activeUserId: string | null = null;

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly panelOpen = this.panelOpenSignal.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;

      if (userId === this.activeUserId) {
        return;
      }

      this.activeUserId = userId;
      this.clear();

      if (userId) {
        this.loadUnreadCount();
        this.refreshBrowserNotifications();
      }
    });
  }

  openPanel(): void {
    this.panelOpenSignal.set(true);
    this.loadUnreadCount();
    this.loadLatest();
  }

  closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  togglePanel(): void {
    if (this.panelOpenSignal()) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  loadUnreadCount(): void {
    const userId = this.activeUserId;

    if (!userId) {
      return;
    }

    this.api.unreadCount().subscribe({
      next: (response) => {
        if (this.isCurrentUser(userId)) {
          this.unreadCountSignal.set(response.count);
        }
      },
      error: () => undefined
    });
  }

  loadLatest(pageSize = 10): void {
    const userId = this.activeUserId;

    if (!userId) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.api
      .list({ page: 1, pageSize, unreadOnly: false })
      .pipe(finalize(() => {
        if (this.isCurrentUser(userId)) {
          this.loadingSignal.set(false);
        }
      }))
      .subscribe({
        next: (response) => {
          if (!this.isCurrentUser(userId)) {
            return;
          }

          this.notificationsSignal.set(response.items);
        },
        error: (error: unknown) => {
          if (this.isCurrentUser(userId)) {
            this.errorSignal.set(this.describeError(error));
          }
        }
      });
  }

  markRead(notification: NotificationResponse): void {
    const userId = this.activeUserId;

    if (!userId || notification.isRead) {
      return;
    }

    this.api.markRead(notification.id).subscribe({
      next: (updatedNotification) => {
        if (!this.isCurrentUser(userId)) {
          return;
        }

        this.notificationsSignal.update((notifications) =>
          notifications.map((candidate) =>
            candidate.id === updatedNotification.id ? updatedNotification : candidate
          )
        );
        this.unreadCountSignal.update((count) => Math.max(0, count - 1));
      },
      error: (error: unknown) => {
        if (this.isCurrentUser(userId)) {
          this.errorSignal.set(this.describeError(error));
        }
      }
    });
  }

  markAllRead(): void {
    const userId = this.activeUserId;

    if (!userId || this.unreadCountSignal() === 0) {
      return;
    }

    this.api.markAllRead().subscribe({
      next: () => {
        if (!this.isCurrentUser(userId)) {
          return;
        }

        const readAtUtc = new Date().toISOString();
        this.notificationsSignal.update((notifications) =>
          notifications.map((notification) => ({
            ...notification,
            isRead: true,
            readAtUtc: notification.readAtUtc ?? readAtUtc
          }))
        );
        this.unreadCountSignal.set(0);
      },
      error: (error: unknown) => {
        if (this.isCurrentUser(userId)) {
          this.errorSignal.set(this.describeError(error));
        }
      }
    });
  }

  delete(notification: NotificationResponse): void {
    const userId = this.activeUserId;

    if (!userId) {
      return;
    }

    this.api.delete(notification.id).subscribe({
      next: () => {
        if (!this.isCurrentUser(userId)) {
          return;
        }

        this.notificationsSignal.update((notifications) =>
          notifications.filter((candidate) => candidate.id !== notification.id)
        );

        if (!notification.isRead) {
          this.unreadCountSignal.update((count) => Math.max(0, count - 1));
        }
      },
      error: (error: unknown) => {
        if (this.isCurrentUser(userId)) {
          this.errorSignal.set(this.describeError(error));
        }
      }
    });
  }

  startAutoRefresh(): void {
    if (this.refreshIntervalId !== null || typeof window === 'undefined') {
      return;
    }

    this.refreshIntervalId = window.setInterval(() => {
      this.loadUnreadCount();
      this.refreshBrowserNotifications();
    }, 5 * 60 * 1000);
  }

  stopAutoRefresh(): void {
    if (this.refreshIntervalId === null || typeof window === 'undefined') {
      return;
    }

    window.clearInterval(this.refreshIntervalId);
    this.refreshIntervalId = null;
  }

  refreshBrowserNotifications(): void {
    const userId = this.activeUserId;

    if (!userId) {
      return;
    }

    this.api
      .list({ page: 1, pageSize: 10, unreadOnly: true })
      .subscribe({
        next: (response) => {
          if (!this.isCurrentUser(userId)) {
            return;
          }

          const reminderNotifications = response.items.filter(
            (notification) => notification.type === 'HabitReminder'
          );

          if (!this.browserDetectionSeededSignal()) {
            for (const notification of reminderNotifications) {
              this.browserNotifications.rememberNotificationShown(notification.id);
            }

            this.browserDetectionSeededSignal.set(true);
            return;
          }

          for (const notification of reminderNotifications) {
            this.browserNotifications.showReminderNotification(notification);
          }
        },
        error: () => undefined
      });
  }

  clear(): void {
    this.notificationsSignal.set([]);
    this.unreadCountSignal.set(0);
    this.loadingSignal.set(false);
    this.errorSignal.set(null);
    this.panelOpenSignal.set(false);
    this.browserDetectionSeededSignal.set(false);
    this.browserNotifications.clearSessionShownNotifications();
  }

  private isCurrentUser(userId: string): boolean {
    return this.activeUserId === userId;
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Notifications could not be loaded.';
    }

    if (error.status === 0) {
      return 'The backend is unavailable. Try again when the API is running.';
    }

    if (error.status === 401) {
      return 'Your session expired. Sign in again to view notifications.';
    }

    return 'Notifications could not be loaded.';
  }
}
