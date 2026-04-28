import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { IEmployee } from '@core/models/employee.interface';

@Component({
  selector: 'app-employee-avatar',
  standalone: true,
  imports: [CommonModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ea-wrap">
      <div class="ea-avatar-wrap">
        <div class="ea-avatar" [style.background]="avatarUrl ? 'transparent' : color">
          <img *ngIf="avatarUrl; else initials" [src]="avatarUrl" [alt]="displayName" />
          <ng-template #initials>
            <span class="ea-avatar__initials">{{ computedInitials }}</span>
          </ng-template>
        </div>
      </div>
      <div class="ea-info">
        <span class="ea-info__name">{{ displayName }}</span>
        <span *ngIf="isManager" class="ea-info__badge">
          <ion-icon name="shield-checkmark" class="ea-badge-icon"></ion-icon>
          Manager
        </span>
      </div>
    </div>
  `,
  styles: [`
    .ea-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    /* Avatar wrapper */
    .ea-avatar-wrap {
      position: relative;
      flex-shrink: 0;
      width: 34px;
      height: 34px;
    }
    .ea-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .ea-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ea-avatar__initials {
      font-size: 12px;
      font-weight: 700;
      color: #333;
      line-height: 1;
    }

    /* Name + badge — вертикально */
    .ea-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: 3px;
    }
    .ea-info__name {
      font-size: 13px;
      font-weight: 500;
      color: var(--ion-text-color, #333);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    /* Manager pill badge */
    .ea-info__badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px 2px 4px;
      border-radius: 20px;
      background: linear-gradient(135deg, #f5a623 0%, #f76b1c 100%);
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      white-space: nowrap;
      align-self: flex-start;
      box-shadow: 0 1px 4px rgba(247, 107, 28, 0.4);
    }
    .ea-badge-icon {
      font-size: 9px;
      color: #fff;
    }
  `],
})
export class EmployeeAvatarComponent {
  @Input() employee!: IEmployee;
  @Input() color: string = '#C8B6FF';
  @Input() isManager: boolean = false;

  get avatarUrl(): string | null {
    return this.employee?.avatar?.url ?? null;
  }

  get displayName(): string {
    return `${this.employee?.firstName ?? ''} ${this.employee?.lastName ?? ''}`.trim();
  }

  get computedInitials(): string {
    const f = this.employee?.firstName?.[0] ?? '';
    const l = this.employee?.lastName?.[0] ?? '';
    return (f + l).toUpperCase();
  }
}

