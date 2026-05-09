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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardService } from '@core/services/dashboard.service';
import { ExpensesService } from '@core/services/expenses.service';
import { IBaseQueries } from '@core/models/application.interface';
import {
  IExpensesOverviewResponse,
  IExpensesTrendResponse,
  IProfitResponse,
} from '@core/models/dashboard.interface';
import { IExpenseSummary } from '@core/models/expense.interface';
import { forkJoin } from 'rxjs';

import { BarChartOptions, ChartOptions, DonutChartOptions, KpiCard } from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

@Component({
  standalone: true,
  selector: 'app-expenses-tab',
  template: `
    <div class="tab-content">
      <!-- KPI Cards -->
      @if (kpiLoading()) {
        <ion-skeleton-text [animated]="true" style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
        <ion-skeleton-text [animated]="true" style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
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

      <!-- Category Donut -->
      @if (!categoryDonutLoading() && categoryDonutChart()) {
        <div class="chart-card">
          <h3 class="chart-title">{{ 'DASH_EXPENSES_BY_CATEGORY_TITLE' | translate }}</h3>
          <apx-chart
            [series]="categoryDonutChart()!.series"
            [chart]="categoryDonutChart()!.chart"
            [labels]="categoryDonutChart()!.labels"
            [colors]="categoryDonutChart()!.colors"
            [legend]="categoryDonutChart()!.legend"
            [dataLabels]="categoryDonutChart()!.dataLabels"
            [tooltip]="categoryDonutChart()!.tooltip"
            [plotOptions]="categoryDonutChart()!.plotOptions"
            [responsive]="categoryDonutChart()!.responsive"
          ></apx-chart>
        </div>
      }

      <!-- Revenue vs Expenses -->
      @if (!revenueVsExpensesLoading() && revenueVsExpensesChart()) {
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

      <!-- Expense Category Bar -->
      @if (!expenseCategoryLoading() && expenseCategoryBarChart()) {
        <div class="chart-card">
          <h3 class="chart-title">{{ 'DASH_EXPENSE_CATEGORIES_TITLE' | translate }}</h3>
          <apx-chart
            [series]="expenseCategoryBarChart()!.series"
            [chart]="expenseCategoryBarChart()!.chart"
            [xaxis]="expenseCategoryBarChart()!.xaxis"
            [yaxis]="expenseCategoryBarChart()!.yaxis"
            [plotOptions]="expenseCategoryBarChart()!.plotOptions"
            [dataLabels]="expenseCategoryBarChart()!.dataLabels"
            [tooltip]="expenseCategoryBarChart()!.tooltip"
            [grid]="expenseCategoryBarChart()!.grid"
            [colors]="expenseCategoryBarChart()!.colors"
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
  imports: [CommonModule, IonicModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesTabComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private expensesService = inject(ExpensesService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private t = inject(TranslateService);

  public cards = signal<KpiCard[]>([]);
  public kpiLoading = signal(true);
  public categoryDonutChart = signal<DonutChartOptions | null>(null);
  public categoryDonutLoading = signal(true);
  public revenueVsExpensesChart = signal<ChartOptions | null>(null);
  public revenueVsExpensesLoading = signal(true);
  public expenseCategoryBarChart = signal<BarChartOptions | null>(null);
  public expenseCategoryLoading = signal(true);
  public profitData = signal<IProfitResponse | null>(null);

  private static readonly CATEGORY_COLORS: Record<string, string> = {
    rent: '#6366f1', salary: '#3b82f6', commission: '#0ea5e9', utilities: '#14b8a6',
    inventory: '#22c55e', equipment: '#84cc16', marketing: '#eab308', software: '#f59e0b',
    maintenance: '#f97316', tax: '#ef4444', insurance: '#ec4899', training: '#a855f7', other: '#94a3b8',
  };

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
      this.loadExpenseKpis(filters);
      this.loadExpenseCategories(filters);
      this.loadRevenueVsExpenses(filters);
    });
  }

  public getIonIcon(icon: string): string {
    const map: Record<string, string> = {
      fi_dollar_sign: 'cash-outline', fi_trending_up: 'trending-up-outline',
      bar_chart_2: 'bar-chart-outline', fi_hash: 'apps-outline', fi_pie_chart: 'pie-chart-outline',
    };
    return map[icon] ?? 'cash-outline';
  }

  private loadExpenseKpis(filters: IBaseQueries): void {
    this.kpiLoading.set(true);
    const summaryFilters: Record<string, unknown> = {};
    if (filters.from) summaryFilters['dateFrom'] = filters.from;
    if (filters.to) summaryFilters['dateTo'] = filters.to;
    if (filters.departmentId) summaryFilters['departmentId'] = filters.departmentId;

    forkJoin({
      summary: this.expensesService.getExpenseSummary(summaryFilters),
      profit: this.dashboardService.getProfit(filters),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ summary, profit }) => {
        this.profitData.set(profit);
        this.cards.set(this.buildKpiCards(summary, profit));
        this.categoryDonutChart.set(this.buildCategoryDonutChart(summary.byCategory));
        this.categoryDonutLoading.set(false);
        this.kpiLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.kpiLoading.set(false); this.categoryDonutLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadExpenseCategories(filters: IBaseQueries): void {
    this.expenseCategoryLoading.set(true);
    this.dashboardService.getExpensesOverview(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data: IExpensesOverviewResponse) => {
        const items = data.byCategory.map((c) => ({ name: c.category, revenue: c.total }));
        this.expenseCategoryBarChart.set(items.length ? this.buildBarChartOptions(items, this.t.instant('DASH_EXPENSE_CATEGORIES_TITLE'), '#ef4444') : null);
        this.expenseCategoryLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.expenseCategoryLoading.set(false); this.cdr.markForCheck(); },
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

  private buildKpiCards(summary: IExpenseSummary, profit: IProfitResponse): KpiCard[] {
    const topCategoryLabel = summary.topCategory ? summary.topCategory : this.t.instant('DASH_NO_CATEGORY');
    return [
      { title: this.t.instant('DASH_KPI_TOTAL_EXPENSES_TITLE'), value: this.state.formatCurrency(summary.totalAmount), subtitle: this.t.instant('DASH_KPI_THIS_PERIOD'), icon: 'fi_dollar_sign', colorVar: '--red-500', bgVar: '--red-50' },
      { title: this.t.instant('DASH_KPI_NET_PROFIT_TITLE'), value: this.state.formatCurrency(profit.netProfit), subtitle: this.t.instant('DASH_KPI_NET_PROFIT_SUBTITLE'), icon: 'fi_trending_up', colorVar: profit.netProfit >= 0 ? '--green-600' : '--red-500', bgVar: profit.netProfit >= 0 ? '--green-50' : '--red-50' },
      { title: this.t.instant('DASH_KPI_AVG_EXPENSE_TITLE'), value: this.state.formatCurrency(summary.averageAmount), subtitle: this.t.instant('DASH_KPI_THIS_PERIOD'), icon: 'bar_chart_2', colorVar: '--orange-500', bgVar: '--orange-50' },
      { title: this.t.instant('DASH_KPI_COUNT_TITLE'), value: summary.count.toString(), subtitle: this.t.instant('DASH_KPI_THIS_PERIOD'), icon: 'fi_hash', colorVar: '--blue-500', bgVar: '--blue-50' },
      { title: this.t.instant('DASH_KPI_TOP_CATEGORY_TITLE'), value: topCategoryLabel, subtitle: this.t.instant('DASH_KPI_THIS_PERIOD'), icon: 'fi_pie_chart', colorVar: '--purple-500', bgVar: '--purple-50' },
    ];
  }

  private buildCategoryDonutChart(byCategory: { category: string; total: number }[]): DonutChartOptions | null {
    if (!byCategory?.length) return null;
    const filtered = byCategory.filter((item) => item.total > 0);
    if (!filtered.length) return null;
    const values = filtered.map((item) => item.total);
    const labels = filtered.map((item) => item.category);
    const colors = filtered.map((item) => ExpensesTabComponent.CATEGORY_COLORS[item.category] || '#94a3b8');
    return {
      series: values,
      chart: { type: 'donut', height: 260, fontFamily: 'inherit' },
      labels, colors,
      legend: { position: 'bottom', fontSize: '13px', markers: { shape: 'circle' } },
      dataLabels: { enabled: true, formatter: (val: number): string => `${Math.round(val)}%`, style: { fontSize: '12px' } },
      tooltip: { y: { formatter: (val: number): string => this.state.formatCurrency(val) } },
      plotOptions: { pie: { donut: { size: '60%', labels: { show: true, total: { show: true, label: this.t.instant('DASH_TOTAL'), formatter: (w: { globals: { seriesTotals: number[] } }): string => { const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0); return this.state.formatCurrency(total); } } } } } },
      responsive: [{ breakpoint: 480, options: { chart: { height: 240 }, legend: { position: 'bottom' } } }],
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
      series: [{ name: this.t.instant('DASH_REVENUE_SERIES'), data: revenueValues.slice(0, pointCount) }, { name: this.t.instant('DASH_EXPENSES_SERIES'), data: expenseValues }],
      chart: { type: 'area', height: 260, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } },
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
}

