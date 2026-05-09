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
import { IonicModule } from '@ionic/angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardService } from '@core/services/dashboard.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { IBaseQueries } from '@core/models/application.interface';
import {
  IDashboardKpis,
  IExpensesTrendResponse,
  IProfitResponse,
  IRevenueTrendResponse,
} from '@core/models/dashboard.interface';
import { EFeatureLevel } from '@core/models/subscription.interface';
import { forkJoin } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  BarChartOptions,
  ChartOptions,
  DonutChartOptions,
  KpiCard,
} from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

type TAnalyticsLevel = 'minimal' | 'basic' | 'advanced' | 'bi';

@Component({
  standalone: true,
  selector: 'app-revenue-tab',
  template: `
    <div class="tab-content">
      <!-- KPI Cards -->
      @if (loading()) {
        <div class="skeleton-cards">
          <ion-skeleton-text [animated]="true" style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="height:80px;border-radius:12px"></ion-skeleton-text>
        </div>
      } @else {
        <div class="kpi-grid">
          @for (card of cards(); track card.title) {
            <div class="kpi-card" [style.--card-color]="'var(' + card.colorVar + ')'">
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

      <!-- Revenue Trend Chart -->
      <div class="chart-card">
        <h3 class="chart-title">{{ 'DASH_REVENUE_TREND_TITLE' | translate }}</h3>
        @if (chartLoading()) {
          <ion-skeleton-text [animated]="true" style="height:280px;border-radius:8px"></ion-skeleton-text>
        } @else if (chartOptions()) {
          <apx-chart
            [series]="chartOptions()!.series"
            [chart]="chartOptions()!.chart"
            [xaxis]="chartOptions()!.xaxis"
            [yaxis]="chartOptions()!.yaxis"
            [stroke]="chartOptions()!.stroke"
            [fill]="chartOptions()!.fill"
            [dataLabels]="chartOptions()!.dataLabels"
            [tooltip]="chartOptions()!.tooltip"
            [grid]="chartOptions()!.grid"
            [colors]="chartOptions()!.colors"
          ></apx-chart>
        }
      </div>

      <!-- Revenue by Service -->
      <div class="chart-card">
        <h3 class="chart-title">{{ 'DASH_REVENUE_BY_SERVICE_TITLE' | translate }}</h3>
        @if (revenueByServiceLoading()) {
          <ion-skeleton-text [animated]="true" style="height:200px;border-radius:8px"></ion-skeleton-text>
        } @else if (serviceBarChart()) {
          <apx-chart
            [series]="serviceBarChart()!.series"
            [chart]="serviceBarChart()!.chart"
            [xaxis]="serviceBarChart()!.xaxis"
            [yaxis]="serviceBarChart()!.yaxis"
            [plotOptions]="serviceBarChart()!.plotOptions"
            [dataLabels]="serviceBarChart()!.dataLabels"
            [tooltip]="serviceBarChart()!.tooltip"
            [grid]="serviceBarChart()!.grid"
            [colors]="serviceBarChart()!.colors"
          ></apx-chart>
        }
      </div>

      @if (analyticsLevel !== 'minimal') {
        <!-- Revenue by Employee -->
        @if (employeeBarChart()) {
          <div class="chart-card">
            <h3 class="chart-title">{{ 'DASH_REVENUE_BY_EMPLOYEE_TITLE' | translate }}</h3>
            <apx-chart
              [series]="employeeBarChart()!.series"
              [chart]="employeeBarChart()!.chart"
              [xaxis]="employeeBarChart()!.xaxis"
              [yaxis]="employeeBarChart()!.yaxis"
              [plotOptions]="employeeBarChart()!.plotOptions"
              [dataLabels]="employeeBarChart()!.dataLabels"
              [tooltip]="employeeBarChart()!.tooltip"
              [grid]="employeeBarChart()!.grid"
              [colors]="employeeBarChart()!.colors"
            ></apx-chart>
          </div>
        }

        <!-- Revenue by Department -->
        @if (departmentBarChart()) {
          <div class="chart-card">
            <h3 class="chart-title">{{ 'DASH_REVENUE_BY_LOCATION_TITLE' | translate }}</h3>
            <apx-chart
              [series]="departmentBarChart()!.series"
              [chart]="departmentBarChart()!.chart"
              [xaxis]="departmentBarChart()!.xaxis"
              [yaxis]="departmentBarChart()!.yaxis"
              [plotOptions]="departmentBarChart()!.plotOptions"
              [dataLabels]="departmentBarChart()!.dataLabels"
              [tooltip]="departmentBarChart()!.tooltip"
              [grid]="departmentBarChart()!.grid"
              [colors]="departmentBarChart()!.colors"
            ></apx-chart>
          </div>
        }

        <!-- Revenue Breakdown Donut -->
        @if (revenueDonutChart()) {
          <div class="chart-card">
            <h3 class="chart-title">{{ 'DASH_REVENUE_BREAKDOWN_TITLE' | translate }}</h3>
            <apx-chart
              [series]="revenueDonutChart()!.series"
              [chart]="revenueDonutChart()!.chart"
              [labels]="revenueDonutChart()!.labels"
              [colors]="revenueDonutChart()!.colors"
              [legend]="revenueDonutChart()!.legend"
              [dataLabels]="revenueDonutChart()!.dataLabels"
              [tooltip]="revenueDonutChart()!.tooltip"
              [plotOptions]="revenueDonutChart()!.plotOptions"
              [responsive]="revenueDonutChart()!.responsive"
            ></apx-chart>
          </div>
        }

        <!-- Revenue vs Expenses -->
        @if (revenueVsExpensesChart()) {
          <div class="chart-card">
            <h3 class="chart-title">{{ 'DASH_REVENUE_VS_EXPENSES_TITLE' | translate }}</h3>
            <apx-chart
              [series]="revenueVsExpensesChart()!.series"
              [chart]="revenueVsExpensesChart()!.chart"
              [xaxis]="revenueVsExpensesChart()!.xaxis"
              [yaxis]="revenueVsExpensesChart()!.yaxis"
              [stroke]="revenueVsExpensesChart()!.stroke"
              [fill]="revenueVsExpensesChart()!.fill"
              [dataLabels]="revenueVsExpensesChart()!.dataLabels"
              [tooltip]="revenueVsExpensesChart()!.tooltip"
              [grid]="revenueVsExpensesChart()!.grid"
              [colors]="revenueVsExpensesChart()!.colors"
            ></apx-chart>
          </div>
        }
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
    .chart-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--ion-text-color); }
    .skeleton-cards { margin-bottom: 16px; }
  `],
  imports: [CommonModule, IonicModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevenueTabComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private subscriptionService = inject(SubscriptionService);
  private t = inject(TranslateService);

  public analyticsLevel: TAnalyticsLevel = 'minimal';

  public kpis = signal<IDashboardKpis | null>(null);
  public loading = signal(true);
  public cards = signal<KpiCard[]>([]);

  public chartLoading = signal(true);
  public chartOptions = signal<ChartOptions | null>(null);

  public revenueByServiceLoading = signal(true);
  public serviceBarChart = signal<BarChartOptions | null>(null);

  public revenueByEmployeeLoading = signal(true);
  public employeeBarChart = signal<BarChartOptions | null>(null);

  public revenueByDepartmentLoading = signal(true);
  public departmentBarChart = signal<BarChartOptions | null>(null);

  public revenueBreakdownLoading = signal(true);
  public revenueDonutChart = signal<DonutChartOptions | null>(null);

  public profitData = signal<IProfitResponse | null>(null);
  public revenueVsExpensesChart = signal<ChartOptions | null>(null);
  public revenueVsExpensesLoading = signal(true);

  public ngOnInit(): void {
    const analyticsFeature = this.subscriptionService.hasFeature('analytics', EFeatureLevel.ADVANCED);
    const analyticsBasic = this.subscriptionService.hasFeature('analytics', EFeatureLevel.BASIC);
    if (analyticsFeature) {
      this.analyticsLevel = 'advanced';
    } else if (analyticsBasic) {
      this.analyticsLevel = 'basic';
    } else {
      this.analyticsLevel = 'minimal';
    }

    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
        this.loadKpis(filters);
        this.loadRevenueTrend(filters);
        this.loadRevenueByService(filters);

        if (this.analyticsLevel === 'minimal') return;

        this.loadRevenueByEmployee(filters);
        this.loadRevenueByDepartment(filters);
        this.loadRevenueBreakdown(filters);
        this.loadProfit(filters);
        this.loadRevenueVsExpenses(filters);
      });
  }

  public getIonIcon(icon: string): string {
    const map: Record<string, string> = {
      fi_trending_up: 'trending-up-outline',
      fi_tag: 'pricetag-outline',
      fi_check_circle: 'checkmark-circle-outline',
      fi_users: 'people-outline',
      fi_clock: 'time-outline',
      fi_dollar_sign: 'cash-outline',
    };
    return map[icon] ?? 'analytics-outline';
  }

  private loadKpis(filters: IBaseQueries): void {
    this.loading.set(true);
    this.dashboardService.getKpis(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.kpis.set(data);
        this.cards.set(this.buildCards(data, this.profitData()));
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.loading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadRevenueTrend(filters: IBaseQueries): void {
    const granularity = this.state.determineGranularity(filters.from!, filters.to!);
    this.chartLoading.set(true);
    this.dashboardService.getRevenueTrend({ ...filters, granularity }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.chartOptions.set(this.buildChartOptions(data, granularity));
        this.chartLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.chartLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadRevenueByService(filters: IBaseQueries): void {
    this.revenueByServiceLoading.set(true);
    this.dashboardService.getRevenueByService(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.serviceBarChart.set(this.buildBarChartOptions(data.byService, this.t.instant('DASH_REVENUE_BY_SERVICE_TITLE'), '#6366f1'));
        this.revenueByServiceLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.revenueByServiceLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadRevenueByEmployee(filters: IBaseQueries): void {
    this.revenueByEmployeeLoading.set(true);
    this.dashboardService.getRevenueByEmployee(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.employeeBarChart.set(data.byEmployee.length ? this.buildBarChartOptions(data.byEmployee, this.t.instant('DASH_REVENUE_BY_EMPLOYEE_TITLE'), '#10b981') : null);
        this.revenueByEmployeeLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.revenueByEmployeeLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadRevenueByDepartment(filters: IBaseQueries): void {
    this.revenueByDepartmentLoading.set(true);
    this.dashboardService.getRevenueByDepartment(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.departmentBarChart.set(data.byDepartment.length ? this.buildBarChartOptions(data.byDepartment, this.t.instant('DASH_REVENUE_BY_LOCATION_TITLE'), '#3b82f6') : null);
        this.revenueByDepartmentLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.revenueByDepartmentLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadRevenueBreakdown(filters: IBaseQueries): void {
    this.revenueBreakdownLoading.set(true);
    this.dashboardService.getRevenueBreakdown(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        const total = data.serviceRevenue + data.productRevenue;
        this.revenueDonutChart.set(total > 0
          ? this.buildDonutChartOptions(
              [data.serviceRevenue, data.productRevenue],
              [this.t.instant('DASH_SERVICES'), this.t.instant('DASH_PRODUCTS')],
              ['#6366f1', '#f59e0b'],
            )
          : null);
        this.revenueBreakdownLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.revenueBreakdownLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadProfit(filters: IBaseQueries): void {
    this.dashboardService.getProfit(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.profitData.set(data);
        const kpis = this.kpis();
        if (kpis) this.cards.set(this.buildCards(kpis, data));
        this.cdr.markForCheck();
      },
    });
  }

  private loadRevenueVsExpenses(filters: IBaseQueries): void {
    this.revenueVsExpensesLoading.set(true);
    const granularity = this.state.determineGranularity(filters.from!, filters.to!);
    forkJoin({
      expensesTrend: this.dashboardService.getExpensesTrend({ ...filters, granularity }),
      revenueTrend: this.dashboardService.getRevenueTrend({ ...filters, granularity }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ expensesTrend, revenueTrend }) => {
        this.revenueVsExpensesChart.set(this.buildRevenueVsExpensesChart(expensesTrend, revenueTrend, granularity));
        this.revenueVsExpensesLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.revenueVsExpensesLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  // Chart builders

  private buildCards(data: IDashboardKpis, profit?: IProfitResponse | null): KpiCard[] {
    if (this.analyticsLevel === 'minimal') {
      return [
        { title: this.t.instant('DASH_KPI_REVENUE_TITLE'), value: this.state.formatCurrency(data.totalRevenue), subtitle: this.t.instant('DASH_KPI_THIS_PERIOD'), icon: 'fi_trending_up', colorVar: '--green-600', bgVar: '--green-50' },
        { title: this.t.instant('DASH_KPI_AVG_TICKET_TITLE'), value: this.state.formatCurrency(data.avgTicketValue), subtitle: this.t.instant('DASH_KPI_PER_APPOINTMENT'), icon: 'fi_tag', colorVar: '--orange-500', bgVar: '--orange-50' },
        { title: this.t.instant('DASH_KPI_COMPLETED_TITLE'), value: data.completedAppointments.toString(), subtitle: this.t.instant('DASH_KPI_APPOINTMENTS'), icon: 'fi_check_circle', colorVar: '--blue-500', bgVar: '--blue-50' },
      ];
    }

    const cards: KpiCard[] = [
      { title: this.t.instant('DASH_KPI_REVENUE_TITLE'), value: this.state.formatCurrency(data.totalRevenue), subtitle: this.t.instant('DASH_KPI_THIS_PERIOD'), icon: 'fi_trending_up', colorVar: '--green-600', bgVar: '--green-50' },
    ];

    if (profit && this.analyticsLevel !== 'basic') {
      cards.push({ title: this.t.instant('DASH_KPI_NET_PROFIT_TITLE'), value: this.state.formatCurrency(profit.netProfit), subtitle: this.t.instant('DASH_KPI_NET_PROFIT_SUBTITLE'), icon: 'fi_dollar_sign', colorVar: profit.netProfit >= 0 ? '--green-600' : '--red-500', bgVar: profit.netProfit >= 0 ? '--green-50' : '--red-50' });
    }

    cards.push(
      { title: this.t.instant('DASH_KPI_AVG_TICKET_TITLE'), value: this.state.formatCurrency(data.avgTicketValue), subtitle: this.t.instant('DASH_KPI_PER_APPOINTMENT'), icon: 'fi_tag', colorVar: '--orange-500', bgVar: '--orange-50' },
      { title: this.t.instant('DASH_KPI_COMPLETED_TITLE'), value: data.completedAppointments.toString(), subtitle: this.t.instant('DASH_KPI_APPOINTMENTS'), icon: 'fi_check_circle', colorVar: '--blue-500', bgVar: '--blue-50' },
      { title: this.t.instant('DASH_KPI_NEW_RETURNING_TITLE'), value: `${data.newClients} / ${data.returningClients}`, subtitle: this.t.instant('DASH_KPI_CLIENTS'), icon: 'fi_users', colorVar: '--purple-500', bgVar: '--purple-50' },
      { title: this.t.instant('DASH_KPI_UTILIZATION_TITLE'), value: `${data.utilizationRate || 0}%`, subtitle: this.t.instant('DASH_KPI_UTILIZATION_SUBTITLE'), icon: 'fi_clock', colorVar: '--teal-600', bgVar: '--green-50' },
    );

    return cards;
  }

  private buildChartOptions(data: IRevenueTrendResponse, granularity: 'daily' | 'monthly'): ChartOptions {
    const isMonthly = granularity === 'monthly';
    const categories = data.current.map((p) => isMonthly ? this.state.formatMonthLabel(p.label) : this.state.formatDayLabel(p.label));
    const tickAmount = !isMonthly && categories.length > 10 ? Math.min(8, Math.ceil(categories.length / 5)) : undefined;
    return {
      series: [
        { name: this.t.instant('DASH_CURRENT_PERIOD'), data: data.current.map((p) => p.value) },
        { name: this.t.instant('DASH_PREVIOUS_PERIOD'), data: data.previous.map((p) => p.value) },
      ],
      chart: { type: 'area', height: 280, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } },
      colors: ['#6366f1', '#d1d5db'],
      stroke: { curve: 'smooth', width: [2.5, 2], dashArray: [0, 5] },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.05, stops: [0, 90, 100] } },
      dataLabels: { enabled: false },
      xaxis: { categories, tickAmount, labels: { style: { fontSize: '11px', colors: '#94a3b8' }, rotate: -45, rotateAlways: false, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#94a3b8' }, formatter: (val: number) => this.state.formatCurrency(val) } },
      tooltip: { shared: true, y: { formatter: (val: number) => this.state.formatCurrency(val) } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    };
  }

  private buildBarChartOptions(items: { name: string; revenue: number }[], title: string, color: string): BarChartOptions {
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

  private buildDonutChartOptions(values: number[], labels: string[], colors: string[]): DonutChartOptions {
    return {
      series: values,
      chart: { type: 'donut', height: 280, fontFamily: 'inherit' },
      labels, colors,
      legend: { position: 'bottom', fontSize: '13px', markers: { shape: 'circle' } },
      dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%`, style: { fontSize: '12px' } },
      tooltip: { y: { formatter: (val: number) => this.state.formatCurrency(val) } },
      plotOptions: { pie: { donut: { size: '60%', labels: { show: true, total: { show: true, label: this.t.instant('DASH_TOTAL'), formatter: (w: { globals: { seriesTotals: number[] } }): string => { const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0); return this.state.formatCurrency(total); } } } } } },
      responsive: [{ breakpoint: 480, options: { chart: { height: 260 }, legend: { position: 'bottom' } } }],
    };
  }

  private buildRevenueVsExpensesChart(expensesTrend: IExpensesTrendResponse, revenueTrend: { current: { label: string; value: number }[] }, granularity: 'daily' | 'monthly'): ChartOptions | null {
    if (!expensesTrend?.data?.length) return null;
    const isDaily = granularity === 'daily';
    const expenseLabels = expensesTrend.data.map((p) => isDaily ? this.state.formatDayLabel(p.label) : this.state.formatMonthLabel(p.label));
    const expenseValues = expensesTrend.data.map((p) => p.value);
    const revenueValues: number[] = revenueTrend?.current?.map((p) => p.value) ?? [];
    while (revenueValues.length < expenseValues.length) revenueValues.push(0);
    const pointCount = expenseValues.length;
    const fewPoints = pointCount <= 2;
    const tickAmount = isDaily && pointCount > 10 ? Math.min(8, Math.ceil(pointCount / 5)) : undefined;
    return {
      series: [
        { name: this.t.instant('DASH_REVENUE_SERIES'), data: revenueValues.slice(0, pointCount) },
        { name: this.t.instant('DASH_EXPENSES_SERIES'), data: expenseValues },
      ],
      chart: { type: 'area', height: 280, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } },
      colors: ['#10b981', '#ef4444'],
      stroke: { curve: 'smooth', width: [2.5, 2.5], dashArray: [0, 0] },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.05, stops: [0, 90, 100] } },
      markers: { size: fewPoints ? 8 : 5, strokeWidth: 2, strokeColors: '#fff', hover: { sizeOffset: 3 } },
      legend: { show: true, position: 'bottom', fontSize: '13px', markers: { shape: 'circle' } },
      dataLabels: fewPoints ? { enabled: true, formatter: (val: number): string => this.state.formatCurrency(val), style: { fontSize: '12px', fontWeight: 600 }, offsetY: -10 } : { enabled: false },
      xaxis: { categories: expenseLabels, tickAmount, labels: { style: { fontSize: '11px', colors: '#94a3b8' }, rotate: -45, rotateAlways: false, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#94a3b8' }, formatter: (val: number): string => this.state.formatCurrency(val) } },
      tooltip: { shared: true, y: { formatter: (val: number): string => this.state.formatCurrency(val) } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    };
  }
}

