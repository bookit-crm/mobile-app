import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Params } from '@angular/router';
import {
  ENotificationCategory,
  ENotificationFilter,
} from '@core/enums/e-notification';
import { HttpHelper } from '@core/helpers/http-helper';
import { INotification } from '@core/models/notification.interface';
import { APPOINTMENT_NOTIFICATION_CATEGORIES } from '@core/models/subscription.interface';
import { SubscriptionService } from '@core/services/subscription.service';
import { PaginatedResponseModel } from '@core/models/paginated-response.model';

export type PaginatedNotifications = PaginatedResponseModel<INotification>;

@Injectable({ providedIn: 'root' })
export class NotificationsService extends HttpHelper {
  private subscriptionService = inject(SubscriptionService);

  public notificationsSignal: WritableSignal<PaginatedNotifications | null> =
    signal(null);

  public unreadCountSignal: WritableSignal<number> = signal(0);

  public categoryUnreadCountsSignal: WritableSignal<Record<string, number>> =
    signal({});

  public preferencesSignal: WritableSignal<Record<string, boolean> | null> =
    signal(null);

  public loadNotifications(
    category: ENotificationCategory = ENotificationCategory.All,
    filter: ENotificationFilter = ENotificationFilter.All,
    search = '',
  ): void {
    const params: Params = { limit: '50', offset: '0' };

    if (category !== ENotificationCategory.All) {
      params['category'] = category;
    }

    if (filter === ENotificationFilter.Unread) {
      params['isRead'] = 'false';
    } else if (filter === ENotificationFilter.System) {
      params['category'] = ENotificationCategory.SystemSecurity;
    }

    this.httpGetRequest<PaginatedNotifications>(
      'api/notification/',
      params,
    ).subscribe({
      next: (res) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          const filtered = res.results.filter(
            (n) =>
              n.title.toLowerCase().includes(q) ||
              n.message.toLowerCase().includes(q),
          );
          res = { ...res, results: filtered, count: filtered.length };
        }
        this.notificationsSignal.set(res);
      },
      error: () => {
        this.notificationsSignal.set({ count: 0, results: [] });
      },
    });
  }

  public fetchUnreadCount(): void {
    this.httpGetRequest<{ count: number }>(
      'api/notification/unread-count/',
    ).subscribe({
      next: (res) => this.unreadCountSignal.set(res.count),
      error: () => this.unreadCountSignal.set(0),
    });
  }

  public fetchCategoryUnreadCounts(): void {
    this.httpGetRequest<Record<string, number>>(
      'api/notification/unread-counts-by-category/',
    ).subscribe({
      next: (res) => this.categoryUnreadCountsSignal.set(res),
      error: () => this.categoryUnreadCountsSignal.set({}),
    });
  }

  public markAsRead(notification: INotification): void {
    const { _id, category } = notification;

    this.unreadCountSignal.update((c) => Math.max(0, c - 1));
    if (category) {
      this.categoryUnreadCountsSignal.update((counts) => ({
        ...counts,
        [category]: Math.max(0, (counts[category] || 0) - 1),
      }));
    }

    const current = this.notificationsSignal();
    if (current) {
      const updated = current.results.map((n) =>
        n._id === _id ? { ...n, isRead: true } : n,
      );
      this.notificationsSignal.set({ ...current, results: updated });
    }

    this.httpPatchRequest<{ modified: number }>('api/notification/read/', {
      ids: [_id],
    }).subscribe({
      next: () => {
        this.fetchUnreadCount();
        this.fetchCategoryUnreadCounts();
      },
      error: () => {
        this.fetchUnreadCount();
        this.fetchCategoryUnreadCounts();
      },
    });
  }

  public markAllAsRead(): void {
    const current = this.notificationsSignal();
    if (current) {
      const updated = current.results.map((n) => ({ ...n, isRead: true }));
      this.notificationsSignal.set({ ...current, results: updated });
    }
    this.unreadCountSignal.set(0);
    this.categoryUnreadCountsSignal.set({});

    this.httpPatchRequest<{ modified: number }>(
      'api/notification/read-all/',
      {},
    ).subscribe({
      next: () => {
        this.fetchUnreadCount();
        this.fetchCategoryUnreadCounts();
      },
      error: () => {
        this.fetchUnreadCount();
        this.fetchCategoryUnreadCounts();
      },
    });
  }

  public loadPreferences(): void {
    this.httpGetRequest<{ categories: Record<string, boolean> }>(
      'api/notification/preferences/',
    ).subscribe({
      next: (res) => this.preferencesSignal.set(res.categories),
      error: () => this.preferencesSignal.set(null),
    });
  }

  public updatePreference(category: string, enabled: boolean): void {
    this.preferencesSignal.update((prefs) => ({
      ...(prefs ?? {}),
      [category]: enabled,
    }));

    this.httpPatchRequest<{ categories: Record<string, boolean> }>(
      'api/notification/preferences/',
      {
        categories: { [category]: enabled },
      },
    ).subscribe({
      error: () => this.loadPreferences(),
    });
  }

  /** Real-time WebSocket handler — pushes a notification into the local state. */
  public handleRealtimeNotification(notification: INotification): void {
    // Defense-in-depth: на Individual (`appointments-only`) не показываем
    // не-appointment категории, даже если бэк по какой-то причине их прислал.
    if (
      this.subscriptionService.isNotificationsAppointmentsOnly() &&
      notification.category &&
      !APPOINTMENT_NOTIFICATION_CATEGORIES.includes(notification.category)
    ) {
      return;
    }

    const prefs = this.preferencesSignal();
    if (notification.category && prefs?.[notification.category] === false) {
      return;
    }

    this.unreadCountSignal.update((c) => c + 1);

    if (notification.category) {
      this.categoryUnreadCountsSignal.update((counts) => ({
        ...counts,
        [notification.category]: (counts[notification.category] || 0) + 1,
      }));
    }

    const current = this.notificationsSignal();
    if (current) {
      this.notificationsSignal.set({
        ...current,
        count: current.count + 1,
        results: [notification, ...current.results],
      });
    }
  }
}
