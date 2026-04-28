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
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { Observable, of, switchMap, take } from 'rxjs';
import { ISupervisor } from '@core/models/supervisor.interface';
import { IDepartment } from '@core/models/department.interface';
import { ISchedulePayload, IScheduleRow, DAY_LABELS, DAY_ORDER } from '@core/models/schedule.interface';
import { ESalaryRateType } from '@core/enums/e-salary-rate-type';
import { SupervisorService } from '@core/services/supervisor.service';
import { SchedulesService } from '@core/services/schedules.service';
import { DepartmentService } from '@core/services/department.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { ValidatorsHelper } from '@core/helpers/validators.helper';

@Component({
  selector: 'app-manager-form-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './manager-form-modal.component.html',
  styleUrls: ['./manager-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManagerFormModalComponent implements OnInit {
  @Input() manager: ISupervisor | null = null;
  @Input() department!: IDepartment;

  private readonly supervisorService = inject(SupervisorService);
  private readonly schedulesService = inject(SchedulesService);
  private readonly departmentService = inject(DepartmentService);
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

  public readonly salaryRateOptions = [
    { value: ESalaryRateType.Fixed, label: 'Fixed' },
    { value: ESalaryRateType.Commission, label: 'Commission %' },
    { value: ESalaryRateType.FixedPlusCommission, label: 'Fixed + Commission' },
    { value: ESalaryRateType.BaseOrCommission, label: 'Base or Commission' },
  ];

  // ── Signal-based schedule (same as employee modal) ─────────────────────────
  public scheduleRows: WritableSignal<IScheduleRow[]> = signal([]);

  public form!: FormGroup;

  ngOnInit(): void {
    this.isEditMode = !!this.manager?._id;
    this.buildForm();
    this.loadSchedule();
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss(false);
  }

  // ── Schedule helpers ───────────────────────────────────────────────────────

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
    if (!this.showBaseAmount) this.form.get('baseAmount')?.setValue(null);
    if (!this.showCommissionPercent) this.form.get('commissionPercent')?.setValue(null);
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
    const { password, confirmPassword, ...rest } = raw;

    const payload: Partial<ISupervisor> & { password?: string; department: string } = {
      ...rest,
      department: this.department._id,
      dateOfBirth: raw.dateOfBirth || undefined,
      salaryRateType: raw.salaryRateType ?? undefined,
      baseAmount: raw.baseAmount ?? undefined,
      commissionPercent: raw.commissionPercent ?? undefined,
    };
    delete (payload as Record<string, unknown>)['confirmPassword'];

    if (this.isEditMode && password) {
      payload.password = password;
    } else if (!this.isEditMode) {
      payload.password = password;
    }

    const save$ = this.isEditMode && this.manager?._id
      ? this.supervisorService.editSupervisorManager(this.manager._id, payload)
      : this.supervisorService.createSupervisorManager(payload as ISupervisor & { password: string });

    save$
      .pipe(
        switchMap((mgr) => {
          const mgrId = mgr._id || this.manager!._id;
          const schedule$ = this.saveSchedule(mgrId, this.department._id) as Observable<unknown>;
          return schedule$.pipe(
            switchMap(() => {
              if (!this.isEditMode && mgr._id) {
                return this.departmentService.patchDepartment(this.department._id, {
                  manager: mgr._id,
                } as unknown as Partial<IDepartment>);
              }
              return of(null);
            }),
          );
        }),
        take(1),
      )
      .subscribe({
        next: async () => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
          const toast = await this.toastCtrl.create({
            message: this.isEditMode ? 'Manager updated' : 'Manager created',
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

  private buildForm(): void {
    const mgr = this.manager;
    const passValidators = this.isEditMode
      ? [Validators.minLength(10), Validators.pattern(ValidatorsHelper.userPasswordReg)]
      : [Validators.required, Validators.minLength(10), Validators.pattern(ValidatorsHelper.userPasswordReg)];
    const confirmValidators = this.isEditMode ? [] : [Validators.required];

    this.form = new FormGroup(
      {
        firstName: new FormControl(mgr?.firstName ?? '', [Validators.required]),
        lastName: new FormControl(mgr?.lastName ?? '', [Validators.required]),
        phone: new FormControl(mgr?.phone ?? '', [Validators.required]),
        email: new FormControl(mgr?.email ?? '', [Validators.required, Validators.email]),
        dateOfBirth: new FormControl(mgr?.dateOfBirth ? mgr.dateOfBirth.split('T')[0] : ''),
        salaryRateType: new FormControl<ESalaryRateType | null>(mgr?.salaryRateType ?? null),
        baseAmount: new FormControl<number | null>(mgr?.baseAmount ?? null),
        commissionPercent: new FormControl<number | null>(mgr?.commissionPercent ?? null),
        password: new FormControl('', passValidators),
        confirmPassword: new FormControl('', confirmValidators),
      },
      { validators: this.passwordMatchValidator },
    );

    if (mgr?.salaryRateType) {
      this.onSalaryRateChange(mgr.salaryRateType);
    }

    this.cdr.markForCheck();
  }

  private loadSchedule(): void {
    if (!this.manager?._id) {
      this.initScheduleFromDepartment();
      return;
    }

    this.schedulesService
      .getSchedules({ departmentId: this.department._id, supervisorIds: [this.manager._id] })
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

  private saveSchedule(supervisorId: string, departmentId: string) {
    const days = this.scheduleRows()
      .filter((r) => r.enabled)
      .map((r) => ({ day: r.day, from: r.from, to: r.to, brake_times: [] }));

    if (!days.length) return of(null);

    const payload: ISchedulePayload = { days, department: departmentId, supervisor: supervisorId };

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

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      control.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }
}

