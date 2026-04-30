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
import { filter } from 'rxjs/operators';
import { IonicModule } from '@ionic/angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { DashboardService } from '@core/services/dashboard.service';
import { IBaseQueries } from '@core/models/application.interface';
import {
  IClientAnalyticsResponse,
  IClientTrendResponse,
  ITopClientsResponse,
} from '@core/models/dashboard.interface';

import { ChartOptions, KpiCard } from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

@Component({
  standalone: true,
  selector: 'app-clients-tab',
  template: `
    <div class="tab-content">
      <!-- KPI Cards -->
      @if (clientAnalyticsLoading()) {
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
      } @else {
        <div class="kpi-grid">
          @for (card of clientCards(); track card.title) {
            <div class="kpi-card">
              <div class="kpi-card__header">
                <ion-icon [name]="getIonIcon(card.icon)" [style.color]="'var(' + card.colorVar + ')'"></ion-icon>
                <span class="kpi-card__title">{{ card.title }}</span>
              </div>
              <div class="kpi-card__value" [style.color]="'var(' + card.colorVar + ')'">{{ card.value }}</div>
              <div class="kpi-card__subtitle">{{ card.subtitle }}</div>
            </div>
          }
        </div>
      }

      <!-- Client Trend Chart -->
      <div class="chart-card">
        <h3 class="chart-title">Client Growth Trend</h3>
        @if (clientTrendLoading()) {
          <ion-skeleton-text animated style="height:240px;border-radius:8px"></ion-skeleton-text>
        } @else if (clientTrendChart()) {
          <apx-chart
            [series]="clientTrendChart()!.series"
            [chart]="clientTrendChart()!.chart"
            [xaxis]="clientTrendChart()!.xaxis"
            [yaxis]="clientTrendChart()!.yaxis"
            [stroke]="clientTrendChart()!.stroke"
            [fill]="clientTrendChart()!.fill"
            [dataLabels]="clientTrendChart()!.dataLabels"
            [tooltip]="clientTrendChart()!.tooltip"
            [grid]="clientTrendChart()!.grid"
            [colors]="clientTrendChart()!.colors"
          ></apx-chart>
        }
      </div>

      <!-- Top Clients -->
      @if (!topClientsLoading() && topClients()) {
        <div class="chart-card">
          <h3 class="chart-title">Top Clients by Revenue</h3>
          <ion-list lines="none">
            @for (client of topClients()!.byRevenue; track client.name; let i = $index) {
              <ion-item>
                <div class="rank-badge" slot="start">#{{ i + 1 }}</div>
                <ion-label>
                  <h3>{{ client.name }}</h3>
                  <p>{{ client.visits }} visits</p>
                </ion-label>
                <ion-note slot="end" color="success">{{ formatCurrency(client.revenue) }}</ion-note>
              </ion-item>
            }
          </ion-list>
        </div>
      }
    </div>
  `,
  styles: [`
    .tab-content { padding: 0 4px 24px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .kpi-card { background: var(--ion-card-background, #fff); border-radius: 12px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .kpi-card__header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .kpi-card__header ion-icon { font-size: 18px; }
    .kpi-card__title { font-size: 12px; color: var(--ion-color-medium); font-weight: 500; }
    .kpi-card__value { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .kpi-card__subtitle { font-size: 11px; color: var(--ion-color-medium); }
    .chart-card { background: var(--ion-card-background, #fff); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .chart-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
    .rank-badge { width: 28px; height: 28px; border-radius: 50%; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  `],
  imports: [CommonModule, IonicModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsTabComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  public clientAnalyticsLoading = signal(true);
  public clientCards = signal<KpiCard[]>([]);
  public clientTrendLoading = signal(true);
  public clientTrendChart = signal<ChartOptions | null>(null);
  public topClientsLoading = signal(true);
  public topClients = signal<ITopClientsResponse | null>(null);

  public formatCurrency = (val: number) => this.state.formatCurrency(val);

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
      this.loadClientAnalytics(filters);
      this.loadClientTrend(filters);
      this.loadTopClients(filters);
    });
  }

  public getIonIcon(icon: string): string {
    const map: Record<string, string> = {
      fi_heart: 'heart-outline', fi_user_check: 'person-done-outline', fi_activity: 'pulse-outline',
      fi_user_plus: 'person-add-outline', fi_star: 'star-outline', fi_alert_circle: 'alert-circle-outline',
    };
    return map[icon] ?? 'person-outline';
  }

  private loadClientAnalytics(filters: IBaseQueries): void {
    this.clientAnalyticsLoading.set(true);
    this.dashboardService.getClientAnalytics(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.clientCards.set(this.buildClientCards(data));
        this.clientAnalyticsLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.clientAnalyticsLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadClientTrend(filters: IBaseQueries): void {
    const granularity = this.state.determineGranularity(filters.from!, filters.to!);
    this.clientTrendLoading.set(true);
    this.dashboardService.getClientTrend({ ...filters, granularity }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.clientTrendChart.set(this.buildClientTrendChart(data, granularity));
        this.clientTrendLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.clientTrendLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadTopClients(filters: IBaseQueries): void {
    this.topClientsLoading.set(true);
    this.dashboardService.getTopClients(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.topClients.set(data); this.topClientsLoading.set(false); this.cdr.markForCheck(); },
      error: () => { this.topClientsLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private buildClientCards(data: IClientAnalyticsResponse): KpiCard[] {
    return [
      { title: 'Retention Rate', value: `${data.retentionRate}%`, subtitle: 'Returning clients ratio', icon: 'fi_heart', colorVar: '--purple-500', bgVar: '--purple-50' },
      { title: 'Rebooking Rate', value: `${data.rebookingRate}%`, subtitle: 'Clients with 2+ visits', icon: 'fi_user_check', colorVar: '--green-600', bgVar: '--green-50' },
      { title: 'Visit Frequency', value: data.avgVisitFrequency.toString(), subtitle: 'Avg visits per client', icon: 'fi_activity', colorVar: '--blue-500', bgVar: '--blue-50' },
      { title: 'New Clients', value: data.newClients.toString(), subtitle: 'Registered in period', icon: 'fi_user_plus', colorVar: '--orange-500', bgVar: '--orange-50' },
      { title: 'Avg Lifetime Value', value: this.state.formatCurrency(data.avgLifetimeValue), subtitle: 'Revenue per client', icon: 'fi_star', colorVar: '--teal-600', bgVar: '--green-50' },
      { title: 'Dormant Clients', value: data.dormantClients.toString(), subtitle: 'No visit in 90 days', icon: 'fi_alert_circle', colorVar: '--red-500', bgVar: '--red-50' },
    ];
  }

  private buildClientTrendChart(data: IClientTrendResponse, granularity: 'daily' | 'monthly'): ChartOptions {
    const isMonthly = granularity === 'monthly';
    const categories = data.data.map((p) => isMonthly ? this.state.formatMonthLabel(p.label) : this.state.formatDayLabel(p.label));
    return {
      series: [
        { name: 'New Clients', data: data.data.map((p) => p.newClients) },
        { name: 'Returning Clients', data: data.data.map((p) => p.returningClients) },
      ],
      chart: { type: 'area', height: 260, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } },
      colors: ['#f59e0b', '#6366f1'],
      stroke: { curve: 'smooth', width: [2.5, 2.5], dashArray: [0, 0] },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.05, stops: [0, 90, 100] } },
      dataLabels: { enabled: false },
      xaxis: { categories, labels: { style: { fontSize: '11px', colors: '#94a3b8' }, rotate: -45, rotateAlways: !isMonthly && categories.length > 15 }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#94a3b8' }, formatter: (val: number) => Math.round(val).toString() } },
      tooltip: { shared: true, y: { formatter: (val: number) => `${val} clients` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    };
  }
}

