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
import { IPromoCodeAnalyticsResponse } from '@core/models/dashboard.interface';

import { BarChartOptions, KpiCard } from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

@Component({
  standalone: true,
  selector: 'app-promo-codes-tab',
  template: `
    <div class="tab-content">
      <!-- KPI Cards -->
      @if (loading()) {
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
      } @else {
        <div class="kpi-grid">
          @for (card of cards(); track card.title) {
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

      <!-- Top Promo Codes Chart -->
      @if (!loading() && topPromoCodesChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Top Promo Codes</h3>
          <apx-chart
            [series]="topPromoCodesChart()!.series"
            [chart]="topPromoCodesChart()!.chart"
            [xaxis]="topPromoCodesChart()!.xaxis"
            [yaxis]="topPromoCodesChart()!.yaxis"
            [plotOptions]="topPromoCodesChart()!.plotOptions"
            [dataLabels]="topPromoCodesChart()!.dataLabels"
            [tooltip]="topPromoCodesChart()!.tooltip"
            [grid]="topPromoCodesChart()!.grid"
            [colors]="topPromoCodesChart()!.colors"
          ></apx-chart>
        </div>
      }

      <!-- Discount by Service Chart -->
      @if (!loading() && discountByServiceChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Discount by Service</h3>
          <apx-chart
            [series]="discountByServiceChart()!.series"
            [chart]="discountByServiceChart()!.chart"
            [xaxis]="discountByServiceChart()!.xaxis"
            [yaxis]="discountByServiceChart()!.yaxis"
            [plotOptions]="discountByServiceChart()!.plotOptions"
            [dataLabels]="discountByServiceChart()!.dataLabels"
            [tooltip]="discountByServiceChart()!.tooltip"
            [grid]="discountByServiceChart()!.grid"
            [colors]="discountByServiceChart()!.colors"
          ></apx-chart>
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
  `],
  imports: [CommonModule, IonicModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromoCodesTabComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  public loading = signal(true);
  public cards = signal<KpiCard[]>([]);
  public analytics = signal<IPromoCodeAnalyticsResponse | null>(null);
  public topPromoCodesChart = signal<BarChartOptions | null>(null);
  public discountByServiceChart = signal<BarChartOptions | null>(null);

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
      this.loadAnalytics(filters);
    });
  }

  public getIonIcon(icon: string): string {
    const map: Record<string, string> = {
      fi_tag: 'pricetag-outline', fi_check_circle: 'checkmark-circle-outline',
      fi_trending_up: 'trending-up-outline', fi_dollar_sign: 'cash-outline',
    };
    return map[icon] ?? 'pricetag-outline';
  }

  private loadAnalytics(filters: IBaseQueries): void {
    this.loading.set(true);
    this.dashboardService.getPromoCodeAnalytics(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.analytics.set(data);
        this.cards.set(this.buildCards(data));
        this.topPromoCodesChart.set(this.buildTopPromoCodesChart(data));
        this.discountByServiceChart.set(this.buildDiscountByChart(data.discountByService, 'Discount by Service', '#6366f1'));
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.loading.set(false); this.cdr.markForCheck(); },
    });
  }

  private buildCards(data: IPromoCodeAnalyticsResponse): KpiCard[] {
    return [
      { title: 'Total Discount Given', value: this.state.formatCurrency(data.totalDiscountGiven), subtitle: 'All promo codes combined', icon: 'fi_tag', colorVar: '--green-600', bgVar: '--green-50' },
      { title: 'Usage Count', value: `${data.appointmentsWithPromo} / ${data.totalAppointments}`, subtitle: 'Appointments with promo', icon: 'fi_check_circle', colorVar: '--blue-500', bgVar: '--blue-50' },
      { title: 'Usage Rate', value: `${data.promoUsageRate}%`, subtitle: 'Of total appointments', icon: 'fi_trending_up', colorVar: '--purple-500', bgVar: '--purple-50' },
      { title: 'Avg Discount', value: this.state.formatCurrency(data.avgDiscountPerAppointment), subtitle: 'Per appointment', icon: 'fi_dollar_sign', colorVar: '--orange-500', bgVar: '--orange-50' },
    ];
  }

  private buildTopPromoCodesChart(data: IPromoCodeAnalyticsResponse): BarChartOptions | null {
    if (!data.topPromoCodes?.length) return null;
    const items = data.topPromoCodes.map((pc) => ({ name: pc.name, revenue: pc.usageCount }));
    return {
      series: [{ name: 'Usage Count', data: items.map((i) => i.revenue) }],
      chart: { type: 'bar', height: Math.max(200, items.length * 40 + 60), fontFamily: 'inherit', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
      colors: ['#f59e0b'],
      dataLabels: { enabled: true, formatter: (val: number) => `${val}`, style: { fontSize: '11px', colors: ['#334155'] }, offsetX: 4 },
      xaxis: { categories: items.map((i) => i.name), labels: { style: { fontSize: '11px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '12px', colors: '#334155' }, maxWidth: 160 } },
      tooltip: { y: { formatter: (val: number) => `${val} uses` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    };
  }

  private buildDiscountByChart(items: { name: string; revenue: number }[], title: string, color: string): BarChartOptions | null {
    if (!items?.length) return null;
    return {
      series: [{ name: title, data: items.map((i) => i.revenue) }],
      chart: { type: 'bar', height: Math.max(200, items.length * 40 + 60), fontFamily: 'inherit', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
      colors: [color],
      dataLabels: { enabled: true, formatter: (val: number) => this.state.formatCurrency(val), style: { fontSize: '11px', colors: ['#334155'] }, offsetX: 4 },
      xaxis: { categories: items.map((i) => i.name), labels: { style: { fontSize: '11px', colors: '#94a3b8' }, formatter: (val: string) => this.state.formatCurrency(parseFloat(val) || 0) }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '12px', colors: '#334155' }, maxWidth: 160 } },
      tooltip: { y: { formatter: (val: number) => this.state.formatCurrency(val) } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    };
  }
}

