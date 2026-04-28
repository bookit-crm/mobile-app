import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { Observable, of, switchMap, take } from 'rxjs';
import { IEmployee } from '@core/models/employee.interface';
import { IService } from '@core/models/appointment.interface';
import { IDepartment } from '@core/models/department.interface';
import { ISchedulePayload, IScheduleRow, DAY_LABELS, DAY_ORDER } from '@core/models/schedule.interface';
import { ESalaryRateType } from '@core/enums/e-salary-rate-type';
import { EmployeeService } from '@core/services/employee.service';
import { SchedulesService } from '@core/services/schedules.service';
import { ServicesService } from '@core/services/services.service';
import { SubscriptionService } from '@core/services/subscription.service';

@Component({
  selector: 'app-employee-form-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './employee-form-modal.component.html',
  styleUrls: ['./employee-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeFormModalComponent implements OnInit {
  @Input() employee: IEmployee | null = null;
  @Input() department!: IDepartment;

  private readonly employeeService = inject(EmployeeService);
  private readonly schedulesService = inject(SchedulesService);
  private readonly servicesService = inject(ServicesService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);

  public readonly ESalaryRateType = ESalaryRateType;

  public isSubmitting = false;
  public isEditMode = false;
  private existingScheduleId: string | null = null;

  public canShowSalaryRate = this.subscriptionService.hasFeature('expensesPayroll');
  public showBaseAmount = false;
  public showCommissionPercent = false;

  public availableServices: IService[] = [];
  public selectedServices: IService[] = [];
  public showServicePicker = false;

  public readonly salaryRateOptions = [
    { value: ESalaryRateType.Fixed, label: 'Fixed' },
    { value: ESalaryRateType.Commission, label: 'Commission %' },
    { value: ESalaryRateType.FixedPlusCommission, label: 'Fixed + Commission' },
    { value: ESalaryRateType.BaseOrCommission, label: 'Base or Commission' },
  ];

  // ── Signal-based schedule (same pattern as department) ─────────────────────
  public scheduleRows: WritableSignal<IScheduleRow[]> = signal([]);

  public form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    position: new FormControl(''),
    description: new FormControl(''),
    dateOfBirth: new FormControl(''),
    salaryRateType: new FormControl<ESalaryRateType | null>(null),
    baseAmount: new FormControl<number | null>(null),
    commissionPercent: new FormControl<number | null>(null),
  });

  ngOnInit(): void {
    this.isEditMode = !!this.employee?._id;
    this.populateForm();
    this.loadServicesForDepartment();
    this.loadSchedule();
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss(false);
  }

  // ── Schedule helpers (same as department) ──────────────────────────────────

  public toggleDay(day: number, event: CustomEvent): void {
    const enabled = event.detail.checked as boolean;
    this.scheduleRows.update((rows) =>
      rows.map((r) => (r.day === day ? { ...r, enabled } : r)),
    );
  }

  public updateTimeNative(day: number, field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.scheduleRows.update((rows) =>
      rows.map((r) => (r.day === day ? { ...r, [field]: value } : r)),
    );
  }

  public timeSummary(row: IScheduleRow): string {
    return `${this.formatTimeLocale(row.from)} — ${this.formatTimeLocale(row.to)}`;
  }

  public formatTimeLocale(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setUTCHours(h, m, 0, 0);
    return new Intl.DateTimeFormat([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(d);
  }

  // ── Services ───────────────────────────────────────────────────────────────

  public toggleServiceSelection(service: IService): void {
    const idx = this.selectedServices.findIndex((s) => s._id === service._id);
    if (idx >= 0) {
      this.selectedServices = this.selectedServices.filter((s) => s._id !== service._id);
    } else {
      this.selectedServices = [...this.selectedServices, service];
    }
    this.cdr.markForCheck();
  }

  public isServiceSelected(service: IService): boolean {
    return this.selectedServices.some((s) => s._id === service._id);
  }

  // ── Salary rate ────────────────────────────────────────────────────────────

  public onSalaryRateChange(value: string): void {
    const rate = value as ESalaryRateType | null;
    this.showBaseAmount =
      rate === ESalaryRateType.Fixed ||
      rate === ESalaryRateType.FixedPlusCommission ||
      rate === ESalaryRateType.BaseOrCommission;
    this.showCommissionPercent =
      rate === ESalaryRateType.Commission ||
      rate === ESalaryRateType.FixedPlusCommission ||
      rate === ESalaryRateType.BaseOrCommission;
    if (!this.showBaseAmount) this.form.controls.baseAmount.setValue(null);
    if (!this.showCommissionPercent) this.form.controls.commissionPercent.setValue(null);
    this.cdr.markForCheck();
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  public submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      firstName: raw.firstName,
      lastName: raw.lastName,
      phone: raw.phone,
      email: raw.email,
      position: raw.position || undefined,
      description: raw.description || undefined,
      dateOfBirth: raw.dateOfBirth || undefined,
      department: this.department._id,
      services: this.selectedServices.map((s) => s._id),
      salaryRateType: raw.salaryRateType ?? undefined,
      baseAmount: raw.baseAmount ?? undefined,
      commissionPercent: raw.commissionPercent ?? undefined,
    };

    const save$ = this.isEditMode && this.employee?._id
      ? this.employeeService.patchEmployee(this.employee._id, payload as unknown as Partial<IEmployee>)
      : this.employeeService.addEmployee(payload as unknown as Partial<IEmployee>);

    save$
      .pipe(
        switchMap((emp) =>
          (this.saveSchedule(emp._id || this.employee!._id, this.department._id) as Observable<unknown>),
        ),
        take(1),
      )
      .subscribe({
        next: async () => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
          const toast = await this.toastCtrl.create({
            message: this.isEditMode ? 'Employee updated' : 'Employee created',
            duration: 2000,
            color: 'success',
          });
          await toast.present();
          void this.modalCtrl.dismiss(true);
        },
        error: async () => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
          const toast = await this.toastCtrl.create({
            message: 'An error occurred. Please try again.',
            duration: 3000,
            color: 'danger',
          });
          await toast.present();
        },
      });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private populateForm(): void {
    const emp = this.employee;
    if (!emp) return;
    this.form.patchValue({
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone,
      email: emp.email,
      position: emp.position ?? '',
      description: emp.description ?? '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      salaryRateType: emp.salaryRateType ?? null,
      baseAmount: emp.baseAmount ?? null,
      commissionPercent: emp.commissionPercent ?? null,
    });
    if (emp.salaryRateType) this.onSalaryRateChange(emp.salaryRateType);
    this.selectedServices = emp.services ? [...emp.services] : [];
  }

  private loadServicesForDepartment(): void {
    this.servicesService
      .getServices({ departmentId: this.department._id, limit: 100 })
      .pipe(take(1))
      .subscribe({ next: (res) => { this.availableServices = res.results; this.cdr.markForCheck(); } });
  }

  private loadSchedule(): void {
    if (!this.employee?._id) {
      this.initScheduleFromDepartment();
      return;
    }
    this.schedulesService
      .getSchedules({ departmentId: this.department._id, employeeIds: [this.employee._id] })
      .pipe(take(1))
      .subscribe((schedules) => {
        const hasSchedule = schedules?.length > 0 && schedules.some((s) => s.days?.length > 0);
        if (hasSchedule) {
          this.existingScheduleId = schedules[0]._id;
          const rows: IScheduleRow[] = DAY_ORDER.map((day) => {
            const existing = schedules
              .find((sc) => sc.days.find((d) => d.day === day))
              ?.days.find((d) => d.day === day);
            const enabled = !!existing?.from;
            return {
              day,
              label: DAY_LABELS[day],
              enabled,
              from: existing?.from ? this.isoToTime(existing.from) : '09:00',
              to: existing?.to ? this.isoToTime(existing.to) : '18:00',
            };
          });
          this.scheduleRows.set(rows);
          this.cdr.markForCheck();
        } else {
          this.initScheduleFromDepartment();
        }
      });
  }

  private initScheduleFromDepartment(): void {
    const deptSchedule = this.department?.schedule;
    const rows: IScheduleRow[] = DAY_ORDER.map((day) => {
      const existing = deptSchedule?.find((d) => d.day === day);
      const enabled = !!(existing?.from && existing?.to);
      return {
        day,
        label: DAY_LABELS[day],
        enabled,
        from: existing?.from ? this.isoToTime(existing.from) : '09:00',
        to: existing?.to ? this.isoToTime(existing.to) : '18:00',
      };
    });
    this.scheduleRows.set(rows);
    this.cdr.markForCheck();
  }

  private saveSchedule(employeeId: string, departmentId: string) {
    const days = this.scheduleRows()
      .filter((r) => r.enabled)
      .map((r) => ({ day: r.day, from: r.from, to: r.to, brake_times: [] }));

    if (!days.length) return of(null);

    const payload: ISchedulePayload = { days, department: departmentId, employee: employeeId };

    return this.existingScheduleId
      ? this.schedulesService.patchSchedules(this.existingScheduleId, payload)
      : this.schedulesService.createSchedules(payload);
  }

  private isoToTime(value: string): string {
    if (!value) return '09:00';
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    try {
      const date = new Date(value);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parts = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
      }).formatToParts(date);
      const h = (parts.find((p) => p.type === 'hour')?.value ?? '00').padStart(2, '0');
      const m = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
      return h === '24' ? `00:${m}` : `${h}:${m}`;
    } catch { return '09:00'; }
  }
}

