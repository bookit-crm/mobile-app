import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DepartmentService } from '@core/services/department.service';
import { EmployeeService, IEmployeeList } from '@core/services/employee.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { WebsocketService } from '@core/services/websocket.service';
import { IBaseQueries, IKeyValuePair } from '@core/models/application.interface';
import { IDepartment, IDepartmentList } from '@core/models/department.interface';
import { IEmployee } from '@core/models/employee.interface';
import { EUserRole } from '@core/enums/e-user-role';
import { BehaviorSubject, take } from 'rxjs';

@Injectable()
export class DashboardStateService {
  private departmentService = inject(DepartmentService);
  private employeeService = inject(EmployeeService);
  private subscriptionService = inject(SubscriptionService);
  private supervisorService = inject(SupervisorService);
  private websocketService = inject(WebsocketService);
  private destroyRef = inject(DestroyRef);

  private liveUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly LIVE_UPDATE_DEBOUNCE_MS = 3000;

  constructor() {
    effect(() => {
      const update = this.websocketService.dashboardUpdateSignal();
      if (update && this.initialized) {
        this.debouncedLiveRefresh();
      }
    });
  }

  // Filter signals
  public selectedDatePreset = signal<string>('this_month');
  public customFrom = signal<string | null>(null);
  public customTo = signal<string | null>(null);
  public selectedDepartments = signal<IDepartment[]>([]);
  public selectedEmployees = signal<IEmployee[]>([]);

  public readonly datePresets: IKeyValuePair[] = [
    { value: 'this_month',   display: 'This Month' },
    { value: 'last_month',   display: 'Last Month' },
    { value: 'last_3_months', display: 'Last 3 Months' },
    { value: 'last_6_months', display: 'Last 6 Months' },
    { value: 'last_year',    display: 'Last Year' },
    { value: 'custom',       display: 'Custom' },
  ];

  // Supervisor role helpers
  public readonly isManager = computed(
    () => this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER,
  );

  /** Скрывает департамент-фильтр (менеджер или solo-plan). */
  public readonly singleDepartmentMode = computed(
    () =>
      this.isManager() ||
      this.subscriptionService.isSingleLocationPlan(),
  );

  /** Effectve dept id для auto-filter (manager или single-loc). */
  public readonly effectiveDepartmentId = computed<string | null>(() => {
    const user = this.supervisorService.authUserSignal();
    if (!user) return null;
    if (this.isManager()) {
      const dept = user.department;
      return typeof dept === 'string' ? dept : dept?._id ?? null;
    }
    // single-loc owner — use first department from loaded list
    const depts = this.departments()?.results;
    return depts?.length ? depts[0]._id : null;
  });

  public readonly isSoloPlan = this.subscriptionService.isSoloPlan;

  public departments = signal<IDepartmentList | null>(null);
  public employees = signal<IEmployeeList | null>(null);

  public readonly employeeOptions = computed(() => {
    const list = this.employees();
    return list
      ? {
          ...list,
          results: list.results.map((el) => ({
            ...el,
            fullName: `${el.firstName} ${el.lastName}`,
          })),
        }
      : null;
  });

  // Emits whenever filters change — tab components subscribe
  // BehaviorSubject ensures late subscribers (child components) get the last value immediately
  public filtersChanged$ = new BehaviorSubject<IBaseQueries | null>(null);

  // Current filters as signal
  public filters = signal<IBaseQueries>({});

  private initialized = false;

  public get isCustomDateSelected(): boolean {
    return this.selectedDatePreset() === 'custom';
  }

  public init(): void {
    if (this.initialized) {
      this.filtersChanged$.next(this.filters());
      return;
    }
    this.initialized = true;

    if (!this.singleDepartmentMode()) {
      this.loadDepartments();
    }
    // Загружаем всех сотрудников сразу — для опции "All Employees" в фильтрах
    this.loadEmployees([]);

    const f = this.buildFilters();
    this.filters.set(f);
    this.filtersChanged$.next(f);
  }

  public applyFilters(): void {
    const f = this.buildFilters();
    this.filters.set(f);
    this.filtersChanged$.next(f);
  }

  public setDatePreset(preset: string): void {
    this.selectedDatePreset.set(preset);
    this.applyFilters();
  }

  public setCustomRange(from: string, to: string): void {
    this.customFrom.set(from);
    this.customTo.set(to);
    this.applyFilters();
  }

  public setDepartments(depts: IDepartment[]): void {
    this.selectedDepartments.set(depts);
    this.selectedEmployees.set([]);
    this.loadEmployees(depts);
    this.applyFilters();
  }

  public setEmployees(emps: IEmployee[]): void {
    this.selectedEmployees.set(emps);
    this.applyFilters();
  }

  // Helpers

  private debouncedLiveRefresh(): void {
    if (this.liveUpdateTimer) {
      clearTimeout(this.liveUpdateTimer);
    }
    this.liveUpdateTimer = setTimeout(() => {
      this.liveUpdateTimer = null;
      this.filtersChanged$.next(this.filters());
    }, DashboardStateService.LIVE_UPDATE_DEBOUNCE_MS);
  }

  public determineGranularity(from: string, to: string): 'daily' | 'monthly' {
    const diffMs = new Date(to).getTime() - new Date(from).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 62 ? 'monthly' : 'daily';
  }

  public formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  public formatMonthLabel(label: string): string {
    const [year, month] = label.split('-');
    const date = new Date(+year, +month - 1);
    return date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
  }

  public formatDayLabel(label: string): string {
    const [year, month, day] = label.split('-');
    const date = new Date(+year, +month - 1, +day);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  }

  // Private

  private buildFilters(): IBaseQueries {
    const { from, to } = this.getDateRange();
    const depts = this.selectedDepartments();
    const emps = this.selectedEmployees();

    const filters: IBaseQueries = { from, to };

    if (depts.length) {
      filters.departmentId = depts.map((d) => d._id).join(',');
    } else if (this.singleDepartmentMode()) {
      const deptId = this.effectiveDepartmentId();
      if (deptId) {
        filters.departmentId = deptId;
      }
    }

    if (emps.length) {
      filters.employeeIds = emps.map((e) => e._id);
    }

    return filters;
  }

  private getDateRange(): { from: string; to: string } {
    const preset = this.selectedDatePreset();
    const now = new Date();

    if (preset === 'custom' && this.customFrom() && this.customTo()) {
      return {
        from: new Date(this.customFrom()!).toISOString(),
        to: new Date(this.customTo()!).toISOString(),
      };
    }

    let from: Date;
    let to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    switch (preset) {
      case 'last_month':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'last_3_months':
        from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last_6_months':
        from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'last_year':
        from = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'this_month':
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }

  private loadDepartments(): void {
    this.departmentService
      .getDepartments({ limit: 100 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((resp) => this.departments.set(resp));
  }

  private loadEmployees(departments: IDepartment[]): void {
    // Пустой массив = загрузить всех сотрудников (без фильтра по департаменту)
    const params: Record<string, unknown> = { limit: 100 };
    if (departments.length) {
      params['departmentId'] = departments.map((d) => d._id).join(',');
    }
    this.employeeService
      .getEmployees(params as any)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((resp) => this.employees.set(resp));
  }
}

