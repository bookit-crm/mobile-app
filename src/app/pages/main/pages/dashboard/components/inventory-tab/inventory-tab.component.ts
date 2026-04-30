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
  IInventoryAnalyticsResponse,
  ITopProductItem,
  ITopServicesResponse,
} from '@core/models/dashboard.interface';

import { BarChartOptions, KpiCard } from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

@Component({
  standalone: true,
  selector: 'app-inventory-tab',
  template: `
    <div class="tab-content">
      <!-- KPI Cards -->
      @if (inventoryLoading()) {
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
      } @else {
        <div class="kpi-grid">
          @for (card of inventoryCards(); track card.title) {
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

      <!-- Top Services by Revenue -->
      @if (!servicesLoading() && servicesByRevenueChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Top Services by Revenue</h3>
          <apx-chart
            [series]="servicesByRevenueChart()!.series"
            [chart]="servicesByRevenueChart()!.chart"
            [xaxis]="servicesByRevenueChart()!.xaxis"
            [yaxis]="servicesByRevenueChart()!.yaxis"
            [plotOptions]="servicesByRevenueChart()!.plotOptions"
            [dataLabels]="servicesByRevenueChart()!.dataLabels"
            [tooltip]="servicesByRevenueChart()!.tooltip"
            [grid]="servicesByRevenueChart()!.grid"
            [colors]="servicesByRevenueChart()!.colors"
          ></apx-chart>
        </div>
      }

      <!-- Top Services by Bookings -->
      @if (!servicesLoading() && servicesByBookingsChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Top Services by Bookings</h3>
          <apx-chart
            [series]="servicesByBookingsChart()!.series"
            [chart]="servicesByBookingsChart()!.chart"
            [xaxis]="servicesByBookingsChart()!.xaxis"
            [yaxis]="servicesByBookingsChart()!.yaxis"
            [plotOptions]="servicesByBookingsChart()!.plotOptions"
            [dataLabels]="servicesByBookingsChart()!.dataLabels"
            [tooltip]="servicesByBookingsChart()!.tooltip"
            [grid]="servicesByBookingsChart()!.grid"
            [colors]="servicesByBookingsChart()!.colors"
          ></apx-chart>
        </div>
      }

      <!-- Top Products -->
      @if (!productsLoading() && topProducts().length) {
        <div class="chart-card">
          <h3 class="chart-title">Top Products</h3>
          <ion-list lines="none">
            @for (product of topProducts(); track product.name; let i = $index) {
              <ion-item>
                <div class="rank-badge" slot="start">#{{ i + 1 }}</div>
                <ion-label>
                  <h3>{{ product.name }}</h3>
                  <p>{{ product.quantitySold }} sold</p>
                </ion-label>
                <ion-note slot="end" color="success">{{ formatCurrency(product.revenue) }}</ion-note>
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
    .kpi-card__value { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .kpi-card__subtitle { font-size: 11px; color: var(--ion-color-medium); }
    .chart-card { background: var(--ion-card-background, #fff); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .chart-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
    .rank-badge { width: 28px; height: 28px; border-radius: 50%; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  `],
  imports: [CommonModule, IonicModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryTabComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  public servicesLoading = signal(true);
  public servicesByRevenueChart = signal<BarChartOptions | null>(null);
  public servicesByBookingsChart = signal<BarChartOptions | null>(null);
  public productsLoading = signal(true);
  public topProducts = signal<ITopProductItem[]>([]);
  public inventoryLoading = signal(true);
  public inventoryCards = signal<KpiCard[]>([]);

  public formatCurrency = (val: number) => this.state.formatCurrency(val);

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
      this.loadTopServices(filters);
      this.loadTopProducts(filters);
      this.loadInventoryAnalytics(filters);
    });
  }

  public getIonIcon(icon: string): string {
    const map: Record<string, string> = {
      fi_refresh_cw: 'refresh-outline', fi_dollar_sign: 'cash-outline', fi_package: 'cube-outline',
    };
    return map[icon] ?? 'cube-outline';
  }

  private loadTopServices(filters: IBaseQueries): void {
    this.servicesLoading.set(true);
    this.dashboardService.getTopServices(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.servicesByRevenueChart.set(this.buildServiceBarChart(data, 'revenue'));
        this.servicesByBookingsChart.set(this.buildServiceBarChart(data, 'bookings'));
        this.servicesLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.servicesLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadTopProducts(filters: IBaseQueries): void {
    this.productsLoading.set(true);
    this.dashboardService.getTopProducts(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.topProducts.set(data.products); this.productsLoading.set(false); this.cdr.markForCheck(); },
      error: () => { this.productsLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadInventoryAnalytics(filters: IBaseQueries): void {
    this.inventoryLoading.set(true);
    this.dashboardService.getInventoryAnalytics(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.inventoryCards.set(this.buildInventoryCards(data));
        this.inventoryLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.inventoryLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private buildServiceBarChart(data: ITopServicesResponse, mode: 'revenue' | 'bookings'): BarChartOptions | null {
    const items = mode === 'revenue' ? data.byRevenue : data.byBookings;
    if (!items.length) return null;
    const isRevenue = mode === 'revenue';
    const color = isRevenue ? '#6366f1' : '#3b82f6';
    const title = isRevenue ? 'Top Services by Revenue' : 'Top Services by Bookings';
    return {
      series: [{ name: title, data: items.map((i) => isRevenue ? i.revenue : i.bookings) }],
      chart: { type: 'bar', height: Math.max(200, items.length * 40 + 60), fontFamily: 'inherit', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
      colors: [color],
      dataLabels: { enabled: true, formatter: (val: number) => isRevenue ? this.state.formatCurrency(val) : val.toString(), style: { fontSize: '11px', colors: ['#334155'] }, offsetX: 4 },
      xaxis: { categories: items.map((i) => i.name), labels: { style: { fontSize: '11px', colors: '#94a3b8' }, formatter: (val: string) => isRevenue ? this.state.formatCurrency(parseFloat(val) || 0) : val }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '12px', colors: '#334155' }, maxWidth: 160 } },
      tooltip: { y: { formatter: (val: number): string => isRevenue ? this.state.formatCurrency(val) : `${val} bookings` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    };
  }

  private buildInventoryCards(data: IInventoryAnalyticsResponse): KpiCard[] {
    return [
      { title: 'Inventory Turnover', value: data.inventoryTurnover.toString(), subtitle: 'COGS / Avg Inventory', icon: 'fi_refresh_cw', colorVar: '--blue-500', bgVar: '--blue-50' },
      { title: 'Product Revenue', value: this.state.formatCurrency(data.totalProductRevenue), subtitle: 'From sold products', icon: 'fi_dollar_sign', colorVar: '--green-600', bgVar: '--green-50' },
      { title: 'Cost of Goods', value: this.state.formatCurrency(data.totalCostOfGoods), subtitle: 'Total material cost', icon: 'fi_package', colorVar: '--orange-500', bgVar: '--orange-50' },
    ];
  }
}

