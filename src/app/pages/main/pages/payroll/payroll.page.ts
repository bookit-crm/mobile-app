import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { take } from 'rxjs';
import { EPayrollPeriodStatus } from '@core/enums/e-payroll';
import { EUserRole } from '@core/enums/e-user-role';
import { IPayrollPeriod, IMonthStatus } from '@core/models/payroll.interface';
import { PayrollService } from '@core/services/payroll.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { DepartmentService } from '@core/services/department.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { CreatePeriodsModalComponent } from './components/create-periods-modal/create-periods-modal.component';
import { PayrollDetailComponent } from './components/payroll-detail/payroll-detail.component';
import { TranslateService } from '@ngx-translate/core';

const MONTH_KEYS = [
  'PAY_MONTH_JAN', 'PAY_MONTH_FEB', 'PAY_MONTH_MAR', 'PAY_MONTH_APR',
  'PAY_MONTH_MAY', 'PAY_MONTH_JUN', 'PAY_MONTH_JUL', 'PAY_MONTH_AUG',
  'PAY_MONTH_SEP', 'PAY_MONTH_OCT', 'PAY_MONTH_NOV', 'PAY_MONTH_DEC',
];

@Component({
  selector: 'app-payroll',
  templateUrl: './payroll.page.html',
  styleUrls: ['./payroll.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayrollPage implements OnInit {
  private readonly payrollService = inject(PayrollService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly departmentService = inject(DepartmentService);
  public readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  public readonly EPayrollPeriodStatus = EPayrollPeriodStatus;

  public get MONTH_NAMES(): string[] {
    return MONTH_KEYS.map((k) => this.t.instant(k));
  }

  // ── Feature gate ──────────────────────────────────────────────────────────
  public readonly hasPayrollFeature = computed(() =>
    this.subscriptionService.hasFeature('expensesPayroll'),
  );

  // ── Permissions ──────────────────────────────────────────────────────────
  public get isManager(): boolean {
    return this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER;
  }

  public readonly singleDepartmentMode = computed(() => this.supervisorService.singleDepartmentMode());
  public readonly departments = computed(() => this.departmentService.departmentsSignal()?.results ?? []);

  // ── Month / Year navigator ────────────────────────────────────────────────
  public selectedMonth = signal<number>(new Date().getMonth());
  public selectedYear = signal<number>(new Date().getFullYear());
  public monthStatuses = signal<IMonthStatus[]>([]);

  // ── Filters ───────────────────────────────────────────────────────────────
  public showFilterSheet = signal(false);
  public tempStatus = signal<EPayrollPeriodStatus | ''>('');
  public tempDepartmentId = signal('');
  public filterStatus = signal<EPayrollPeriodStatus | ''>('');
  public filterDepartmentId = signal('');

  public readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (this.filterStatus()) n++;
    if (this.filterDepartmentId()) n++;
    return n;
  });

  public get statusOptions(): { value: EPayrollPeriodStatus | ''; label: string }[] {
    return [
      { value: '', label: this.t.instant('PAY_STATUS_ALL') },
      { value: EPayrollPeriodStatus.Open, label: this.t.instant('PAY_STATUS_OPEN') },
      { value: EPayrollPeriodStatus.Paid, label: this.t.instant('PAY_STATUS_PAID') },
      { value: EPayrollPeriodStatus.Reversed, label: this.t.instant('PAY_STATUS_REVERSED') },
    ];
  }

  // ── List state ────────────────────────────────────────────────────────────
  public periods = signal<IPayrollPeriod[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public offset = signal(0);
  public hasMore = signal(true);
  private readonly LIMIT = 25;

  ngOnInit(): void {
    if (!this.singleDepartmentMode()) {
      this.loadDepartmentsIfNeeded();
    }
    this.loadMonthStatuses(this.selectedYear());
    this.resetAndLoad();
  }

  ionViewWillEnter(): void {
    // Reload on subsequent navigation (e.g. returning from another page)
    if (this.periods().length > 0 || !this.isLoading()) {
      this.resetAndLoad();
    }
  }

  // ── Month / Year navigation ───────────────────────────────────────────────
  public prevYear(): void {
    this.selectedYear.update((y) => y - 1);
    this.loadMonthStatuses(this.selectedYear());
    this.resetAndLoad();
  }

  public nextYear(): void {
    this.selectedYear.update((y) => y + 1);
    this.loadMonthStatuses(this.selectedYear());
    this.resetAndLoad();
  }

  public selectMonth(index: number): void {
    this.selectedMonth.set(index);
    this.resetAndLoad();
  }

  public getMonthStatus(index: number): string[] {
    // API returns month as 0-indexed (0=Jan, 3=Apr) matching JS Date.getMonth()
    return this.monthStatuses().find((m) => m.month === index)?.statuses ?? [];
  }

  public monthChipColor(index: number): string {
    const statuses = this.getMonthStatus(index);
    if (statuses.includes(EPayrollPeriodStatus.Open)) return 'warning';
    if (statuses.includes(EPayrollPeriodStatus.Paid)) return 'success';
    return 'medium';
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  public openFilterSheet(): void {
    this.tempStatus.set(this.filterStatus());
    this.tempDepartmentId.set(this.filterDepartmentId());
    this.showFilterSheet.set(true);
  }

  public applyFilters(): void {
    this.filterStatus.set(this.tempStatus());
    this.filterDepartmentId.set(this.tempDepartmentId());
    this.showFilterSheet.set(false);
    this.resetAndLoad();
  }

  public resetFilters(): void {
    this.tempStatus.set('');
    this.tempDepartmentId.set('');
    this.filterStatus.set('');
    this.filterDepartmentId.set('');
    this.showFilterSheet.set(false);
    this.resetAndLoad();
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  public async openViewDetail(period: IPayrollPeriod, event?: Event): Promise<void> {
    event?.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: PayrollDetailComponent,
      componentProps: { periodId: period._id },
    });
    await modal.present();
    await modal.onWillDismiss();
    this.resetAndLoad();
  }

  public async confirmDelete(period: IPayrollPeriod, event: Event): Promise<void> {
    event.stopPropagation();
    const staff = period.employee || period.supervisor;
    const name = `${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim();
    const alert = await this.alertCtrl.create({
      header: this.t.instant('PAY_DELETE_TITLE'),
      message: this.t.instant('PAY_DELETE_MSG', { name }),
      buttons: [
        { text: this.t.instant('PAY_CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('PAY_DELETE'),
          role: 'destructive',
          handler: () => this.deletePeriod(period._id),
        },
      ],
    });
    await alert.present();
  }

  public async openCreatePeriodsModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CreatePeriodsModalComponent,
      componentProps: {
        month: this.selectedMonth(),
        year: this.selectedYear(),
      },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) {
      this.resetAndLoad();
      this.loadMonthStatuses(this.selectedYear());
    }
  }

  // ── Infinite scroll ───────────────────────────────────────────────────────
  public onInfiniteScroll(event: Event): void {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    this.offset.update((o) => o + this.LIMIT);
    this.loadPeriods(false, event as CustomEvent & { target: { complete: () => void } });
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  public getStaffName(period: IPayrollPeriod): string {
    const staff = period.employee || period.supervisor;
    if (!staff) return '—';
    return `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim();
  }

  public getDeptName(period: IPayrollPeriod): string {
    const staff = period.employee || period.supervisor;
    if (!staff) return '—';
    const dept = (staff as { department?: { name: string } | string | null }).department;
    if (!dept) return '—';
    return typeof dept === 'string' ? dept : dept.name;
  }

  public periodStatusColor(status: EPayrollPeriodStatus): string {
    if (status === EPayrollPeriodStatus.Paid) return 'success';
    if (status === EPayrollPeriodStatus.Reversed) return 'medium';
    return 'warning';
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private resetAndLoad(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.periods.set([]);
    this.loadPeriods(true);
  }

  private loadPeriods(
    reset = false,
    scrollEvent?: CustomEvent & { target: { complete: () => void } },
  ): void {
    this.isLoading.set(true);

    const month = this.selectedMonth();
    const year = this.selectedYear();
    // Use UTC dates to avoid local-timezone offset shifting the range over month boundaries
    const dateFrom = new Date(Date.UTC(year, month, 1)).toISOString();
    const dateTo = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();

    const filters: Record<string, unknown> = {
      limit: this.LIMIT,
      offset: this.offset(),
      dateFrom,
      dateTo,
    };

    if (this.filterStatus()) filters['status'] = this.filterStatus();

    if (this.singleDepartmentMode()) {
      const deptId = this.supervisorService.effectiveDepartmentId();
      if (deptId) filters['departmentId'] = deptId;
    } else if (this.filterDepartmentId()) {
      filters['departmentId'] = this.filterDepartmentId();
    }

    this.payrollService
      .getPeriods(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const incoming = res.results ?? [];
          this.periods.update((cur) => (reset ? incoming : [...cur, ...incoming]));
          this.totalCount.set(res.count ?? 0);
          this.hasMore.set(this.periods().length < (res.count ?? 0));
          this.isLoading.set(false);
          scrollEvent?.target.complete();
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          scrollEvent?.target.complete();
          this.cdr.markForCheck();
        },
      });
  }

  private loadMonthStatuses(year: number): void {
    this.payrollService
      .getMonthStatuses(year)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.monthStatuses.set(res);
        this.cdr.markForCheck();
      });
  }

  private deletePeriod(id: string): void {
    this.payrollService
      .deleteOpenPeriod(id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async () => {
          const toast = await this.toastCtrl.create({ message: this.t.instant('PAY_PERIOD_DELETED'), duration: 2000, color: 'success' });
          await toast.present();
          this.resetAndLoad();
          this.loadMonthStatuses(this.selectedYear());
        },
      });
  }

  private loadDepartmentsIfNeeded(): void {
    if (!this.departmentService.departmentsSignal()) {
      this.departmentService
        .getDepartments({ limit: 50 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }
}
