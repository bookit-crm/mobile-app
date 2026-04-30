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
          label: 'All',
          icon: 'list-outline',
        },
        {
          key: ENotificationCategory.NewBookings,
          label: 'New bookings',
          icon: 'calendar-outline',
        },
        {
          key: ENotificationCategory.Cancellations,
          label: 'Cancellations',
          icon: 'close-circle-outline',
        },
        {
          key: ENotificationCategory.EmployeeUpdates,
          label: 'Employees',
          icon: 'people-outline',
        },
        {
          key: ENotificationCategory.ClientUpdates,
          label: 'Clients',
          icon: 'person-outline',
        },
        {
          key: ENotificationCategory.SystemSecurity,
          label: 'System',
          icon: 'lock-closed-outline',
        },
        {
          key: ENotificationCategory.ReviewsFeedback,
          label: 'Reviews',
          icon: 'star-outline',
        },
        {
          key: ENotificationCategory.StockAlerts,
          label: 'Stock',
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
      { key: ENotificationFilter.All, label: 'All' },
      { key: ENotificationFilter.Unread, label: 'Unread' },
      ...(appointmentsOnly
        ? []
        : [{ key: ENotificationFilter.System, label: 'System' }]),
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
        label: 'New bookings',
        description: 'Get notified when a new booking is created.',
        enabled: true,
      },
      {
        key: 'cancellations',
        label: 'Cancellations',
        description: 'Get notified when an appointment is cancelled.',
        enabled: true,
      },
      {
        key: 'client_updates',
        label: 'Client updates',
        description: 'Updates from your clients.',
        enabled: true,
      },
      {
        key: 'employee_updates',
        label: 'Employee updates',
        description: 'Schedule and profile changes.',
        enabled: true,
      },
      {
        key: 'system_security',
        label: 'System & security',
        description: 'Logins, payments and security alerts.',
        enabled: true,
      },
      {
        key: 'reviews_feedback',
        label: 'Reviews & feedback',
        description: 'New reviews from clients.',
        enabled: true,
      },
    ];

    if (this.subscriptionService.hasFeature('productsStockAlerts')) {
      all.push({
        key: 'stock_alerts',
        label: 'Stock alerts',
        description: 'Low-stock and out-of-stock alerts.',
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

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

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
