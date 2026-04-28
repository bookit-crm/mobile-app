import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IAppointmentHistory } from '@core/models/appointment.interface';
import { AppointmentsService } from '@core/services/appointments.service';

@Component({
  selector: 'app-appointment-history',
  templateUrl: './appointment-history.page.html',
  styleUrls: ['./appointment-history.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentHistoryPage {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly route = inject(ActivatedRoute);
  private readonly navCtrl = inject(NavController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  public historyData = signal<IAppointmentHistory[]>([]);
  public isLoading = signal(false);
  public actionFilter = signal<string>('all');
  public appointmentId: string | null = null;

  public readonly actionOptions = [
    { value: 'all', label: 'All' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'status_changed', label: 'Status Changed' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'deleted', label: 'Deleted' },
  ];

  ionViewWillEnter(): void {
    this.appointmentId = this.route.snapshot.paramMap.get('appointmentId');
    this.loadHistory();
  }

  public onActionFilterChange(action: string): void {
    this.actionFilter.set(action);
    this.loadHistory();
  }

  public goBack(): void {
    this.navCtrl.back();
  }

  public getActionColor(action: string): string {
    switch (action) {
      case 'created': return 'success';
      case 'updated': return 'primary';
      case 'status_changed': return 'warning';
      case 'canceled': return 'danger';
      case 'deleted': return 'dark';
      default: return 'medium';
    }
  }

  public formatValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private loadHistory(): void {
    if (!this.appointmentId) return;
    this.isLoading.set(true);

    const filters: Record<string, unknown> = { limit: 50, offset: 0 };
    if (this.actionFilter() !== 'all') {
      filters['action'] = this.actionFilter();
    }

    this.appointmentsService
      .getAppointmentHistory(this.appointmentId, filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.historyData.set(res.results);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }
}

