import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type NotificationType = 'HabitReminder' | 'System';

export type NotificationResponse = Readonly<{
  id: string;
  userId: string;
  habitId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAtUtc: string;
  readAtUtc: string | null;
  referenceUrl: string | null;
}>;

export type NotificationListResponse = Readonly<{
  items: NotificationResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
  unreadOnly: boolean;
}>;

export type NotificationUnreadCountResponse = Readonly<{
  count: number;
}>;

export type NotificationListOptions = Readonly<{
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}>;

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly notificationsUrl = `${environment.apiUrl}/notifications`;

  list(options: NotificationListOptions = {}): Observable<NotificationListResponse> {
    return this.http.get<NotificationListResponse>(this.notificationsUrl, {
      params: {
        page: options.page ?? 1,
        pageSize: options.pageSize ?? 20,
        unreadOnly: options.unreadOnly ?? false
      }
    });
  }

  unreadCount(): Observable<NotificationUnreadCountResponse> {
    return this.http.get<NotificationUnreadCountResponse>(
      `${this.notificationsUrl}/unread-count`
    );
  }

  markRead(id: string): Observable<NotificationResponse> {
    return this.http.put<NotificationResponse>(
      `${this.notificationsUrl}/${id}/read`,
      null
    );
  }

  markAllRead(): Observable<void> {
    return this.http.put<void>(`${this.notificationsUrl}/read-all`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.notificationsUrl}/${id}`);
  }
}
