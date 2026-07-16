import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { Router } from '@angular/router';
import { LocalDatePipe, TranslatePipe } from '../i18n/i18n.pipes';

import type { NotificationResponse } from './notification-api.service';
import { NotificationStoreService } from './notification-store.service';

@Component({
  selector: 'app-notification-center',
  imports: [LocalDatePipe, TranslatePipe],
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
    if (this.notifications.panelOpen()) {
      this.closePanel();
      return;
    }

    this.notifications.togglePanel();

    const dialog = this.dialogElement();

    if (dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[autofocus]')?.focus();
    }
  }

  protected closePanel(): void {
    this.notifications.closePanel();

    const dialog = this.dialogElement();

    if (dialog?.open) {
      dialog.close();
    }

    this.toggleElement()?.focus();
  }

  protected onDialogCancel(): void {
    this.notifications.closePanel();
  }

  protected onDialogClosed(): void {
    this.notifications.closePanel();
    this.toggleElement()?.focus();
  }

  protected onDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const dialog = this.dialogElement();

    if (!dialog) {
      return;
    }

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusableElements[0];
    const last = focusableElements.at(-1);

    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    if (
      (event.shiftKey && document.activeElement === first)
      || (!event.shiftKey && document.activeElement === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePanel();
    }
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

  private dialogElement(): HTMLDialogElement | null {
    return this.elementRef.nativeElement.querySelector('[data-testid="notification-panel"]');
  }

  private toggleElement(): HTMLButtonElement | null {
    return this.elementRef.nativeElement.querySelector('[data-testid="notification-bell"]');
  }
}
