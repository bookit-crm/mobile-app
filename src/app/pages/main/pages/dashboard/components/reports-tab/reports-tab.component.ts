import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule, ToastController } from '@ionic/angular';
import { filter, take } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { IBaseQueries } from '@core/models/application.interface';
import { ReportFormat, ReportService, ReportType } from '@core/services/report.service';
import { DashboardStateService } from '../../services/dashboard-state.service';

interface IReportCard {
  type: ReportType;
  title: string;
  description: string;
  icon: string;
  color: string;
}

interface IFormatOption {
  value: ReportFormat;
  label: string;
  icon: string;
}

@Component({
  standalone: true,
  selector: 'app-reports-tab',
  template: `
    <div class="tab-content">
      <div class="reports-header">
        <h2 class="reports-header__title">{{ 'REPORTS' | translate }}</h2>
        <p class="reports-header__subtitle">{{ 'DASH_REPORTS_SUBTITLE' | translate }}</p>
      </div>

      <!-- Report Type Cards -->
      <h3 class="section-title">{{ 'DASH_SELECT_REPORT_TYPE' | translate }}</h3>
      <div class="report-cards">
        @for (card of reportCards; track card.type) {
          <div
            class="report-card"
            [class.report-card--selected]="selectedType() === card.type"
            (click)="selectType(card.type)"
          >
            <div class="report-card__icon" [style.background]="card.color + '20'">
              <ion-icon [name]="card.icon" [style.color]="card.color"></ion-icon>
            </div>
            <div class="report-card__body">
              <div class="report-card__title">{{ card.title }}</div>
              <div class="report-card__desc">{{ card.description }}</div>
            </div>
            @if (selectedType() === card.type) {
              <ion-icon name="checkmark-circle" class="report-card__check" color="primary"></ion-icon>
            }
          </div>
        }
      </div>

      <!-- Format Selection -->
      <h3 class="section-title">{{ 'DASH_SELECT_FORMAT' | translate }}</h3>
      <div class="format-row">
        @for (fmt of formatOptions; track fmt.value) {
          <button
            class="format-btn"
            [class.format-btn--active]="selectedFormat() === fmt.value"
            (click)="selectFormat(fmt.value)"
          >
            <ion-icon [name]="fmt.icon"></ion-icon>
            <span>{{ fmt.label }}</span>
          </button>
        }
      </div>

      <!-- Error -->
      @if (error()) {
        <div class="error-banner">
          <ion-icon name="alert-circle-outline"></ion-icon>
          {{ error() }}
        </div>
      }

      <!-- Download Button -->
      <div class="download-section">
        <ion-button
          expand="block"
          [disabled]="!canDownload() || loading()"
          (click)="download()"
        >
          @if (loading()) {
            <ion-spinner name="crescent" slot="start"></ion-spinner>
            {{ 'DASH_GENERATING' | translate }}
          } @else {
            <ion-icon name="download-outline" slot="start"></ion-icon>
            {{ 'DASH_DOWNLOAD_REPORT' | translate }}
          }
        </ion-button>
      </div>
    </div>
  `,
  styles: [`
    .tab-content { padding: 0 4px 32px; }

    .reports-header { margin-bottom: 20px; }
    .reports-header__title { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
    .reports-header__subtitle { margin: 0; font-size: 13px; color: var(--ion-color-medium); }

    .section-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ion-color-medium); }

    /* Report type cards */
    .report-cards { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .report-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--ion-card-background, #fff);
      border-radius: 12px; padding: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,.07);
      border: 2px solid transparent;
      cursor: pointer; transition: border-color 0.15s;
    }
    .report-card--selected { border-color: var(--ion-color-primary); }
    .report-card__icon {
      width: 44px; height: 44px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .report-card__icon ion-icon { font-size: 22px; }
    .report-card__body { flex: 1; min-width: 0; }
    .report-card__title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
    .report-card__desc { font-size: 12px; color: var(--ion-color-medium); }
    .report-card__check { font-size: 20px; flex-shrink: 0; }

    /* Format buttons */
    .format-row { display: flex; gap: 10px; margin-bottom: 24px; }
    .format-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px; border-radius: 10px; border: 2px solid var(--ion-color-light, #f4f5f8);
      background: var(--ion-card-background, #fff); font-size: 14px; font-weight: 500;
      color: var(--ion-text-color); cursor: pointer; transition: border-color 0.15s;
    }
    .format-btn ion-icon { font-size: 18px; }
    .format-btn--active { border-color: var(--ion-color-primary); color: var(--ion-color-primary); }

    /* Error */
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fee2e2; color: #dc2626;
      border-radius: 10px; padding: 12px 14px;
      font-size: 13px; margin-bottom: 16px;
    }
    .error-banner ion-icon { font-size: 18px; flex-shrink: 0; }

    /* Download */
    .download-section { margin-top: 8px; }
  `],
  imports: [CommonModule, IonicModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsTabComponent implements OnInit {
  private reportService = inject(ReportService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private toastCtrl = inject(ToastController);
  private t = inject(TranslateService);

  public selectedType = signal<ReportType | null>(null);
  public selectedFormat = signal<ReportFormat | null>(null);
  public loading = signal(false);
  public error = signal<string | null>(null);

  private currentFilters: IBaseQueries = {};

  public get reportCards(): IReportCard[] {
    return [
      {
        type: 'appointments',
        title: this.t.instant('DASH_REPORT_APPOINTMENTS_TITLE'),
        description: this.t.instant('DASH_REPORT_APPOINTMENTS_DESC'),
        icon: 'calendar-outline',
        color: '#6366f1',
      },
      {
        type: 'staff_performance',
        title: this.t.instant('DASH_REPORT_STAFF_TITLE'),
        description: this.t.instant('DASH_REPORT_STAFF_DESC'),
        icon: 'trophy-outline',
        color: '#10b981',
      },
      {
        type: 'client_detailed',
        title: this.t.instant('DASH_REPORT_CLIENT_TITLE'),
        description: this.t.instant('DASH_REPORT_CLIENT_DESC'),
        icon: 'people-outline',
        color: '#3b82f6',
      },
      {
        type: 'inventory_history',
        title: this.t.instant('DASH_REPORT_INVENTORY_TITLE'),
        description: this.t.instant('DASH_REPORT_INVENTORY_DESC'),
        icon: 'cube-outline',
        color: '#f59e0b',
      },
    ];
  }

  public readonly formatOptions: IFormatOption[] = [
    { value: 'excel', label: 'Excel', icon: 'document-text-outline' },
    { value: 'pdf',   label: 'PDF',   icon: 'document-outline' },
  ];

  public canDownload = signal(false);

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
        this.currentFilters = filters;
      });
  }

  public selectType(type: ReportType): void {
    this.selectedType.set(type);
    this.updateCanDownload();
  }

  public selectFormat(format: ReportFormat): void {
    this.selectedFormat.set(format);
    this.updateCanDownload();
  }

  public download(): void {
    if (!this.canDownload() || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const params = {
      type: this.selectedType()!,
      format: this.selectedFormat()!,
      ...(this.currentFilters['from']          && { from: this.currentFilters['from'] }),
      ...(this.currentFilters['to']            && { to: this.currentFilters['to'] }),
      ...(this.currentFilters['departmentId']  && { departmentId: this.currentFilters['departmentId'] }),
      ...(this.currentFilters['employeeIds']?.length && { employeeIds: this.currentFilters['employeeIds'] }),
    };

    this.reportService
      .downloadReport(params)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.loading.set(false);
          this.triggerDownload(blob, params.type, params.format);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.error.set(this.t.instant('DASH_REPORT_ERROR'));
          this.cdr.markForCheck();
        },
      });
  }

  private updateCanDownload(): void {
    this.canDownload.set(!!this.selectedType() && !!this.selectedFormat());
  }

  private triggerDownload(blob: Blob, type: ReportType, format: ReportFormat): void {
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${type}_${date}.${ext}`;

    if (Capacitor.isNativePlatform()) {
      // На Android/iOS: пишем файл в кеш и открываем через Share-диалог
      this.saveAndShareNative(blob, filename);
    } else {
      // В браузере / PWA: стандартный blob-download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  }

  private saveAndShareNative(blob: Blob, filename: string): void {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      let uri: string;

      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Documents,
        });
        uri = result.uri;
      } catch {
        this.error.set(this.t.instant('DASH_ERROR_WRITE_FILE'));
        this.cdr.markForCheck();
        return;
      }

      try {
        await Share.share({
          title: filename,
          url: uri,
          dialogTitle: this.t.instant('DASH_SHARE_DIALOG_TITLE'),
        });
      } catch {
        void this.showToast(this.t.instant('DASH_FILE_SAVED', { filename }));
      }
    };
    reader.readAsDataURL(blob);
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }
}

