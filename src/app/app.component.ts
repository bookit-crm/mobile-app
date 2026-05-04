import { Component, effect, inject, untracked } from '@angular/core';
import { AppLifecycleService } from '@core/services/app-lifecycle.service';
import { PushNotificationService } from '@core/services/push-notification.service';
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

  constructor() {
    this.appLifecycle.init();

    effect(() => {
      const user = this.supervisorService.authUserSignal();
      if (!user) return;
      untracked(() => {
        this.websocketService.connectSocket();
        // Запрашиваем разрешение на нотификации и подписываемся на WS-события
        void this.pushNotificationService.init();
      });
    });
  }
}
