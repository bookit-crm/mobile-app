import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, computed,
  DestroyRef, effect, inject, NgZone, OnInit, signal, untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { format, parse, startOfWeek, endOfWeek } from 'date-fns';
import { uk, enUS } from 'date-fns/locale';
import { map, startWith } from 'rxjs/operators';
import { BehaviorSubject, take } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { IAppointment, AppointmentStatus, INewAppointmentPayload } from '@core/models/appointment.interface';
import { IEmployee } from '@core/models/employee.interface';
import { ISchedule, IScheduleQueries } from '@core/models/schedule.interface';
import { IDepartment } from '@core/models/department.interface';
import { SchedulerViewType } from '@core/models/calendar.interface';
import { EUserRole } from '@core/enums/e-user-role';
import { IDragDropResult } from './utils/calendar-utils';
import { AppointmentsService } from '@core/services/appointments.service';
import { EmployeeService } from '@core/services/employee.service';
import { SchedulesService } from '@core/services/schedules.service';
import { DepartmentService } from '@core/services/department.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { WebsocketService } from '@core/services/websocket.service';
import { DateFnsHelper } from '@core/helpers/date-fns.helper';
import {
  CalendarFiltersModalComponent,
  ICalendarFilterResult,
} from './components/calendar-filters-modal/calendar-filters-modal.component';
import {
  AppointmentModalComponent,
  IAppointmentModalPayload,
} from '@core/components/appointment-modal/appointment-modal.component';
import { AppointmentViewModalComponent } from '@core/components/appointment-view-modal/appointment-view-modal.component';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.page.html',
  styleUrls: ['./calendar.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly employeeService = inject(EmployeeService);
  private readonly schedulesService = inject(SchedulesService);
  private readonly departmentService = inject(DepartmentService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly modalCtrl = inject(ModalController);
  private readonly websocketService = inject(WebsocketService);
  private readonly t = inject(TranslateService);

  private readonly currentLang = toSignal(
    this.t.onLangChange.pipe(
      map((e) => e.lang),
      startWith(this.t.currentLang),
    ),
    { initialValue: this.t.currentLang },
  );

  constructor() {
    // Real-time: новый appointment пришёл по WebSocket → добавляем в список,
    // если попадает в текущий range / департамент. Аналог desktop-логики.
    effect(() => {
      const appt = this.websocketService.newAppointmentSignal();
      if (!appt) return;
      untracked(() => this.handleRealtimeAppointment(appt));
    });

    // Real-time: backend эмитит DashboardUpdate на любой create/patch/delete
    // приёма (в т.ч. с другого устройства). Дебаунсим и перезагружаем
    // текущий диапазон — это покрывает move/edit/cancel/delete.
    effect(() => {
      const update = this.websocketService.dashboardUpdateSignal();
      if (!update) return;
      untracked(() => this.scheduleRealtimeReload());
    });
  }

  private realtimeReloadTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleRealtimeReload(): void {
    if (this.realtimeReloadTimer) clearTimeout(this.realtimeReloadTimer);
    this.realtimeReloadTimer = setTimeout(() => {
      this.realtimeReloadTimer = null;
      this.ngZone.run(() => this.silentReloadAppointments());
    }, 800);
  }

  /** Тихий fetch без очистки списка и без isLoading — чтобы UI не моргал
   *  скелетонами при real-time апдейтах с другого устройства. */
  private silentReloadAppointments(): void {
    const deptId = this.effectiveDepartmentId;
    const filters = {
      ...this.filters$.value,
      ...(deptId ? { departmentId: deptId } : {}),
    };
    this.appointmentsService
      .getAppointmentsRaw(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apts) => {
          this.appointments.set(apts);
          this.applyClientFilters();
          this.cdr.markForCheck();
        },
      });
  }

  public readonly SchedulerViewType = SchedulerViewType;

  // ── Роли и режим ─────────────────────────────────────────────────────────
  public readonly isManager = computed(
    () => this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER,
  );

  /** Manager или admin с одним департаментом — скрываем выбор департамента */
  public readonly singleDepartmentMode = computed(() => this.isManager());

  /** Для Manager — берём департамент прямо из профиля */
  private readonly managerDepartmentId = computed(() => {
    const dept = this.supervisorService.authUserSignal()?.department;
    if (!dept) return '';
    return typeof dept === 'string' ? dept : dept._id;
  });

  // ── Стейт ─────────────────────────────────────────────────────────────────
  public readonly viewType = signal<SchedulerViewType>(SchedulerViewType.Day);
  public readonly currentDate = signal<string>(DateFnsHelper.getCurrentDate());
  public readonly appointments = signal<IAppointment[]>([]);
  public readonly filteredAppointments = signal<IAppointment[]>([]);
  public readonly employees = signal<IEmployee[]>([]);
  public readonly schedules = signal<ISchedule[]>([]);
  public readonly departments = signal<IDepartment[]>([]);
  public readonly isLoading = signal<boolean>(false);

  // ── Активные фильтры ──────────────────────────────────────────────────────
  public readonly selectedEmployeeIds = signal<string[]>([]);
  public readonly selectedDepartmentId = signal<string>('');
  public readonly selectedStatuses = signal<AppointmentStatus[]>([]);

  public readonly activeFiltersCount = computed(
    () => this.selectedEmployeeIds().length +
      (this.selectedDepartmentId() ? 1 : 0) +
      this.selectedStatuses().length,
  );

  // ── BehaviorSubject для filters — ресет → debounce → загрузка ────────────
  private readonly filters$ = new BehaviorSubject<IScheduleQueries>({
    from: DateFnsHelper.getCurrentDate(),
  });

  // ── Computed ──────────────────────────────────────────────────────────────
  public readonly dateLabel = computed(() => {
    const d = parse(this.currentDate(), 'yyyy-MM-dd', new Date());
    const locale = this.currentLang() === 'ua' ? uk : enUS;
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    switch (this.viewType()) {
      case SchedulerViewType.Day:
        return capitalize(format(d, 'EEEE, d MMMM yyyy', { locale }));
      case SchedulerViewType.Week: {
        const mon = startOfWeek(d, { weekStartsOn: 1 });
        const sun = endOfWeek(d, { weekStartsOn: 1 });
        return `${format(mon, 'd MMM', { locale })} – ${format(sun, 'd MMM yyyy', { locale })}`;
      }
      case SchedulerViewType.Month:
        return capitalize(format(d, 'MMMM yyyy', { locale }));
      default:
        return '';
    }
  });

  public readonly isToday = computed(() => this.currentDate() === DateFnsHelper.getCurrentDate());

  ngOnInit(): void {
    this.startFiltersWatching();
    this.initDepartments();
    this.initEmployees();
    this.emitDateChanged();
  }

  // ── View type & navigation ────────────────────────────────────────────────
  public setViewType(type: SchedulerViewType): void {
    this.viewType.set(type);
    this.emitDateChanged();
  }

  public prevPeriod(): void {
    this.navigate(1);
  }

  public nextPeriod(): void {
    this.navigate(-1);
  }

  public goToToday(): void {
    this.currentDate.set(DateFnsHelper.getCurrentDate());
    this.emitDateChanged();
  }

  public onDayClickedFromMonth(dateStr: string): void {
    this.currentDate.set(dateStr);
    this.viewType.set(SchedulerViewType.Day);
    this.emitDateChanged();
  }

  // ── Slot / Event click ───────────────────────────────────────────────────
  public onSlotClicked(payload: INewAppointmentPayload): void {
    this.enrichPayloadWithDepartment(payload);
    this.openAppointmentModal({
      department: payload.department as string | undefined,
      employee: payload.employee as string | undefined,
      startDate: payload.startDate,
      from: payload.from,
    });
  }

  public onEventClicked(payload: INewAppointmentPayload): void {
    if (payload._id) {
      void this.openViewModal(payload._id);
    } else {
      this.openAppointmentModal({ _id: payload._id });
    }
  }

  /** Drag-and-drop: обновляем время/сотрудника через API и обновляем календарь */
  public onEventDropped(result: IDragDropResult): void {
    const patch: Record<string, unknown> = {
      startDate: result.newStartDate,
      endDate: result.newEndDate,
    };
    if (result.newEmployeeId) {
      patch['employee'] = result.newEmployeeId;
    }
    this.appointmentsService
      .patchAppointmentById(result.appointmentId, patch as any)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.ngZone.run(() => this.filters$.next(this.filters$.value)),
      });
  }

  public async openViewModal(appointmentId: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AppointmentViewModalComponent,
      componentProps: { appointmentId },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) {
      this.ngZone.run(() => this.filters$.next(this.filters$.value));
    }
  }

  public async openAppointmentModal(payload: IAppointmentModalPayload = {}): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AppointmentModalComponent,
      componentProps: { payload },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean; deleted?: boolean; appointment?: IAppointment } | null>();
    if (data?.saved || data?.deleted) {
      // Ionic modal events may fire outside NgZone — wrap to guarantee CD
      this.ngZone.run(() => this.filters$.next(this.filters$.value));
    }
  }

  // ── Filters modal ─────────────────────────────────────────────────────────
  public async openFilters(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CalendarFiltersModalComponent,
      componentProps: {
        employees: this.employees(),
        departments: this.departments(),
        isManager: this.isManager(),
        selectedEmployeeIds: this.selectedEmployeeIds(),
        selectedDepartmentId: this.selectedDepartmentId(),
        selectedStatuses: this.selectedStatuses(),
      },
      breakpoints: [0, 0.7, 1],
      initialBreakpoint: 0.7,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<ICalendarFilterResult | null>();
    if (!data) return;

    const prevDept = this.selectedDepartmentId();
    this.selectedEmployeeIds.set(data.selectedEmployeeIds);
    this.selectedStatuses.set(data.selectedStatuses);

    if (data.selectedDepartmentId !== prevDept) {
      this.selectedDepartmentId.set(data.selectedDepartmentId);
      this.initEmployees(); // перезагружаем сотрудников при смене департамента
    }

    this.pushFilters();
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private navigate(direction: number): void {
    const cur = this.currentDate();
    switch (this.viewType()) {
      case SchedulerViewType.Day:
        this.currentDate.set(DateFnsHelper.getDaysBeforeOrAfter(cur, direction, 'day'));
        break;
      case SchedulerViewType.Week:
        this.currentDate.set(DateFnsHelper.getDaysBeforeOrAfter(cur, direction, 'week'));
        break;
      case SchedulerViewType.Month:
        this.currentDate.set(DateFnsHelper.getDaysBeforeOrAfter(cur, direction, 'months'));
        break;
    }
    this.emitDateChanged();
  }

  private get calendarDateRange(): string {
    if (this.viewType() === SchedulerViewType.Day) {
      return this.currentDate();
    }
    if (this.viewType() === SchedulerViewType.Week) {
      return DateFnsHelper.calculateWeekRange(this.currentDate()).key;
    }
    return DateFnsHelper.calculateMonthRange(this.currentDate()).key;
  }

  /** Записать текущий диапазон дат в filters$ */
  private emitDateChanged(): void {
    const range = this.calendarDateRange;
    const parts = range.split(' - ');
    const from = parts[0] ?? this.currentDate();
    const toDate = parts[1] ?? from;
    // Если дата без времени (plain date), добавляем конец дня,
    // иначе endDate <= '2026-04-28' отрезает все записи с временем (T10:00Z > '2026-04-28')
    const to = toDate.includes('T') ? toDate : `${toDate}T23:59:59`;
    const current = this.filters$.value;
    this.filters$.next({ ...current, from, to });
  }

  /** Обновить filters$ с учётом выбранных employee/status */
  private pushFilters(): void {
    const current = { ...this.filters$.value } as Record<string, unknown>;
    const empIds = this.selectedEmployeeIds();
    if (empIds.length) {
      current['employeeIds'] = empIds;
    } else {
      delete current['employeeIds'];
    }
    const statuses = this.selectedStatuses();
    if (statuses.length) {
      current['statuses'] = statuses;
    } else {
      delete current['statuses'];
    }
    this.filters$.next(current as IScheduleQueries);
  }

  private get effectiveDepartmentId(): string | undefined {
    if (this.singleDepartmentMode()) {
      return this.managerDepartmentId() || undefined;
    }
    return this.selectedDepartmentId() || undefined;
  }

  private enrichPayloadWithDepartment(payload: INewAppointmentPayload): void {
    if (!payload.department && payload.employee) {
      const emp = this.employees().find((e) => e._id === payload.employee);
      if (emp?.department?._id) {
        payload.department = emp.department._id;
      }
    }
  }

  private startFiltersWatching(): void {
    this.filters$
      .asObservable()
      .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.appointments.set([]);
        this.filteredAppointments.set([]);
        this.loadSchedules();
        this.loadAppointments();
      });
  }

  private initDepartments(): void {
    if (this.singleDepartmentMode()) return;
    this.departmentService
      .getDepartments({ limit: 100 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.departments.set(res.results);
        this.cdr.markForCheck();
      });
  }

  private initEmployees(): void {
    const deptId = this.effectiveDepartmentId;
    const filters: Record<string, unknown> = deptId ? { departmentId: deptId } : {};
    this.employeeService
      .getEmployees(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.employees.set(res.results);
        this.cdr.markForCheck();
      });
  }

  private loadSchedules(): void {
    const deptId = this.effectiveDepartmentId;
    const filters: IScheduleQueries = {
      ...this.filters$.value,
      default: true,
      ...(deptId ? { departmentId: deptId } : {}),
    };
    this.schedulesService
      .getSchedules(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((schedules) => {
        this.schedules.set(schedules);
        this.cdr.markForCheck();
      });
  }

  private loadAppointments(): void {
    const deptId = this.effectiveDepartmentId;
    const filters = {
      ...this.filters$.value,
      ...(deptId ? { departmentId: deptId } : {}),
    };
    this.isLoading.set(true);
    this.appointmentsService
      .getAppointmentsRaw(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apts) => {
          this.appointments.set(apts);
          this.applyClientFilters();
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private applyClientFilters(): void {
    let result = [...this.appointments()];
    const statuses = this.selectedStatuses();
    if (statuses.length) {
      result = result.filter((a) => statuses.includes(a.status));
    }
    this.filteredAppointments.set(result);
  }

  /** Real-time: добавляем appointment, если он валиден для текущих фильтров. */
  private handleRealtimeAppointment(appt: IAppointment): void {
    // Дедупликация — событие может прилететь дважды
    if (this.appointments().some((a) => a._id === appt._id)) return;

    // Фильтр по департаменту
    const deptId = this.effectiveDepartmentId;
    if (deptId) {
      const apptDeptId =
        typeof appt.department === 'string'
          ? appt.department
          : appt.department?._id;
      if (apptDeptId && apptDeptId !== deptId) return;
    }

    // Фильтр по сотрудникам
    const empIds = this.selectedEmployeeIds();
    if (empIds.length) {
      const apptEmpId =
        typeof appt.employee === 'string'
          ? appt.employee
          : (appt.employee as { _id?: string } | undefined)?._id;
      if (!apptEmpId || !empIds.includes(apptEmpId)) return;
    }

    // Фильтр по диапазону дат текущего вида (day / week / month)
    const filters = this.filters$.value as { from?: string; to?: string };
    if (appt.startDate && filters.from && filters.to) {
      const start = new Date(appt.startDate).getTime();
      const fromTs = new Date(filters.from).getTime();
      const toTs = new Date(filters.to).getTime();
      if (start < fromTs || start > toTs) return;
    }

    this.ngZone.run(() => {
      this.appointments.set([...this.appointments(), appt]);
      this.applyClientFilters();
      this.cdr.markForCheck();
    });
  }
}
