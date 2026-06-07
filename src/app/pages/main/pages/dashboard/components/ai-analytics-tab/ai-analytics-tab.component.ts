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
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import {
  AiAnalyticsService,
  IAiDailyStats,
  IAiExpensiveRequest,
  IAiToolStat,
  IAiUsageSummary,
} from '@core/services/ai-analytics.service';
import { BarChartOptions, ChartOptions } from '../../models/chart.models';

@Component({
  standalone: true,
  selector: 'app-ai-analytics-tab',
  template: `
    <div class="tab-content">
      <!-- Range selector -->
      <div class="range-row">
        @for (d of ranges; track d) {
          <ion-chip
            [class.range-active]="days() === d"
            (click)="setDays(d)"
          >{{ ('AI_AN_DAYS' | translate:{ count: d }) }}</ion-chip>
        }
      </div>

      <!-- KPI cards -->
      @if (loading()) {
        <div class="skeleton-cards">
          <ion-skeleton-text [animated]="true" style="height:80px;border-radius:12px;margin-bottom:12px"></ion-skeleton-text>
          <ion-skeleton-text [animated]="true" style="height:80px;border-radius:12px"></ion-skeleton-text>
        </div>
      } @else if (summary()) {
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-card__header">
              <ion-icon name="sparkles-outline" style="color:var(--bk-orange-500,#ff7407)"></ion-icon>
              <span class="kpi-card__title">{{ 'AI_AN_REQUESTS' | translate }}</span>
            </div>
            <div class="kpi-card__value">{{ summary()!.totalRequests }}</div>
            <div class="kpi-card__subtitle">{{ 'AI_AN_REQUESTS_SUB' | translate }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__header">
              <ion-icon name="cash-outline" style="color:#22c55e"></ion-icon>
              <span class="kpi-card__title">{{ 'AI_AN_COST' | translate }}</span>
            </div>
            <div class="kpi-card__value">{{ formatCost(summary()!.totalCostUSD) }}</div>
            <div class="kpi-card__subtitle">{{ 'AI_AN_COST_SUB' | translate }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__header">
              <ion-icon name="pulse-outline" style="color:#6366f1"></ion-icon>
              <span class="kpi-card__title">{{ 'AI_AN_AVG_COST' | translate }}</span>
            </div>
            <div class="kpi-card__value">{{ formatCost(summary()!.avgCostUSD) }}</div>
            <div class="kpi-card__subtitle">{{ 'AI_AN_AVG_COST_SUB' | translate }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__header">
              <ion-icon name="repeat-outline" style="color:#3b82f6"></ion-icon>
              <span class="kpi-card__title">{{ 'AI_AN_AVG_ROUNDS' | translate }}</span>
            </div>
            <div class="kpi-card__value">{{ (summary()!.avgRounds || 0) | number:'1.0-1' }}</div>
            <div class="kpi-card__subtitle">{{ 'AI_AN_AVG_ROUNDS_SUB' | translate }}</div>
          </div>
        </div>
      }

      <!-- Empty state -->
      @if (!loading() && summary() && summary()!.totalRequests === 0) {
        <div class="ai-empty">
          <ion-icon name="sparkles-outline"></ion-icon>
          <p>{{ 'AI_AN_EMPTY' | translate }}</p>
        </div>
      }

      <!-- Daily chart -->
      @if (!loading() && dailyChart()) {
        <div class="chart-card">
          <h3 class="chart-title">{{ 'AI_AN_DAILY_TITLE' | translate }}</h3>
          <apx-chart
            [series]="dailyChart()!.series"
            [chart]="dailyChart()!.chart"
            [xaxis]="dailyChart()!.xaxis"
            [yaxis]="dailyChart()!.yaxis"
            [stroke]="dailyChart()!.stroke"
            [fill]="dailyChart()!.fill"
            [dataLabels]="dailyChart()!.dataLabels"
            [tooltip]="dailyChart()!.tooltip"
            [grid]="dailyChart()!.grid"
            [colors]="dailyChart()!.colors"
          ></apx-chart>
        </div>
      }

      <!-- Tools chart -->
      @if (!loading() && toolsChart()) {
        <div class="chart-card">
          <h3 class="chart-title">{{ 'AI_AN_TOOLS_TITLE' | translate }}</h3>
          <apx-chart
            [series]="toolsChart()!.series"
            [chart]="toolsChart()!.chart"
            [xaxis]="toolsChart()!.xaxis"
            [yaxis]="toolsChart()!.yaxis"
            [plotOptions]="toolsChart()!.plotOptions"
            [dataLabels]="toolsChart()!.dataLabels"
            [tooltip]="toolsChart()!.tooltip"
            [grid]="toolsChart()!.grid"
            [colors]="toolsChart()!.colors"
          ></apx-chart>
        </div>
      }

      <!-- Most expensive requests -->
      @if (!loading() && expensive().length) {
        <div class="chart-card">
          <h3 class="chart-title">{{ 'AI_AN_EXPENSIVE_TITLE' | translate }}</h3>
          <div class="exp-list">
            @for (req of expensive(); track $index) {
              <div class="exp-item">
                <div class="exp-item__top">
                  <span class="exp-item__summary">{{ req.requestSummary || ('AI_AN_REQUEST' | translate) }}</span>
                  <span class="exp-item__cost">{{ formatCost(req.costUSD) }}</span>
                </div>
                <div class="exp-item__meta">
                  {{ 'AI_AN_ROUNDS' | translate:{ count: req.rounds } }} ·
                  {{ req.toolsUsed?.length || 0 }} {{ 'AI_AN_TOOLS_LABEL' | translate }}
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .tab-content { padding: 0 4px 24px; }
    .range-row { display: flex; gap: 8px; margin-bottom: 14px; }
    .range-row ion-chip { --background: var(--ion-color-light); }
    .range-row .range-active { --background: var(--bk-orange-500, #ff7407); --color: #fff; font-weight: 600; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .kpi-card { background: var(--ion-card-background, #fff); border-radius: 12px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .kpi-card__header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .kpi-card__header ion-icon { font-size: 18px; }
    .kpi-card__title { font-size: 12px; color: var(--ion-color-medium); font-weight: 500; }
    .kpi-card__value { font-size: 20px; font-weight: 700; margin-bottom: 4px; color: var(--ion-text-color); }
    .kpi-card__subtitle { font-size: 11px; color: var(--ion-color-medium); }
    .chart-card { background: var(--ion-card-background, #fff); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .chart-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--ion-text-color); }
    .skeleton-cards { margin-bottom: 16px; }
    .ai-empty { text-align: center; padding: 32px 16px; color: var(--ion-color-medium); }
    .ai-empty ion-icon { font-size: 44px; margin-bottom: 10px; opacity: .5; }
    .ai-empty p { margin: 0; font-size: 14px; }
    .exp-list { display: flex; flex-direction: column; gap: 10px; }
    .exp-item { border: 1px solid var(--ion-color-light-shade, #e5e7eb); border-radius: 10px; padding: 10px 12px; }
    .exp-item__top { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
    .exp-item__summary { font-size: 13px; color: var(--ion-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .exp-item__cost { font-size: 13px; font-weight: 700; color: #22c55e; flex-shrink: 0; }
    .exp-item__meta { font-size: 11px; color: var(--ion-color-medium); margin-top: 4px; }
  `],
  imports: [CommonModule, IonicModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAnalyticsTabComponent implements OnInit {
  private analytics = inject(AiAnalyticsService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  public readonly ranges = [7, 30, 90];
  public loading = signal(true);
  public days = signal(30);

  public summary = signal<IAiUsageSummary | null>(null);
  public expensive = signal<IAiExpensiveRequest[]>([]);
  public dailyChart = signal<ChartOptions | null>(null);
  public toolsChart = signal<BarChartOptions | null>(null);

  public ngOnInit(): void {
    this.load();
  }

  public setDays(d: number): void {
    if (this.days() === d) return;
    this.days.set(d);
    this.load();
  }

  public formatCost(v: number): string {
    if (!v) return '$0';
    if (v < 0.001) return `$${(v * 1000).toFixed(3)}m`;
    return `$${v.toFixed(4)}`;
  }

  private load(): void {
    this.loading.set(true);
    const d = this.days();
    forkJoin({
      summary: this.analytics.getSummary(d),
      daily: this.analytics.getDaily(d),
      tools: this.analytics.getTools(d),
      expensive: this.analytics.getExpensive(d),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.summary.set(res.summary);
          this.expensive.set((res.expensive ?? []).slice(0, 5));
          this.buildDailyChart(res.daily ?? []);
          this.buildToolsChart(res.tools ?? []);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private buildDailyChart(data: IAiDailyStats[]): void {
    if (!data.length) {
      this.dailyChart.set(null);
      return;
    }
    this.dailyChart.set({
      series: [
        { name: 'Cost ($)', data: data.map((x) => +x.costUSD.toFixed(4)) },
        { name: 'Requests', data: data.map((x) => x.requests) },
      ],
      chart: { type: 'area', height: 260, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } },
      colors: ['#6366f1', '#22c55e'],
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: data.map((x) => x._id?.slice(5) ?? ''),
        labels: { style: { fontSize: '10px', colors: '#94a3b8' }, rotate: -45, hideOverlappingLabels: true },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { style: { fontSize: '10px', colors: '#94a3b8' } } },
      tooltip: { shared: true },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    });
  }

  private buildToolsChart(data: IAiToolStat[]): void {
    const top = data.slice(0, 10);
    if (!top.length) {
      this.toolsChart.set(null);
      return;
    }
    this.toolsChart.set({
      series: [{ name: 'Calls', data: top.map((t) => t.count) }],
      chart: { type: 'bar', height: Math.max(220, top.length * 34 + 50), fontFamily: 'inherit', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, barHeight: '64%', borderRadius: 4 } },
      colors: ['#6366f1'],
      dataLabels: { enabled: true, formatter: (v: number) => `${v}`, style: { fontSize: '11px', colors: ['#334155'] }, offsetX: 4 },
      xaxis: { categories: top.map((t) => t._id), labels: { style: { fontSize: '10px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#334155' }, maxWidth: 140 } },
      tooltip: {
        y: {
          formatter: (v: number, o: { dataPointIndex?: number } = {}): string => {
            const item = top[o?.dataPointIndex ?? -1];
            return `${v} · $${(item?.totalCostUSD ?? 0).toFixed(4)}`;
          },
        },
      },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    });
  }
}
