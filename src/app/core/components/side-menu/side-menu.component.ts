import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  Signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonicModule, MenuController } from '@ionic/angular';
import { EUserRole } from '@core/enums/e-user-role';
import { AuthService } from '@core/services/auth.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { ISideMenuItem } from './models/side-menu-item.interface';
import { ADMIN_MENU_CONFIG, MANAGER_MENU_CONFIG } from './constants/side-menu-config';
import { take } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [IonicModule, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenuComponent implements OnInit {
  private supervisorService = inject(SupervisorService);
  private authService = inject(AuthService);
  private menuController = inject(MenuController);
  private router = inject(Router);

  public authUser = this.supervisorService.authUserSignal;

  public menuItems: Signal<ISideMenuItem[]> = computed(() => {
    const role = this.supervisorService.authUserSignal()?.role;
    return role === EUserRole.MANAGER ? MANAGER_MENU_CONFIG : ADMIN_MENU_CONFIG;
  });

  ngOnInit(): void {
    if (!this.supervisorService.authUserSignal()) {
      this.supervisorService.getSelf().pipe(take(1)).subscribe();
    }
  }

  public closeMenu(): void {
    this.menuController.close();
  }

  public logout(): void {
    this.authService.logout().pipe(take(1)).subscribe({
      complete: () => {
        localStorage.clear();
        this.router.navigate(['/login']);
      },
      error: () => {
        localStorage.clear();
        this.router.navigate(['/login']);
      },
    });
  }
}

