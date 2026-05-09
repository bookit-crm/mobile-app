import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { IDepartment } from '@core/models/department.interface';
import {
  IDailyEmployeeSchedule,
  IDailyScheduleResponse,
  IDayModel,
} from '@core/models/schedule.interface';
import { EUserRole } from '@core/enums/e-user-role';
import { format, parse, parseISO } from 'date-fns';
import { DepartmentService } from '@core/services/department.service';
import { SchedulesService } from '@core/services/schedules.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';

export type ECellClass = 'open' | 'closed' | 'working' | 'not-working';

const HOURS = Array.from({ length: 20 }, (_, i) => i + 5); // 5..24

const AVATAR_COLORS = [
  '#C8B6FF', '#B8E0D2', '#FFD6A5', '#FFADAD', '#A0C4FF',
  '#CAFFBF', '#FFC6FF', '#FDFFB6', '#BDB2FF', '#9BF6FF',
  '#F1C0E8', '#CDB4DB',
];

interface DayEntry { value: number; display: string; }

const DAY_NAMES: DayEntry[] = [
  { value: 0, display: 'DAY_MON' },
  { value: 1, display: 'DAY_TUE' },
  { value: 2, display: 'DAY_WED' },
  { value: 3, display: 'DAY_THU' },
  { value: 4, display: 'DAY_FRI' },
  { value: 5, display: 'DAY_SAT' },
  { value: 6, display: 'DAY_SUN' },
];

