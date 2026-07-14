import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { Router } from '@angular/router';

import type { NotificationResponse } from './notification-api.service';
import { NotificationStoreService } from './notification-store.service';

@Component({
  selector: 'app-notification-center',
  imports: [DatePipe],
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.scss']
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  protected readonly notifications = inject(NotificationStoreService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.notifications.loadUnreadCount();
    this.notifications.refreshBrowserNotifications();
    this.notifications.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.notifications.stopAutoRefresh();
  }

  protected togglePanel(): void {
    this.notifications.togglePanel();
  }

  protected closePanel(): void {
    this.notifications.closePanel();
  }

  protected openNotification(notification: NotificationResponse): void {
    if (!notification.isRead) {
      this.notifications.markRead(notification);
    }

    if (notification.referenceUrl) {
      void this.router.navigateByUrl(notification.referenceUrl);
      this.closePanel();
    }
  }

  protected markRead(
    event: Event,
    notification: NotificationResponse
  ): void {
    event.stopPropagation();
    this.notifications.markRead(notification);
  }

  protected delete(
    event: Event,
    notification: NotificationResponse
  ): void {
    event.stopPropagation();
    this.notifications.delete(notification);
  }

  protected markAllRead(): void {
    this.notifications.markAllRead();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.notifications.panelOpen()
      && event.target instanceof Node
      && !this.elementRef.nativeElement.contains(event.target)
    ) {
      this.closePanel();
    }
  }
}
