import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule, ModalController } from '@ionic/angular';
import { take } from 'rxjs';

import { IClient } from '@core/models/client.interface';
import { IAppointment, AppointmentStatus } from '@core/models/appointment.interface';
import { ClientsService } from '@core/services/clients.service';
import { SubscriptionService } from '@core/services/subscription.service';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.page.html',
  styleUrls: ['./client-detail.page.scss'],
  standalone: true,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonicModule, CurrencyPipe],
})
export class ClientDetailPage implements OnInit {
  @Input() clientId!: string;

  private readonly clientsService = inject(ClientsService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  public client = signal<IClient | null>(null);
  public appointments = signal<IAppointment[]>([]);
  public totalCount = signal(0);
  public isLoadingClient = signal(false);
  public isLoadingHistory = signal(false);
  public offset = signal(0);
  public hasMore = signal(true);

  // Filters
  public showFilterModal = signal(false);
  public dateFrom = signal('');
  public dateTo = signal('');
  public tempDateFrom = '';
  public tempDateTo = '';

  public readonly AppointmentStatus = AppointmentStatus;

  public readonly canViewHistory = computed(() =>
    this.subscriptionService.hasFeature('auditLogs'),
  );

  ngOnInit(): void {
    this.loadClient();
    this.loadHistory(true);
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  public openFilterModal(): void {
    this.tempDateFrom = this.dateFrom();
    this.tempDateTo = this.dateTo();
    this.showFilterModal.set(true);
  }

  public applyFilters(): void {
    this.dateFrom.set(this.tempDateFrom);
    this.dateTo.set(this.tempDateTo);
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadHistory(true);
  }

  public resetFilters(): void {
    this.tempDateFrom = '';
    this.tempDateTo = '';
    this.dateFrom.set('');
    this.dateTo.set('');
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadHistory(true);
  }

  public async onInfiniteScroll(event: Event): Promise<void> {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    this.loadHistory(false);
    (event as CustomEvent & { target: { complete: () => void } }).target.complete();
  }

  public getStatusColor(status: string): string {
    switch (status) {
      case AppointmentStatus.Completed: return 'success';
      case AppointmentStatus.Canceled:  return 'danger';
      case AppointmentStatus.New:       return 'warning';
      default: return 'medium';
    }
  }

  public getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  public getDepartmentName(dept: string | { _id: string; name: string }): string {
    if (!dept) return '—';
    return typeof dept === 'string' ? dept : dept.name;
  }

  public getServiceNames(appt: IAppointment): string {
    if (!appt.services?.length) return '—';
    return appt.services.map((s) => s.name).join(', ');
  }

  public getFinalPrice(appt: IAppointment): number {
    return (appt.totalPrice ?? 0) - (appt.discountAmount ?? 0);
  }

  public formatDate(date: string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  public formatDateTime(date: string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  private loadClient(): void {
    if (!this.clientId) return;
    this.isLoadingClient.set(true);

    this.clientsService
      .getClientById(this.clientId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (client) => {
          this.client.set(client);
          this.isLoadingClient.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingClient.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private loadHistory(reset: boolean): void {
    if (!this.clientId || this.isLoadingHistory()) return;
    this.isLoadingHistory.set(true);

    const filters: Record<string, unknown> = {
      limit: 20,
      offset: this.offset(),
    };
    if (this.dateFrom()) filters['from'] = this.dateFrom();
    if (this.dateTo())   filters['to']   = this.dateTo();

    this.clientsService
      .getClientAppointments(this.clientId, filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = reset ? res.results : [...this.appointments(), ...res.results];
          this.appointments.set(list);
          this.totalCount.set(res.count);
          this.offset.set(list.length);
          this.hasMore.set(list.length < res.count);
          this.isLoadingHistory.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingHistory.set(false);
          this.cdr.markForCheck();
        },
      });
  }
}


