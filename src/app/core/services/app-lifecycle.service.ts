import { inject, Injectable } from '@angular/core';
import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
import { WebsocketService } from './websocket.service';

/**
 * Слушает события жизненного цикла приложения (Capacitor):
 *  - appStateChange  → при возврате в foreground пере-подключаем WebSocket
 *    (iOS/Android часто рвут сокет в фоне через ~30 сек).
 *
 * Должен быть инициализирован один раз в `AppComponent`.
 */
@Injectable({ providedIn: 'root' })
export class AppLifecycleService {
  private readonly websocketService = inject(WebsocketService);
  private initialized = false;

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    void App.addListener('appStateChange', (state: AppState) => {
      if (state.isActive) {
        this.handleResume();
      }
    });

    if (!Capacitor.isNativePlatform()) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.handleResume();
        }
      });
    }
  }

  private handleResume(): void {
    const token = localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN);
    if (!token) return;
    this.websocketService.reconnectIfNeeded();
  }
}
