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

type PeriodKey = 'week' | 'month' | 'quarter';

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

  public readonly periodOptions: Array<{ value: PeriodKey; label: string }> = [
    { value: 'week', label: 'PERF_PERIOD_WEEK' },
    { value: 'month', label: 'PERF_PERIOD_MONTH' },
    { value: 'quarter', label: 'PERF_PERIOD_QUARTER' },
  ];

  /** Payroll module is feature-gated per subscription */
  public canShowPayroll = this.subscriptionService.hasFeature('expensesPayroll');

  /** Trend bars normalized to the max revenue in range (0–100%) */
  public trendBars = computed(() => {
    const trend = this.stats()?.trend ?? [];
    const max = Math.max(...trend.map((p) => p.revenue), 1);
    return trend.map((p) => ({
      ...p,
      heightPct: Math.max(4, Math.round((p.revenue / max) * 100)),
    }));
  });

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
    this.loadData();
  }

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
      case 'week':
        from.setDate(from.getDate() - 6);
        break;
      case 'quarter':
        from.setMonth(from.getMonth() - 3);
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
