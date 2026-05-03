import { Component, effect, inject, untracked } from '@angular/core';
import { AppLifecycleService } from '@core/services/app-lifecycle.service';
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

  constructor() {
    // Инициализируем слушатель Capacitor App lifecycle (один раз).
    this.appLifecycle.init();

    // При логине / повторной авторизации без перезагрузки приложения
    // (commit authUserSignal) — переподключаем WebSocket с актуальным JWT.
    effect(() => {
      const user = this.supervisorService.authUserSignal();
      if (!user) return;
      untracked(() => this.websocketService.connectSocket());
    });
  }
}
