import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  Signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonicModule, MenuController, ModalController } from '@ionic/angular';
import { EUserRole } from '@core/enums/e-user-role';
import { AuthService } from '@core/services/auth.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { SupportChatWebsocketService } from '@core/services/support-chat-websocket.service';
import { AccountSettingsModalComponent } from '@core/components/account-settings-modal/account-settings-modal.component';
import { NotificationsService } from '@core/services/notifications.service';
import { WebsocketService } from '@core/services/websocket.service';
import { ISideMenuItem } from './models/side-menu-item.interface';
import { ADMIN_MENU_CONFIG, MANAGER_MENU_CONFIG } from './constants/side-menu-config';
import { take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [IonicModule, RouterLink, RouterLinkActive, CommonModule, TranslateModule],
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenuComponent implements OnInit {
  private supervisorService    = inject(SupervisorService);
  private subscriptionService  = inject(SubscriptionService);
  private notificationsService = inject(NotificationsService);
  private websocketService     = inject(WebsocketService);
  private authService          = inject(AuthService);
  private menuController       = inject(MenuController);
  private modalController      = inject(ModalController);
  private router               = inject(Router);
  private wsService            = inject(SupportChatWebsocketService);

  public authUser = this.supervisorService.authUserSignal;

  /** Инициалы для mock-аватарки */
  public readonly initials = computed(() => {
    const u = this.authUser();
    if (!u) return '?';
    return ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase() || '?';
  });

  public menuItems: Signal<ISideMenuItem[]> = computed(() => {
    const role   = this.supervisorService.authUserSignal()?.role;
    const base   = role === EUserRole.MANAGER ? MANAGER_MENU_CONFIG : ADMIN_MENU_CONFIG;
    const unread = this.wsService.unreadCount;

    const withBadge = base.map((item) =>
      item.url === '/main/support' ? { ...item, badgeSignal: unread } : item,
    );

    const withBadges = base.map((item) =>
      item.title === 'MENU_NOTIFICATION'
        ? { ...item, badgeSignal: this.notificationsService.unreadCountSignal }
        : item,
    );

    // Подписка ещё не загружена — показываем все пункты без feature-gate
    if (!this.subscriptionService.currentSubscription()) {
      return withBadge;
    }

    return withBadge.filter((item) => {
      if (!item.feature) return true;
      return this.subscriptionService.hasFeature(item.feature, item.minLevel);
    });
  });

  ngOnInit(): void {
    if (!this.supervisorService.authUserSignal()) {
      this.supervisorService.getSelf().pipe(take(1)).subscribe();
    }
  }

  public closeMenu(): void {
    this.menuController.close();
  }

  public async openAccountSettings(): Promise<void> {
    await this.menuController.close();
    const modal = await this.modalController.create({
      cssClass: 'modal-account-settings',
      component: AccountSettingsModalComponent,
    });
    await modal.present();
  }

  public logout(): void {
    this.authService.logout().pipe(take(1)).subscribe({
      complete: () => {
        this.websocketService.disconnectSocket();
        localStorage.clear();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.websocketService.disconnectSocket();
        localStorage.clear();
        this.router.navigate(['/login']);
      },
    });
  }
}
