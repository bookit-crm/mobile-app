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
import { IBusiestHoursResponse, IScheduleOccupancyResponse } from '@core/models/dashboard.interface';

import { DonutChartOptions, HeatmapChartOptions, KpiCard } from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

@Component({
  standalone: true,
  selector: 'app-schedule-tab',
  template: `
    <div class="tab-content">
      <!-- KPI Cards -->
      @if (occupancyLoading()) {
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
        <ion-skeleton-text animated style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
      } @else {
        <div class="kpi-grid">
          @for (card of occupancyCards(); track card.title) {
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

      <!-- Slots Donut -->
      @if (slotsDonutChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Slot Occupancy</h3>
          <apx-chart
            [series]="slotsDonutChart()!.series"
            [chart]="slotsDonutChart()!.chart"
            [labels]="slotsDonutChart()!.labels"
            [colors]="slotsDonutChart()!.colors"
            [legend]="slotsDonutChart()!.legend"
            [dataLabels]="slotsDonutChart()!.dataLabels"
            [tooltip]="slotsDonutChart()!.tooltip"
            [plotOptions]="slotsDonutChart()!.plotOptions"
            [responsive]="slotsDonutChart()!.responsive"
          ></apx-chart>
        </div>
      }

      <!-- Busiest Hours Heatmap -->
      @if (!busiestHoursLoading() && busiestHoursChart()) {
        <div class="chart-card">
          <h3 class="chart-title">Busiest Hours</h3>
          <apx-chart
            [series]="busiestHoursChart()!.series"
            [chart]="busiestHoursChart()!.chart"
            [xaxis]="busiestHoursChart()!.xaxis"
            [yaxis]="busiestHoursChart()!.yaxis"
            [dataLabels]="busiestHoursChart()!.dataLabels"
            [tooltip]="busiestHoursChart()!.tooltip"
            [plotOptions]="busiestHoursChart()!.plotOptions"
            [colors]="busiestHoursChart()!.colors"
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
    .kpi-card__value { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .kpi-card__subtitle { font-size: 11px; color: var(--ion-color-medium); }
    .chart-card { background: var(--ion-card-background, #fff); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .chart-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
  `],
  imports: [CommonModule, IonicModule, NgApexchartsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTabComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  public occupancyLoading = signal(true);
  public occupancyCards = signal<KpiCard[]>([]);
  public slotsDonutChart = signal<DonutChartOptions | null>(null);
  public busiestHoursLoading = signal(true);
  public busiestHoursChart = signal<HeatmapChartOptions | null>(null);

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
      this.loadScheduleOccupancy(filters);
      this.loadBusiestHours(filters);
    });
  }

  public getIonIcon(icon: string): string {
    const map: Record<string, string> = {
      calendar: 'calendar-outline', fi_x_circle: 'close-circle-outline',
      fi_alert_circle: 'alert-circle-outline', fi_check_circle: 'checkmark-circle-outline',
    };
    return map[icon] ?? 'calendar-outline';
  }

  private loadScheduleOccupancy(filters: IBaseQueries): void {
    this.occupancyLoading.set(true);
    this.dashboardService.getScheduleOccupancy(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.occupancyCards.set(this.buildOccupancyCards(data));
        this.slotsDonutChart.set(this.buildSlotsDonut(data));
        this.occupancyLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.occupancyLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private loadBusiestHours(filters: IBaseQueries): void {
    this.busiestHoursLoading.set(true);
    this.dashboardService.getBusiestHours(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.busiestHoursChart.set(this.buildHeatmapChart(data));
        this.busiestHoursLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.busiestHoursLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  private buildOccupancyCards(data: IScheduleOccupancyResponse): KpiCard[] {
    return [
      { title: 'Booking Rate', value: `${data.bookingPercentage}%`, subtitle: `${data.bookedSlots} of ${data.totalSlots} slots`, icon: 'calendar', colorVar: '--blue-500', bgVar: '--blue-50' },
      { title: 'Cancellation Rate', value: `${data.cancellationRate}%`, subtitle: `${data.canceledAppointments} canceled`, icon: 'fi_x_circle', colorVar: '--orange-500', bgVar: '--orange-50' },
      { title: 'No-Show Rate', value: `${data.noShowRate}%`, subtitle: `${data.noShowAppointments} no-shows`, icon: 'fi_alert_circle', colorVar: '--red-500', bgVar: '--red-50' },
      { title: 'Completed', value: data.completedAppointments.toString(), subtitle: `of ${data.totalAppointments} total`, icon: 'fi_check_circle', colorVar: '--green-600', bgVar: '--green-50' },
    ];
  }

  private buildSlotsDonut(data: IScheduleOccupancyResponse): DonutChartOptions | null {
    if (data.totalSlots === 0) return null;
    return {
      series: [data.bookedSlots, data.freeSlots],
      chart: { type: 'donut', height: 260, fontFamily: 'inherit' },
      labels: ['Booked Slots', 'Free Slots'],
      colors: ['#6366f1', '#e2e8f0'],
      legend: { position: 'bottom', fontSize: '13px', markers: { shape: 'circle' } },
      dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%`, style: { fontSize: '12px' } },
      tooltip: { y: { formatter: (val: number) => `${val} slots` } },
      plotOptions: { pie: { donut: { size: '60%', labels: { show: true, total: { show: true, label: 'Total Slots', formatter: (w: { globals: { seriesTotals: number[] } }): string => w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toString() } } } } },
      responsive: [{ breakpoint: 480, options: { chart: { height: 240 }, legend: { position: 'bottom' } } }],
    };
  }

  private buildHeatmapChart(data: IBusiestHoursResponse): HeatmapChartOptions | null {
    if (!data.data.length) return null;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let minHour = 24, maxHour = 0;
    for (const cell of data.data) {
      if (cell.value > 0) {
        if (cell.hour < minHour) minHour = cell.hour;
        if (cell.hour > maxHour) maxHour = cell.hour;
      }
    }
    if (minHour > maxHour) { minHour = 8; maxHour = 20; }
    minHour = Math.max(0, minHour - 1);
    maxHour = Math.min(23, maxHour + 1);
    const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
    const series = dayNames.map((dayName, dayIndex) => ({
      name: dayName,
      data: hours.map((hour) => {
        const cell = data.data.find((c) => c.day === dayIndex && c.hour === hour);
        return { x: `${hour}:00`, y: cell?.value ?? 0 };
      }),
    }));
    series.reverse();
    return {
      series,
      chart: { type: 'heatmap', height: 260, fontFamily: 'inherit', toolbar: { show: false } },
      xaxis: { labels: { style: { fontSize: '10px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#64748b' } } },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (val: number) => `${val} appointment${val !== 1 ? 's' : ''}` } },
      plotOptions: { heatmap: { shadeIntensity: 0.5, radius: 4, colorScale: { ranges: [{ from: 0, to: 0, color: '#f1f5f9', name: 'None' }, { from: 1, to: 3, color: '#bfdbfe', name: 'Low' }, { from: 4, to: 7, color: '#60a5fa', name: 'Medium' }, { from: 8, to: 100, color: '#2563eb', name: 'High' }] } } },
      colors: ['#2563eb'],
    };
  }
}

