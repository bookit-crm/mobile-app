import { Component, effect, inject, untracked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AppLifecycleService } from '@core/services/app-lifecycle.service';
import { PushNotificationService } from '@core/services/push-notification.service';
import { SubscriptionWarningService } from '@core/services/subscription-warning.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { WebsocketService } from '@core/services/websocket.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  private readonly supervisorService = inject(SupervisorService);
  private readonly websocketService = inject(WebsocketService);
  private readonly appLifecycle = inject(AppLifecycleService);
  private readonly pushNotificationService = inject(PushNotificationService);
  private readonly translate = inject(TranslateService);
  // Eager-injected so the root-scoped service is constructed at app start —
  // its constructor wires up the auth-user effect + App.resume listener +
  // midnight timer that drive the subscription-expiry toast.
  private readonly subscriptionWarningService = inject(SubscriptionWarningService);

  constructor() {
    // Touch the eagerly-injected service to keep linter happy (DI side-effect intended).
    void this.subscriptionWarningService;
    const savedLang = localStorage.getItem('app_lang') ?? 'en';
    this.translate.setDefaultLang('en');
    this.translate.use(savedLang);

    this.appLifecycle.init();

    effect(() => {
      const user = this.supervisorService.authUserSignal();
      if (!user) return;
      untracked(() => {
        // Синхронизируем язык из профиля бэкенда
        const backendLang = user.lang;
        if (backendLang && backendLang !== this.translate.currentLang) {
          this.translate.use(backendLang);
          localStorage.setItem('app_lang', backendLang);
        }
        this.websocketService.connectSocket();
        // Запрашиваем разрешение на нотификации и подписываемся на WS-события
        void this.pushNotificationService.init();
      });
    });
  }
}