@Component({
  selector: 'app-daily-schedule',
  templateUrl: './daily-schedule.page.html',
  styleUrls: ['./daily-schedule.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailySchedulePage implements OnInit, OnDestroy {
  private schedulesService = inject(SchedulesService);
  private departmentService = inject(DepartmentService);
  private supervisorService = inject(SupervisorService);
  private subscriptionService = inject(SubscriptionService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  public hours = HOURS;
  public dayNames = DAY_NAMES;
  public labelWidth = 160;

  public selectedDate = signal<Date>(new Date());
  public departments = signal<IDepartment[]>([]);
  public selectedDepartment = signal<IDepartment | null>(null);
  public data = signal<IDailyScheduleResponse | null>(null);
  public loading = signal(false);
  public nowHourPosition = signal<number | null>(null);
  public datePickerOpen = signal(false);

  // Менеджер → всегда 1 локация (ограничение роли).
  // Individual / Starter → isSingleLocationPlan = true (locations limit = 1).
  // Professional / Enterprise → показываем, если у них реально > 1 департамент.
  public singleDepartmentMode = computed(() => {
    const user = this.supervisorService.authUserSignal();
    if (user?.role === EUserRole.MANAGER) return true;
    if (this.subscriptionService.isSingleLocationPlan()) return true;
    return this.departments().length <= 1;
  });

  public departmentOptions = computed(() =>
    this.departments().map((d) => ({ id: d._id, name: d.name }))
  );

  public selectedDayIndex = computed(() => {
    const date = this.selectedDate();
    const jsDay = date.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  });

  public departmentSchedule = computed(() => this.data()?.departmentSchedule);

  public employees = computed(() => {
    const emps = this.data()?.employees ?? [];
    const mgrs = this.data()?.managers ?? [];
    return [...mgrs, ...emps];
  });

  public managerIds = computed(() => {
    const mgrs = this.data()?.managers ?? [];
    return new Set(mgrs.map((m) => m.employee._id));
  });

  public selectedDateString = computed(() => {
    const d = this.selectedDate();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00`;
  });

  public departmentTimeLabel = computed(() => {
    const ds = this.departmentSchedule();
    if (!ds?.from || !ds?.to) return '';
    return `${this.formatTime(ds.from)} – ${this.formatTime(ds.to)}`;
  });

  public weekDates = computed(() => {
    const sel = this.selectedDate();
    const jsDay = sel.getDay();
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(sel);
    monday.setDate(sel.getDate() + mondayOffset);
    return DAY_NAMES.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const day = d.getDate();
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      return `${day} ${month}`;
    });
  });

  public isTodaySignal = computed(() => {
    const today = new Date();
    const sel = this.selectedDate();
    return (
      today.getFullYear() === sel.getFullYear() &&
      today.getMonth() === sel.getMonth() &&
      today.getDate() === sel.getDate()
    );
  });

  public cellClassMap = computed(() => {
    const map = new Map<string, ECellClass>();
    const deptSch = this.departmentSchedule();
    const emps = this.employees();
    for (const hour of this.hours) {
      const deptOpen = this.isHourInRange(hour, deptSch);
      map.set(`dept_${hour}`, deptOpen ? 'open' : 'closed');
      for (const emp of emps) {
        const empWorking =
          emp.status !== 'dayOff' &&
          emp.daySchedule &&
          this.isHourInRange(hour, emp.daySchedule);
        if (empWorking) {
          map.set(`${emp.employee._id}_${hour}`, 'working');
        } else if (emp.status === 'dayOff') {
          map.set(`${emp.employee._id}_${hour}`, deptOpen ? 'not-working' : 'closed');
        } else {
          map.set(`${emp.employee._id}_${hour}`, deptOpen ? 'not-working' : 'closed');
        }
      }
    }
    return map;
  });

  public initialsMap = computed(() => {
    const map = new Map<string, string>();
    for (const emp of this.employees()) {
      const f = emp.employee.firstName?.[0] ?? '';
      const l = emp.employee.lastName?.[0] ?? '';
      map.set(emp.employee._id, (f + l).toUpperCase());
    }
    return map;
  });

  public colorMap = computed(() => {
    const map = new Map<string, string>();
    this.employees().forEach((emp, i) => {
      map.set(emp.employee._id, AVATAR_COLORS[i % AVATAR_COLORS.length]);
    });
    return map;
  });

  public get selectDeptHeader(): string {
    return this.translate.instant('DS_SELECT_DEPARTMENT');
  }

  private nowTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadInitialData();
    this.updateNowIndicator();
    this.nowTimer = setInterval(() => this.updateNowIndicator(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.nowTimer) clearInterval(this.nowTimer);
  }

  // ──── Actions ────────────────────────────────────────────────────────────────

  public selectDay(dayIndex: number): void {
    const sel = this.selectedDate();
    const jsDay = sel.getDay();
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(sel);
    monday.setDate(sel.getDate() + mondayOffset);
    const newDate = new Date(monday);
    newDate.setDate(monday.getDate() + dayIndex);
    this.selectedDate.set(newDate);
    this.loadSchedule();
  }

  public prevWeek(): void {
    const date = new Date(this.selectedDate());
    date.setDate(date.getDate() - 7);
    this.selectedDate.set(date);
    this.loadSchedule();
  }

  public nextWeek(): void {
    const date = new Date(this.selectedDate());
    date.setDate(date.getDate() + 7);
    this.selectedDate.set(date);
    this.loadSchedule();
  }

  public goToToday(): void {
    this.selectedDate.set(new Date());
    this.loadSchedule();
    this.updateNowIndicator();
  }

  public onDepartmentChange(id: string): void {
    const dep = this.departments().find((d) => d._id === id);
    this.selectedDepartment.set(dep ?? null);
    this.loadSchedule();
  }

  public onDatePickerChange(value: string | string[] | null | undefined): void {
    const strVal = Array.isArray(value) ? value[0] : value;
    if (!strVal) return;
    // ion-datetime может вернуть "2026-04-28" (date-only = UTC midnight в JS)
    // или "2026-04-28T00:00:00Z". Используем parse для date-only, parseISO для ISO.
    const dateStr = strVal.slice(0, 10);
    const parsed = strVal.length <= 10
      ? parse(dateStr, 'yyyy-MM-dd', new Date())
      : parseISO(strVal);
    if (isNaN(parsed.getTime())) return;
    this.selectedDate.set(parsed);
    this.datePickerOpen.set(false);
    this.loadSchedule();
    this.updateNowIndicator();
  }

  public openDatePicker(): void {
    this.datePickerOpen.set(true);
  }

  public getEmpForRow(row: IDailyEmployeeSchedule): IDailyEmployeeSchedule {
    return row;
  }

  // ──── Private ────────────────────────────────────────────────────────────────

  /**
   * Всегда грузим список департаментов через API — бэк фильтрует по правам.
   * Менеджер получит ровно 1 департамент, админ — все свои.
   * Один code path — нет проблем с authUserSignal() на холодном старте.
   */
  private loadInitialData(): void {
    this.departmentService
      .getDepartments({ limit: 100, offset: 0 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const deps = res?.results ?? [];
          this.departments.set(deps);
          if (deps.length) {
            this.selectedDepartment.set(deps[0]);
          }
          this.cdr.markForCheck();
        },
        complete: () => this.loadSchedule(),
      });
  }

  private loadSchedule(): void {
    const dep = this.selectedDepartment();
    if (!dep) return;
    const isoDate = format(this.selectedDate(), 'yyyy-MM-dd');
    this.loading.set(true);
    this.schedulesService
      .getDailySchedule(dep._id, isoDate)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private isHourInRange(hour: number, day: IDayModel | null | undefined): boolean {
    if (!day?.from || !day?.to) return false;
    const fromH = this.extractHour(day.from);
    const toH = this.extractHour(day.to);
    const toM = this.extractMinutes(day.to);
    if (fromH === null || toH === null) return false;
    const effectiveToH = toH === 0 && toM === 0 ? 24 : toH;
    const effectiveTo = toM > 0 ? effectiveToH : effectiveToH - 1;
    return hour >= fromH && hour <= effectiveTo;
  }

  /** Парсит час из ISO-строки ("2026-04-28T06:00:00.000Z") или HH:mm ("06:00") */
  private extractHour(timeStr: string): number | null {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
      return parseInt(timeStr.slice(0, 2), 10);
    }
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? null : d.getHours();
  }

  /** Парсит минуты из ISO-строки или HH:mm */
  private extractMinutes(timeStr: string): number {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
      return parseInt(timeStr.slice(3, 5), 10);
    }
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? 0 : d.getMinutes();
  }

  private formatTime(timeStr: string): string {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
      return timeStr.slice(0, 5);
    }
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '';
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private updateNowIndicator(): void {
    if (!this.isTodaySignal()) {
      this.nowHourPosition.set(null);
      return;
    }
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const percent = ((currentHour - 5) / 19) * 100;
    if (percent < 0 || percent > 100) {
      this.nowHourPosition.set(null);
    } else {
      this.nowHourPosition.set(percent);
    }
    this.cdr.markForCheck();
  }
}
