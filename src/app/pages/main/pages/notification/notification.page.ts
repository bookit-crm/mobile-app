import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  Signal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import {
  ENotificationCategory,
  ENotificationFilter,
} from '@core/enums/e-notification';
import {
  INotification,
  INotificationCategoryItem,
} from '@core/models/notification.interface';
import { NotificationsService } from '@core/services/notifications.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

interface INotificationSetting {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

type TTab = 'inbox' | 'settings';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPage implements OnInit {
  private readonly notificationsService = inject(NotificationsService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = inject(TranslateService);

  // ── Tab state ─────────────────────────────────────────────────────────────
  public activeTab = signal<TTab>('inbox');

  // ── Inbox state ───────────────────────────────────────────────────────────
  public readonly searchControl = new FormControl('');

  public readonly ENotificationCategory = ENotificationCategory;
  public readonly ENotificationFilter = ENotificationFilter;

  public activeCategory = signal<ENotificationCategory>(
    ENotificationCategory.All,
  );
  public activeFilter = signal<ENotificationFilter>(ENotificationFilter.All);

  public readonly notifications = this.notificationsService.notificationsSignal;
  public readonly unreadCount = this.notificationsService.unreadCountSignal;
  public readonly categoryUnreadCounts =
    this.notificationsService.categoryUnreadCountsSignal;

  /**
   * Реактивный список категорий — пересобирается при загрузке/смене подписки.
   * До прихода subscription показываем только All, чтобы не моргать списком и
   * не схлопывать его обратно после feature-gate.
   */
  public readonly categories: Signal<INotificationCategoryItem[]> = computed(
    () => {
      const all: INotificationCategoryItem[] = [
        {
          key: ENotificationCategory.All,
          label: this.t.instant('NOTIF_CAT_ALL'),
          icon: 'list-outline',
        },
        {
          key: ENotificationCategory.NewBookings,
          label: this.t.instant('NOTIF_CAT_NEW_BOOKINGS'),
          icon: 'calendar-outline',
        },
        {
          key: ENotificationCategory.Cancellations,
          label: this.t.instant('NOTIF_CAT_CANCELLATIONS'),
          icon: 'close-circle-outline',
        },
        {
          key: ENotificationCategory.EmployeeUpdates,
          label: this.t.instant('NOTIF_CAT_EMPLOYEES'),
          icon: 'people-outline',
        },
        {
          key: ENotificationCategory.ClientUpdates,
          label: this.t.instant('NOTIF_CAT_CLIENTS'),
          icon: 'person-outline',
        },
        {
          key: ENotificationCategory.SystemSecurity,
          label: this.t.instant('NOTIF_CAT_SYSTEM'),
          icon: 'lock-closed-outline',
        },
        {
          key: ENotificationCategory.ReviewsFeedback,
          label: this.t.instant('NOTIF_CAT_REVIEWS'),
          icon: 'star-outline',
        },
        {
          key: ENotificationCategory.StockAlerts,
          label: this.t.instant('NOTIF_CAT_STOCK'),
          icon: 'cube-outline',
        },
      ];

      if (!this.subscriptionService.features()) {
        return all.filter((c) => c.key === ENotificationCategory.All);
      }

      const appointmentsOnly =
        this.subscriptionService.isNotificationsAppointmentsOnly();
      const hasStockAlerts = this.subscriptionService.hasFeature(
        'productsStockAlerts',
      );

      return all
        .filter(
          (c) => c.key !== ENotificationCategory.StockAlerts || hasStockAlerts,
        )
        .filter(
          (c) =>
            !appointmentsOnly ||
            c.key === ENotificationCategory.All ||
            c.key === ENotificationCategory.NewBookings ||
            c.key === ENotificationCategory.Cancellations,
        );
    },
  );

  public readonly filters = computed(() => {
    const appointmentsOnly =
      this.subscriptionService.isNotificationsAppointmentsOnly();
    return [
      { key: ENotificationFilter.All, label: this.t.instant('NOTIF_FILTER_ALL') },
      { key: ENotificationFilter.Unread, label: this.t.instant('NOTIF_FILTER_UNREAD') },
      ...(appointmentsOnly
        ? []
        : [{ key: ENotificationFilter.System, label: this.t.instant('NOTIF_FILTER_SYSTEM') }]),
    ];
  });

  // ── Settings state ────────────────────────────────────────────────────────
  /**
   * Реактивный список настроек — пересчитывается при загрузке/смене подписки
   * и при загрузке user preferences. До прихода subscription возвращаем
   * пустой список, чтобы юзер не успел изменить настройки, недоступные на его
   * плане.
   */
  public readonly settings: Signal<INotificationSetting[]> = computed(() => {
    const all: INotificationSetting[] = [
      {
        key: 'new_bookings',
        label: this.t.instant('NOTIF_SET_NEW_BOOKINGS_LABEL'),
        description: this.t.instant('NOTIF_SET_NEW_BOOKINGS_DESC'),
        enabled: true,
      },
      {
        key: 'cancellations',
        label: this.t.instant('NOTIF_SET_CANCELLATIONS_LABEL'),
        description: this.t.instant('NOTIF_SET_CANCELLATIONS_DESC'),
        enabled: true,
      },
      {
        key: 'client_updates',
        label: this.t.instant('NOTIF_SET_CLIENT_UPDATES_LABEL'),
        description: this.t.instant('NOTIF_SET_CLIENT_UPDATES_DESC'),
        enabled: true,
      },
      {
        key: 'employee_updates',
        label: this.t.instant('NOTIF_SET_EMPLOYEE_UPDATES_LABEL'),
        description: this.t.instant('NOTIF_SET_EMPLOYEE_UPDATES_DESC'),
        enabled: true,
      },
      {
        key: 'system_security',
        label: this.t.instant('NOTIF_SET_SYSTEM_SECURITY_LABEL'),
        description: this.t.instant('NOTIF_SET_SYSTEM_SECURITY_DESC'),
        enabled: true,
      },
      {
        key: 'reviews_feedback',
        label: this.t.instant('NOTIF_SET_REVIEWS_LABEL'),
        description: this.t.instant('NOTIF_SET_REVIEWS_DESC'),
        enabled: true,
      },
    ];

    if (this.subscriptionService.hasFeature('productsStockAlerts')) {
      all.push({
        key: 'stock_alerts',
        label: this.t.instant('NOTIF_SET_STOCK_LABEL'),
        description: this.t.instant('NOTIF_SET_STOCK_DESC'),
        enabled: true,
      });
    }

    if (!this.subscriptionService.features()) {
      return [];
    }

    const filtered = this.subscriptionService.isNotificationsAppointmentsOnly()
      ? all.filter(
          (s) => s.key === 'new_bookings' || s.key === 'cancellations',
        )
      : all;

    const prefs = this.notificationsService.preferencesSignal();
    if (!prefs) {
      return filtered;
    }
    return filtered.map((s) => ({
      ...s,
      enabled: prefs[s.key] !== undefined ? prefs[s.key] : s.enabled,
    }));
  });

  ngOnInit(): void {
    this.notificationsService.fetchUnreadCount();
    this.notificationsService.fetchCategoryUnreadCounts();
    this.notificationsService.loadPreferences();
    this.loadData();

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadData());
  }

  // ── Tab handlers ──────────────────────────────────────────────────────────
  public onTabChange(value: string | undefined): void {
    this.activeTab.set((value as TTab) ?? 'inbox');
  }

  // ── Inbox handlers ────────────────────────────────────────────────────────
  public selectCategory(category: ENotificationCategory): void {
    this.activeCategory.set(category);
    this.loadData();
  }

  public selectFilter(filter: ENotificationFilter): void {
    this.activeFilter.set(filter);
    this.loadData();
  }

  public markAsRead(notification: INotification): void {
    if (!notification.isRead) {
      this.notificationsService.markAsRead(notification);
    }
  }

  public markAllAsRead(): void {
    this.notificationsService.markAllAsRead();
  }

  // ── Settings handlers ─────────────────────────────────────────────────────
  public toggleSetting(setting: INotificationSetting, enabled: boolean): void {
    if (setting.enabled === enabled) return;
    this.notificationsService.updatePreference(setting.key, enabled);
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  public getCategoryIcon(category: ENotificationCategory): string {
    const icons: Record<string, string> = {
      [ENotificationCategory.NewBookings]: 'calendar-outline',
      [ENotificationCategory.Cancellations]: 'close-circle-outline',
      [ENotificationCategory.EmployeeUpdates]: 'people-outline',
      [ENotificationCategory.ClientUpdates]: 'person-outline',
      [ENotificationCategory.SystemSecurity]: 'lock-closed-outline',
      [ENotificationCategory.ReviewsFeedback]: 'star-outline',
      [ENotificationCategory.StockAlerts]: 'cube-outline',
    };
    return icons[category] || 'notifications-outline';
  }

  public getCategoryColor(category: ENotificationCategory): string {
    const colors: Record<string, string> = {
      [ENotificationCategory.NewBookings]: 'warning',
      [ENotificationCategory.Cancellations]: 'danger',
      [ENotificationCategory.EmployeeUpdates]: 'primary',
      [ENotificationCategory.ClientUpdates]: 'tertiary',
      [ENotificationCategory.SystemSecurity]: 'medium',
      [ENotificationCategory.ReviewsFeedback]: 'warning',
      [ENotificationCategory.StockAlerts]: 'warning',
    };
    return colors[category] || 'primary';
  }

  public getTimeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return this.t.instant('NOTIF_TIME_JUST_NOW');
    if (diffMin < 60) return this.t.instant('NOTIF_TIME_MIN_AGO', { count: diffMin });
    if (diffHours < 24) return this.t.instant('NOTIF_TIME_H_AGO', { count: diffHours });
    if (diffDays === 1) return this.t.instant('NOTIF_TIME_YESTERDAY');
    if (diffDays < 7) return this.t.instant('NOTIF_TIME_DAYS_AGO', { count: diffDays });

    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  private loadData(): void {
    this.notificationsService.loadNotifications(
      this.activeCategory(),
      this.activeFilter(),
      this.searchControl.value || '',
    );
    this.cdr.markForCheck();
  }
}
