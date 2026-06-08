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
import { filter } from 'rxjs/operators';
import { IBaseQueries } from '@core/models/application.interface';
import {
  AiAnalyticsService,
  IAiBranchStat,
  IAiComplexRequest,
  IAiDailyStats,
  IAiToolStat,
  IAiUsageSummary,
} from '@core/services/ai-analytics.service';
import { BarChartOptions, ChartOptions } from '../../models/chart.models';
import { DashboardStateService } from '../../services/dashboard-state.service';

@Component({
  standalone: true,
  selector: 'app-ai-analytics-tab',
  template: `
    <div class="tab-content">
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
              <ion-icon name="construct-outline" style="color:#6366f1"></ion-icon>
              <span class="kpi-card__title">{{ 'AI_AN_TOOL_CALLS' | translate }}</span>
            </div>
            <div class="kpi-card__value">{{ summary()!.totalToolCalls }}</div>
            <div class="kpi-card__subtitle">{{ 'AI_AN_TOOL_CALLS_SUB' | translate }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__header">
              <ion-icon name="repeat-outline" style="color:#3b82f6"></ion-icon>
              <span class="kpi-card__title">{{ 'AI_AN_AVG_ROUNDS' | translate }}</span>
            </div>
            <div class="kpi-card__value">{{ (summary()!.avgRounds || 0) | number:'1.0-1' }}</div>
            <div class="kpi-card__subtitle">{{ 'AI_AN_AVG_ROUNDS_SUB' | translate }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card__header">
              <ion-icon name="server-outline" style="color:#22c55e"></ion-icon>
              <span class="kpi-card__title">{{ 'AI_AN_TOKENS' | translate }}</span>
            </div>
            <div class="kpi-card__value">{{ formatTokens(summary()!.totalInputTokens + summary()!.totalOutputTokens) }}</div>
            <div class="kpi-card__subtitle">{{ 'AI_AN_TOKENS_SUB' | translate }}</div>
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
            [markers]="dailyChart()!.markers ?? {}"
            [tooltip]="dailyChart()!.tooltip"
            [grid]="dailyChart()!.grid"
            [colors]="dailyChart()!.colors"
          ></apx-chart>
        </div>
      }

      <!-- Branch usage chart -->
      @if (!loading() && branchChart()) {
        <div class="chart-card">
          <h3 class="chart-title">{{ 'AI_AN_BRANCHES_TITLE' | translate }}</h3>
          <apx-chart
            [series]="branchChart()!.series"
            [chart]="branchChart()!.chart"
            [xaxis]="branchChart()!.xaxis"
            [yaxis]="branchChart()!.yaxis"
            [plotOptions]="branchChart()!.plotOptions"
            [dataLabels]="branchChart()!.dataLabels"
            [tooltip]="branchChart()!.tooltip"
            [grid]="branchChart()!.grid"
            [colors]="branchChart()!.colors"
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

      <!-- Recent requests (infinite scroll) -->
      @if (!loading() && complex().length) {
        <div class="chart-card">
          <h3 class="chart-title">{{ 'AI_AN_COMPLEX_TITLE' | translate }}</h3>
          <div class="exp-list">
            @for (req of complex(); track $index) {
              <div class="exp-item">
                <div class="exp-item__top">
                  <span class="exp-item__summary">{{ req.requestSummary || ('AI_AN_REQUEST' | translate) }}</span>
                  <span class="exp-item__branch">{{ branchLabel(req) }}</span>
                </div>
                <div class="exp-item__meta">
                  {{ req.createdAt | date: 'dd.MM HH:mm' }} ·
                  {{ 'AI_AN_ROUNDS' | translate:{ count: req.rounds } }} ·
                  {{ (req.toolsUsed || []).length }} {{ 'AI_AN_TOOLS_LABEL' | translate }}
                </div>
              </div>
            }
          </div>

          <ion-infinite-scroll
            [disabled]="!hasMoreComplex()"
            (ionInfinite)="onComplexInfinite($event)"
          >
            <ion-infinite-scroll-content loadingSpinner="crescent"></ion-infinite-scroll-content>
          </ion-infinite-scroll>
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
    .exp-item__top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
    .exp-item__summary { font-size: 13px; color: var(--ion-text-color); flex: 1; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
    .exp-item__branch { font-size: 11px; font-weight: 600; color: var(--bk-orange-500, #ff7407); flex-shrink: 0; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .exp-item__meta { font-size: 11px; color: var(--ion-color-medium); margin-top: 4px; }
  `],
  imports: [CommonModule, IonicModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAnalyticsTabComponent implements OnInit {
  private analytics = inject(AiAnalyticsService);
  private state = inject(DashboardStateService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private t = inject(TranslateService);

  public loading = signal(true);
  public summary = signal<IAiUsageSummary | null>(null);
  public complex = signal<IAiComplexRequest[]>([]);
  public hasMoreComplex = signal(true);
  public dailyChart = signal<ChartOptions | null>(null);
  public toolsChart = signal<BarChartOptions | null>(null);
  public branchChart = signal<BarChartOptions | null>(null);

  // Infinite-scroll paging for the recent-requests list (offset/limit).
  private complexOffset = 0;
  private readonly complexLimit = 15;
  private currentFilter: IBaseQueries = {};

  public ngOnInit(): void {
    this.state.filtersChanged$
      .pipe(
        filter((f): f is IBaseQueries => f !== null && !!f['from']),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((f) => this.load(f));
  }

  public formatTokens(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  }

  public branchLabel(b: {
    _id?: string;
    name?: string;
    departmentId?: string;
    departmentName?: string;
  }): string {
    const id = b._id || b.departmentId;
    const explicit = b.name || b.departmentName;
    return explicit || this.deptName(id) || id || this.t.instant('AI_AN_ADMIN');
  }

  /** Resolve a branch name from the dashboard's loaded departments list. */
  private deptName(id?: string): string {
    if (!id) {
      return '';
    }
    const list =
      (this.state.departments() as { results?: { _id: string; name: string }[] } | null)
        ?.results ?? [];
    return list.find((d) => d._id === id)?.name ?? '';
  }

  private load(f: IBaseQueries): void {
    this.loading.set(true);
    this.currentFilter = f;
    const q = { from: f.from, to: f.to, branchIds: f.departmentId };

    this.analytics.getSummary(q).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); this.cdr.markForCheck(); },
      error: () => { this.loading.set(false); this.cdr.markForCheck(); },
    });
    this.analytics.getDaily(q).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((d) => { this.buildDailyChart(d ?? []); this.cdr.markForCheck(); });
    this.analytics.getTools(q).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((d) => { this.buildToolsChart(d ?? []); this.cdr.markForCheck(); });
    this.analytics.getBranches(q).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((d) => { this.buildBranchChart(d ?? []); this.cdr.markForCheck(); });

    // Recent requests: reset and load the first page; more pages append via scroll.
    this.complex.set([]);
    this.complexOffset = 0;
    this.hasMoreComplex.set(true);
    this.fetchComplexPage();
  }

  private fetchComplexPage(event?: CustomEvent): void {
    const f = this.currentFilter;
    const q = { from: f.from, to: f.to, branchIds: f.departmentId };
    this.analytics
      .getComplex(q, this.complexOffset, this.complexLimit)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const results = res?.results ?? [];
          this.complex.update((prev) => [...prev, ...results]);
          this.complexOffset += results.length;
          this.hasMoreComplex.set(this.complex().length < (res?.count ?? 0));
          this.cdr.markForCheck();
          (event?.target as { complete?: () => void } | undefined)?.complete?.();
        },
        error: () => {
          this.hasMoreComplex.set(false);
          this.cdr.markForCheck();
          (event?.target as { complete?: () => void } | undefined)?.complete?.();
        },
      });
  }

  public onComplexInfinite(event: Event): void {
    if (!this.hasMoreComplex()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    this.fetchComplexPage(event as CustomEvent);
  }

  /** Trim long branch names/ids for compact chart labels. */
  private shortLabel(label: string): string {
    return label.length > 14 ? `${label.slice(0, 13)}…` : label;
  }

  private buildDailyChart(data: IAiDailyStats[]): void {
    if (!data.length) { this.dailyChart.set(null); return; }
    this.dailyChart.set({
      series: [{ name: this.t.instant('AI_AN_REQUESTS'), data: data.map((x) => x.requests) }],
      chart: { type: 'area', height: 260, fontFamily: 'inherit', toolbar: { show: false }, zoom: { enabled: false } },
      colors: ['#6366f1'],
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
      dataLabels: { enabled: false },
      markers: { size: data.length <= 2 ? 6 : 4, strokeWidth: 2, strokeColors: '#fff', hover: { sizeOffset: 3 } },
      xaxis: { categories: data.map((x) => (x._id || '').slice(5)), labels: { style: { fontSize: '10px', colors: '#94a3b8' }, rotate: -45, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '10px', colors: '#94a3b8' } } },
      tooltip: { shared: true },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    });
  }

  private buildToolsChart(data: IAiToolStat[]): void {
    const top = data.slice(0, 10);
    if (!top.length) { this.toolsChart.set(null); return; }
    this.toolsChart.set({
      series: [{ name: this.t.instant('AI_AN_CALLS'), data: top.map((tl) => tl.count) }],
      chart: { type: 'bar', height: Math.max(220, top.length * 34 + 50), fontFamily: 'inherit', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, barHeight: '64%', borderRadius: 4 } },
      colors: ['#6366f1'],
      dataLabels: { enabled: true, formatter: (v: number) => `${v}`, style: { fontSize: '11px', colors: ['#334155'] }, offsetX: 4 },
      xaxis: { categories: top.map((tl) => this.shortLabel(tl._id)), labels: { style: { fontSize: '10px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#334155' }, align: 'left', maxWidth: 104 } },
      tooltip: { y: { formatter: (v: number) => `${v}` }, x: { formatter: (_v: number, opts?: { dataPointIndex: number }) => top[opts?.dataPointIndex ?? 0]?._id ?? '' } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, padding: { left: 0 } },
    });
  }

  private buildBranchChart(data: IAiBranchStat[]): void {
    if (!data.length) { this.branchChart.set(null); return; }
    this.branchChart.set({
      series: [{ name: this.t.instant('AI_AN_REQUESTS'), data: data.map((b) => b.requests) }],
      chart: { type: 'bar', height: Math.max(200, data.length * 40 + 50), fontFamily: 'inherit', toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 4 } },
      colors: ['#22c55e'],
      dataLabels: { enabled: true, formatter: (v: number) => `${v}`, style: { fontSize: '11px', colors: ['#334155'] }, offsetX: 4 },
      xaxis: { categories: data.map((b) => this.shortLabel(this.branchLabel(b))), labels: { style: { fontSize: '10px', colors: '#94a3b8' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { fontSize: '11px', colors: '#334155' }, maxWidth: 104, align: 'left' } },
      tooltip: { y: { formatter: (v: number) => `${v}` }, x: { formatter: (_v: number, opts?: { dataPointIndex: number }) => this.branchLabel(data[opts?.dataPointIndex ?? 0] ?? {}) } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4, padding: { left: 0 } },
    });
  }
}
