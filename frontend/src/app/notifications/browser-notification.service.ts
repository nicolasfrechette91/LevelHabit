import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { NotificationResponse } from './notification-api.service';

type BrowserPermissionStatus = 'unsupported' | NotificationPermission;

const BROWSER_NOTIFICATIONS_ENABLED_KEY =
  'levelhabit.browserNotifications.enabled.v1';

@Injectable({
  providedIn: 'root'
})
export class BrowserNotificationService {
  private readonly router = inject(Router);
  private readonly permissionStatusSignal =
    signal<BrowserPermissionStatus>(this.readPermissionStatus());
  private readonly enabledPreferenceSignal = signal(this.readEnabledPreference());
  private readonly shownNotificationIds = new Set<string>();

  readonly permissionStatus = this.permissionStatusSignal.asReadonly();
  readonly browserNotificationsEnabled = computed(
    () =>
      this.permissionStatusSignal() === 'granted'
      && this.enabledPreferenceSignal()
  );
  readonly canEnableBrowserNotifications = computed(
    () =>
      this.permissionStatusSignal() !== 'unsupported'
      && this.permissionStatusSignal() !== 'denied'
      && !this.browserNotificationsEnabled()
  );
  readonly canRequestPermission = computed(
    () => this.permissionStatusSignal() === 'default'
  );

  enableBrowserNotifications(): void {
    const status = this.readPermissionStatus();
    this.permissionStatusSignal.set(status);

    if (status === 'granted') {
      this.setEnabledPreference(true);
      return;
    }

    if (status === 'unsupported' || status === 'denied') {
      this.setEnabledPreference(false);
      return;
    }

    const notificationConstructor = this.notificationConstructor();

    if (!notificationConstructor) {
      this.permissionStatusSignal.set('unsupported');
      this.setEnabledPreference(false);
      return;
    }

    void notificationConstructor.requestPermission().then((permission) => {
      this.permissionStatusSignal.set(permission);
      this.setEnabledPreference(permission === 'granted');
    });
  }

  showReminderNotification(notification: NotificationResponse): void {
    if (
      !this.browserNotificationsEnabled()
      || notification.type !== 'QuestReminder'
      || notification.isRead
      || this.shownNotificationIds.has(notification.id)
    ) {
      return;
    }

    const notificationConstructor = this.notificationConstructor();

    if (!notificationConstructor) {
      this.permissionStatusSignal.set('unsupported');
      return;
    }

    this.shownNotificationIds.add(notification.id);

    const browserNotification = new notificationConstructor(notification.title, {
      body: notification.message,
      tag: notification.id
    });

    browserNotification.onclick = () => {
      window.focus();

      if (notification.referenceUrl) {
        void this.router.navigateByUrl(notification.referenceUrl);
      }

      browserNotification.close();
    };
  }

  clearSessionShownNotifications(): void {
    this.shownNotificationIds.clear();
  }

  rememberNotificationShown(id: string): void {
    this.shownNotificationIds.add(id);
  }

  permissionStatusLabel(): string {
    switch (this.permissionStatusSignal()) {
      case 'granted':
        return this.browserNotificationsEnabled() ? 'Enabled' : 'Allowed';
      case 'denied':
        return 'Denied';
      case 'default':
        return 'Not enabled';
      default:
        return 'Unsupported';
    }
  }

  private setEnabledPreference(enabled: boolean): void {
    this.enabledPreferenceSignal.set(enabled);

    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(BROWSER_NOTIFICATIONS_ENABLED_KEY, String(enabled));
  }

  private readEnabledPreference(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(BROWSER_NOTIFICATIONS_ENABLED_KEY) === 'true';
  }

  private readPermissionStatus(): BrowserPermissionStatus {
    const notificationConstructor = this.notificationConstructor();

    return notificationConstructor?.permission ?? 'unsupported';
  }

  private notificationConstructor(): typeof Notification | null {
    if (
      typeof window === 'undefined'
      || typeof window.Notification === 'undefined'
    ) {
      return null;
    }

    return window.Notification;
  }
}
