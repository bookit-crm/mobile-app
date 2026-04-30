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
  IEmployeeHeatmapResponse,
  IEmployeePerformanceItem,
  IEmployeePerformanceResponse,
} from '@core/models/dashboard.interface';

import { BarChartOptions, HeatmapChartOptions, KpiCard } from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

@Component({
  standalone: true,
  selector: 'app-employees-tab',
  template: `
    <div class="tab-content">
      <!-- KPI Cards -->
      @if (employeePerformanceLoading()) {
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
      } @else {
        <div class="kpi-grid">
          @for (card of employeePerformanceCards(); track card.title) {
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

      <!-- Top Performers Chart -->
      @if (topPerformersChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Top Performers</h3>
          <apx-chart
            [series]="topPerformersChart()!.series"
            [chart]="topPerformersChart()!.chart"
            [xaxis]="topPerformersChart()!.xaxis"
            [yaxis]="topPerformersChart()!.yaxis"
            [plotOptions]="topPerformersChart()!.plotOptions"
            [dataLabels]="topPerformersChart()!.dataLabels"
            [tooltip]="topPerformersChart()!.tooltip"
            [grid]="topPerformersChart()!.grid"
            [colors]="topPerformersChart()!.colors"
          ></apx-chart>
        </div>
      }

      <!-- Employee Schedule Heatmap -->
      @if (!employeeHeatmapLoading() && employeeHeatmapChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Appointment Heatmap</h3>
          <apx-chart
            [series]="employeeHeatmapChart()!.series"
            [chart]="employeeHeatmapChart()!.chart"
            [xaxis]="employeeHeatmapChart()!.xaxis"
            [yaxis]="employeeHeatmapChart()!.yaxis"
            [dataLabels]="employeeHeatmapChart()!.dataLabels"
            [tooltip]="employeeHeatmapChart()!.tooltip"
            [plotOptions]="employeeHeatmapChart()!.plotOptions"
            [colors]="employeeHeatmapChart()!.colors"
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
export class EmployeesTabComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  public employeePerformanceLoading = signal(true);
  public employeePerformance = signal<IEmployeePerformanceResponse | null>(null);
  public employeePerformanceCards = signal<KpiCard[]>([]);
  public topPerformersChart = signal<BarChartOptions | null>(null);

  public employeeHeatmapLoading = signal(true);
  public employeeHeatmapChart = signal<HeatmapChartOptions | null>(null);

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
      this.loadEmployeePerformance(filters);
      this.loadEmployeeHeatmap(filters);
    });
  }

  public getIonIcon(icon: string): string {
    const map: Record<string, string> = {
      fi_trending_up: 'trending-up-outline', fi_check_circle: 'checkmark-circle-outline',
      fi_clock: 'time-outline', fi_award: 'trophy-outline',
    };
    return map[icon] ?? 'person-outline';
  }

  private loadEmployeePerformance(filters: IBaseQueries): void {
    this.employeePerformanceLoading.set(true);
    this.dashboardService.getEmployeePerformance(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.employeePerformance.set(data);
        this.employeePerformanceCards.set(this.buildPerformanceCards(data.employees));
        this.topPerformersChart.set(this.buildTopPerformersChart(data.employees));
        this.employeePerformanceLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.employeePerformanceLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadEmployeeHeatmap(filters: IBaseQueries): void {
    this.employeeHeatmapLoading.set(true);
    this.dashboardService.getEmployeeHeatmap(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.employeeHeatmapChart.set(this.buildHeatmapChart(data));
        this.employeeHeatmapLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.employeeHeatmapLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private buildPerformanceCards(employees: IEmployeePerformanceItem[]): KpiCard[] {
    if (!employees.length) return [];
    const totalRevenue = employees.reduce((sum, e) => sum + e.revenue, 0);
    const totalAppointments = employees.reduce((sum, e) => sum + e.appointments, 0);
    const avgUtilization = employees.length > 0
      ? Math.round((employees.reduce((sum, e) => sum + e.utilizationRate, 0) / employees.length) * 100) / 100
      : 0;
    const topPerformer = employees[0];
    return [
      { title: 'Total Staff Revenue', value: this.state.formatCurrency(totalRevenue), subtitle: `From ${employees.length} employees`, icon: 'fi_trending_up', colorVar: '--green-600', bgVar: '--green-50' },
      { title: 'Total Appointments', value: totalAppointments.toString(), subtitle: 'Completed by staff', icon: 'fi_check_circle', colorVar: '--blue-500', bgVar: '--blue-50' },
      { title: 'Avg Utilization', value: `${avgUtilization}%`, subtitle: 'Across all staff', icon: 'fi_clock', colorVar: '--teal-600', bgVar: '--green-50' },
      { title: 'Top Performer', value: topPerformer?.name || '—', subtitle: topPerformer ? `${this.state.formatCurrency(topPerformer.revenue)} revenue` : '', icon: 'fi_award', colorVar: '--orange-500', bgVar: '--orange-50' },
    ];
  }

  private buildTopPerformersChart(employees: IEmployeePerformanceItem[]): BarChartOptions | null {
    if (!employees.length) return null;
    const top = employees.slice(0, 10);
    return {
      series: [
        { name: 'Revenue', data: top.map((e) => e.revenue) },
        { name: 'Appointments', data: top.map((e) => e.appointments) },
      ],
      chart: { type: 'bar', height: Math.max(260, top.length * 50 + 60), fontFamily: 'inherit', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
      colors: ['#6366f1', '#10b981'],
      dataLabels: { enabled: false },
      xaxis: { categories: top.map((e) => e.name), labels: { style: { fontSize: '11px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '12px', colors: '#334155' }, maxWidth: 150 } },
      tooltip: { shared: true, intersect: false, y: { formatter: (val: number, opts: { seriesIndex: number }) => opts.seriesIndex === 0 ? this.state.formatCurrency(val) : `${val} appts` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    };
  }

  private buildHeatmapChart(data: IEmployeeHeatmapResponse): HeatmapChartOptions | null {
    const hasData = data.data.some((cell) => cell.value > 0);
    if (!hasData) return null;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hourLabels: string[] = [];
    for (let h = 0; h < 24; h++) hourLabels.push(`${h.toString().padStart(2, '0')}:00`);
    const series = dayNames.map((dayName, dayIndex) => ({
      name: dayName,
      data: hourLabels.map((hourLabel, hourIndex) => {
        const cell = data.data.find((c) => c.day === dayIndex && c.hour === hourIndex);
        return { x: hourLabel, y: cell?.value || 0 };
      }),
    }));
    series.reverse();
    return {
      series,
      chart: { type: 'heatmap', height: 280, fontFamily: 'inherit', toolbar: { show: false } },
      xaxis: { type: 'category', labels: { style: { fontSize: '10px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#334155' } } },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (val: number) => `${val} appointment${val !== 1 ? 's' : ''}` } },
      plotOptions: { heatmap: { shadeIntensity: 0.5, radius: 4, colorScale: { ranges: [{ from: 0, to: 0, name: 'None', color: '#f1f5f9' }, { from: 1, to: 3, name: 'Low', color: '#bbf7d0' }, { from: 4, to: 7, name: 'Medium', color: '#4ade80' }, { from: 8, to: 15, name: 'High', color: '#16a34a' }, { from: 16, to: 100, name: 'Very High', color: '#166534' }] } } },
      colors: ['#16a34a'],
    };
  }
}

