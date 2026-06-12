import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { forkJoin, of, take } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import {
  DashboardService,
  IEmployeeSelfStats,
} from '@core/services/dashboard.service';
import {
  ISelfPayroll,
  PayrollService,
} from '@core/services/payroll.service';
import { SubscriptionService } from '@core/services/subscription.service';

type PeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'halfyear' | 'year';

/**
 * Round a raw step to a "nice" 1/2/5 × 10^k value so axis labels read
 * cleanly (e.g. 20 / 50 / 100 / 200) instead of 17.5 / 35 / 70 / 140.
 */
function niceTickStep(raw: number): number {
  if (!isFinite(raw) || raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  if (norm < 1.5) return 1 * pow;
  if (norm < 3) return 2 * pow;
  if (norm < 7) return 5 * pow;
  return 10 * pow;
}

/**
 * Employee performance page: own stats (revenue, visits, top services,
 * daily trend) + payroll info (rate, accrued commission, payout status).
 */
@Component({
  selector: 'app-performance',
  templateUrl: './performance.page.html',
  styleUrls: ['./performance.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ion-page' },
})
export class PerformancePage implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly payrollService = inject(PayrollService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly t = inject(TranslateService);

  public isLoading = signal(true);
  public period = signal<PeriodKey>('month');
  public stats = signal<IEmployeeSelfStats | null>(null);
  public payroll = signal<ISelfPayroll | null>(null);
  /** Index of the bar that currently has its tooltip visible. -1 = none. */
  public activeBarIdx = signal<number>(-1);
  /** Period whose per-appointment breakdown is expanded. null = collapsed. */
  public expandedPeriodId = signal<string | null>(null);

  public readonly periodOptions: Array<{ value: PeriodKey; label: string }> = [
    { value: 'today', label: 'PERF_PERIOD_TODAY' },
    { value: 'week', label: 'PERF_PERIOD_WEEK' },
    { value: 'month', label: 'PERF_PERIOD_MONTH' },
    { value: 'quarter', label: 'PERF_PERIOD_QUARTER' },
    { value: 'halfyear', label: 'PERF_PERIOD_HALFYEAR' },
    { value: 'year', label: 'PERF_PERIOD_YEAR' },
  ];

  /** Payroll module is feature-gated per subscription */
  public canShowPayroll = this.subscriptionService.hasFeature('expensesPayroll');

  /**
   * Trend bars normalized to the day with the highest commission for the
   * period. We chart commission (the variable, performance-driven part of
   * pay) instead of gross revenue — that's what the employee feels day to
   * day. For pure-Fixed accounts we fall back to visit count so the chart
   * is not empty.
   */
  public trendBars = computed(() => {
    const trend = this.stats()?.trend ?? [];
    const rateType = this.stats()?.summary.salaryRateType ?? null;
    const useVisits = rateType === 'fixed';
    const series = trend.map((p) => ({
      label: p.label,
      visits: p.visits,
      revenue: p.revenue,
      commission: p.commission,
      barValue: useVisits ? p.visits : p.commission,
    }));
    const max = Math.max(...series.map((p) => p.barValue), 1);
    return series.map((p) => ({
      ...p,
      heightPct: p.barValue > 0
        ? Math.max(6, Math.round((p.barValue / max) * 100))
        : 0,
    }));
  });

  /**
   * 5 evenly-spaced gridlines + value labels for the trend chart Y-axis.
   * Top tick = max bar value rounded up, bottom = 0. Matches what
   * `trendBars` normalizes against so the labels line up with bar heights.
   */
  public trendAxis = computed(() => {
    const bars = this.trendBars();
    if (bars.length === 0) return { ticks: [] as number[], isCurrency: false };
    const rateType = this.stats()?.summary.salaryRateType ?? null;
    const isCurrency = rateType !== 'fixed';
    const max = Math.max(...bars.map((b) => b.barValue), 1);
    // Round the top tick to a "nice" number so labels read like $10 / $20
    // rather than $7.31. Step counts work for both small and large maxes.
    const step = niceTickStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = top; v >= 0; v -= step) ticks.push(v);
    return { ticks, isCurrency };
  });

  /** Y-axis label formatter that matches the bar's underlying unit. */
  public formatAxisTick(value: number, isCurrency: boolean): string {
    if (isCurrency) {
      return value >= 1000
        ? `$${Math.round(value / 100) / 10}k`
        : `$${Math.round(value)}`;
    }
    return String(Math.round(value));
  }

  /** Tooltip label for a bar — same logic as the axis unit. */
  public formatBarTooltip(bar: {
    label: string;
    visits: number;
    revenue: number;
    commission: number;
    barValue: number;
  }): string {
    const date = this.formatTrendLabel(bar.label);
    const lang = this.t.currentLang === 'ua' ? 'uk-UA' : 'en-US';
    const money = (n: number) =>
      n.toLocaleString(lang, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
    return `${date}: ${money(bar.commission)} · ${bar.visits} ${this.t.instant(
      'PERF_VISITS',
    )}`;
  }

  /** Top services normalized to the most frequent one */
  public topServiceBars = computed(() => {
    const services = this.stats()?.topServices ?? [];
    const max = Math.max(...services.map((s) => s.count), 1);
    return services.map((s) => ({
      ...s,
      widthPct: Math.max(6, Math.round((s.count / max) * 100)),
    }));
  });

  ngOnInit(): void {
    this.loadData();
  }

  public handleRefresh(event: CustomEvent): void {
    this.loadData(() => (event.target as HTMLIonRefresherElement).complete());
  }

  public onPeriodChange(value: PeriodKey): void {
    if (this.period() === value) return;
    this.period.set(value);
    this.isLoading.set(true);
    this.activeBarIdx.set(-1);
    this.loadData();
  }

  /** Tap a bar to surface a tooltip; tap again to dismiss. */
  public toggleBar(idx: number): void {
    this.activeBarIdx.set(this.activeBarIdx() === idx ? -1 : idx);
  }

  /**
   * The currently-tapped bar (or null when nothing selected). The chart
   * info banner reads from this — keeps the template logic-free and gives
   * us a single source of truth for the selected state.
   */
  public activeBar = computed(() => {
    const idx = this.activeBarIdx();
    if (idx < 0) return null;
    return this.trendBars()[idx] ?? null;
  });

  /**
   * Short breakdown line shown under the "What I earned" card so the
   * employee can see WHY the number is what it is (e.g. "$500 base +
   * $20 commission"). Hidden when there's no useful breakdown to show
   * (pure Fixed or pure Commission), since the card value already says it.
   */
  public earningsBreakdown = computed<string | null>(() => {
    const s = this.stats()?.summary;
    if (!s) return null;
    const lang = this.t.currentLang === 'ua' ? 'uk-UA' : 'en-US';
    const money = (n: number) =>
      n.toLocaleString(lang, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
    switch (s.salaryRateType) {
      case 'fixed_plus_commission':
        return `${money(s.baseAmount)} + ${money(s.myCommission)}`;
      case 'base_or_commission':
        return `max(${money(s.baseAmount)}, ${money(s.myCommission)})`;
      default:
        return null;
    }
  });

  public formatTrendLabel(label: string): string {
    // label = YYYY-MM-DD
    const date = new Date(`${label}T00:00:00`);
    const lang = this.t.currentLang === 'ua' ? 'uk-UA' : 'en-US';
    return date.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
  }

  public formatPeriodRange(start: string, end: string): string {
    const lang = this.t.currentLang === 'ua' ? 'uk-UA' : 'en-US';
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${new Date(start).toLocaleDateString(lang, opts)} – ${new Date(end).toLocaleDateString(lang, opts)}`;
  }

  /**
   * Day + time, used in the per-appointment breakdown list. Returns an
   * em-dash for line items whose appointment was deleted (the line item
   * survives the deletion so the employee's earnings history stays
   * intact, but we have no date to show).
   */
  public formatLineItemDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const lang = this.t.currentLang === 'ua' ? 'uk-UA' : 'en-US';
    const date = new Date(iso);
    return `${date.toLocaleDateString(lang, {
      day: 'numeric',
      month: 'short',
    })} · ${date.toLocaleTimeString(lang, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`;
  }

  /** Expand / collapse the line-item breakdown for a payroll period. */
  public toggleExpandedPeriod(id: string): void {
    this.expandedPeriodId.set(this.expandedPeriodId() === id ? null : id);
  }

  public rateTypeLabel(type: string | null): string {
    if (!type) return this.t.instant('PERF_RATE_NOT_SET');
    const key = `EMP_SALARY_${type.toUpperCase()}`;
    const translated = this.t.instant(key);
    return translated === key ? type : translated;
  }

  private rangeForPeriod(): { from: string; to: string } {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setHours(0, 0, 0, 0);

    switch (this.period()) {
      case 'today':
        // `from` already at 00:00 of today — no shift needed
        break;
      case 'week':
        from.setDate(from.getDate() - 6);
        break;
      case 'quarter':
        from.setMonth(from.getMonth() - 3);
        break;
      case 'halfyear':
        from.setMonth(from.getMonth() - 6);
        break;
      case 'year':
        from.setFullYear(from.getFullYear() - 1);
        break;
      case 'month':
      default:
        from.setMonth(from.getMonth() - 1);
        break;
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }

  private loadData(done?: () => void): void {
    const range = this.rangeForPeriod();

    forkJoin({
      stats: this.dashboardService.getEmployeeSelfStats(range),
      payroll: this.canShowPayroll
        ? this.payrollService.getSelfPayroll().pipe(
            catchError(() => of(null)),
          )
        : of(null),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ stats, payroll }) => {
          this.stats.set(stats);
          this.payroll.set(payroll);
          this.isLoading.set(false);
          done?.();
        },
        error: () => {
          this.isLoading.set(false);
          done?.();
        },
      });
  }
}
