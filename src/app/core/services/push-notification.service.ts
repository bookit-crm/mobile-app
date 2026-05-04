import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { filter, skip } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { WebsocketService } from './websocket.service';

let notifId = 1;

/**
 * Показывает нативный системный push на телефоне когда по WebSocket
 * приходит новая нотификация. Не требует Firebase — работает через
 * @capacitor/local-notifications (локальные уведомления ОС).
 *
 * Ограничение: уведомления показываются только пока приложение запущено
 * (foreground / background). Когда приложение полностью убито — WebSocket
 * не работает, поэтому push не придёт.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly websocketService = inject(WebsocketService);
  private readonly notificationsService = inject(NotificationsService);

  /** Observable из сигнала — создаём здесь, в injection context */
  private readonly newNotification$ = toObservable(
    this.websocketService.newNotificationSignal,
  ).pipe(
    skip(1),                      // игнорируем начальный null
    filter((n) => n !== null),
  );

  private permissionGranted = false;
  private listening = false;

  /**
   * Инициализировать: запросить разрешение и подписаться на WS-нотификации.
   * Вызывать один раз после логина.
   */
  public async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    await this.requestPermission();

    if (!this.listening) {
      this.listening = true;
      this.listenToNotifications();
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async requestPermission(): Promise<void> {
    try {
      let { display } = await LocalNotifications.checkPermissions();

      if (display === 'prompt' || display === 'prompt-with-rationale') {
        const result = await LocalNotifications.requestPermissions();
        display = result.display;
      }

      this.permissionGranted = display === 'granted';

      if (this.permissionGranted) {
        // Канал (Android 8+)
        await LocalNotifications.createChannel({
          id: 'bookit_notifications',
          name: 'Bookit',
          importance: 4, // HIGH
          sound: 'default',
          vibration: true,
        });

        // Тап по нотификации пока приложение свёрнуто → обновить счётчики
        await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          () => {
            this.notificationsService.fetchUnreadCount();
            this.notificationsService.fetchCategoryUnreadCounts();
          },
        );
      }
    } catch (err) {
      console.warn('[LocalPush] permission error:', err);
    }
  }

  private listenToNotifications(): void {
    this.newNotification$.subscribe(async (notification) => {
      if (!this.permissionGranted || !notification) return;
      try {
        await LocalNotifications.schedule({
          notifications: [
              {
                id: notifId++,
                channelId: 'bookit_notifications',
                title: notification.title ?? 'Bookit',
                body: notification.message ?? '',
                schedule: { at: new Date(Date.now() + 100) },
                extra: {
                  notificationId: notification._id,
                  category: notification.category ?? '',
                },
              },
          ],
        });
      } catch (err) {
        console.warn('[LocalPush] schedule error:', err);
      }
    });
  }
}

