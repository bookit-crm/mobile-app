import {
  Component,
  effect,
  inject,
  OnDestroy,
  OnInit,
  untracked,
} from '@angular/core';
import { take } from 'rxjs';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { NotificationsService } from '@core/services/notifications.service';
import { WebsocketService } from '@core/services/websocket.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
})
export class MainPage implements OnInit, OnDestroy {
  private readonly supervisorService = inject(SupervisorService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly websocketService = inject(WebsocketService);

  constructor() {
    // Bridge WebSocket notifications → NotificationsService
    effect(
      () => {
        const notification = this.websocketService.newNotificationSignal();
        if (notification) {
          untracked(() => {
            this.notificationsService.handleRealtimeNotification(notification);
          });
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    this.supervisorService.getSelf().pipe(take(1)).subscribe();
    this.subscriptionService.loadSubscription().pipe(take(1)).subscribe();

    // Initial unread count for the side-menu badge
    this.notificationsService.fetchUnreadCount();
    // Preferences let the realtime handler filter disabled categories immediately
    this.notificationsService.loadPreferences();

    this.websocketService.connectSocket();
  }

  ngOnDestroy(): void {
    this.websocketService.disconnectSocket();
  }
}
