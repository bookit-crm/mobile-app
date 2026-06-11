import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { AlertController, ToastController } from '@ionic/angular';
import { take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
  DAY_KEY_MAP,
  DAY_ORDER,
  ISchedulePayload,
  IScheduleRow,
} from '@core/models/schedule.interface';
import { IFileDTO } from '@core/models/file.interface';
import { AuthService } from '@core/services/auth.service';
import { EmployeeService } from '@core/services/employee.service';
import { SchedulesService } from '@core/services/schedules.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { IEmployee } from '@core/models/employee.interface';

/**
 * Employee self-profile: edit own info + avatar, change password via the
 * email-code flow, edit own work schedule (admins/managers get notified
 * about schedule changes server-side).
 */
@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ion-page' },
})
export class ProfilePage implements OnInit {
  private readonly supervisorService = inject(SupervisorService);
  private readonly employeeService = inject(EmployeeService);
  private readonly schedulesService = inject(SchedulesService);
  private readonly authService = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  public isSaving = signal(false);
  public isSavingSchedule = signal(false);
  public avatarUrl: string | null = null;
  public avatarFileId: string | null = null;

  private selfId: string | null = null;
  private departmentId: string | null = null;
  private existingScheduleId: string | null = null;

  public departmentName = signal<string>('');
  public scheduleRows: WritableSignal<IScheduleRow[]> = signal([]);

  public form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    dateOfBirth: new FormControl(''),
  });

  ngOnInit(): void {
    const user = this.supervisorService.authUserSignal();
    if (user) {
      this.applyUser(user as unknown as IEmployee & { department?: { _id: string; name: string } });
    }
    // Always refresh from the server (also covers cold start)
    this.supervisorService
      .getSelf()
      .pipe(take(1))
      .subscribe((res) =>
        this.applyUser(res as unknown as IEmployee & { department?: { _id: string; name: string } }),
      );
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────

  public onAvatarUploaded(dto: IFileDTO): void {
    this.avatarFileId = dto._id;
    this.avatarUrl = dto.url;
    this.saveProfile({ avatar: this.avatarFileId } as unknown as Partial<IEmployee>, false);
    this.cdr.markForCheck();
  }

  public onAvatarRemoved(): void {
    this.avatarFileId = null;
    this.avatarUrl = null;
    this.saveProfile({ avatar: null } as unknown as Partial<IEmployee>, false);
    this.cdr.markForCheck();
  }

  // ── Profile info ───────────────────────────────────────────────────────────

  public submitProfile(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    this.saveProfile({
      firstName: raw.firstName,
      lastName: raw.lastName,
      phone: raw.phone,
      email: raw.email,
      dateOfBirth: raw.dateOfBirth || undefined,
    } as unknown as Partial<IEmployee>);
  }

  // ── Change password (email code flow) ─────────────────────────────────────

  public async startPasswordChange(): Promise<void> {
    const email = this.form.controls.email.value;
    if (!email) return;

    this.authService
      .confirmChangePasswordEmail(email)
      .pipe(take(1))
      .subscribe({
        next: () => void this.presentCodeAlert(email),
        error: () => void this.presentToast('ERROR_OCCURRED', 'danger'),
      });
  }

  private async presentCodeAlert(email: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('PROFILE_PWD_CODE_TITLE'),
      message: this.t.instant('PROFILE_PWD_CODE_TEXT'),
      inputs: [
        {
          name: 'otpCode',
          type: 'text',
          placeholder: this.t.instant('PROFILE_PWD_CODE_PLACEHOLDER'),
          attributes: { inputmode: 'numeric', autocomplete: 'one-time-code' },
        },
      ],
      buttons: [
        { text: this.t.instant('CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('PROFILE_PWD_CONTINUE'),
          handler: (data: { otpCode: string }) => {
            const code = (data.otpCode || '').trim();
            if (!code) return false;
            this.verifyCode(email, code);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private verifyCode(email: string, otpCode: string): void {
    this.authService
      .confirmChangePasswordCode({ email, otpCode })
      .pipe(take(1))
      .subscribe({
        next: () => void this.presentNewPasswordAlert(email, otpCode),
        error: () => void this.presentToast('PROFILE_PWD_CODE_INVALID', 'danger'),
      });
  }

  private async presentNewPasswordAlert(
    email: string,
    otpCode: string,
  ): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('PROFILE_PWD_NEW_TITLE'),
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: this.t.instant('PROFILE_PWD_NEW_PLACEHOLDER'),
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: this.t.instant('MGR_CONFIRM_PLACEHOLDER'),
        },
      ],
      buttons: [
        { text: this.t.instant('CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('SAVE'),
          handler: (data: { password: string; confirmPassword: string }) => {
            if (!data.password || data.password.length < 8) {
              void this.presentToast('MGR_PASSWORD_MIN_LENGTH', 'danger');
              return false;
            }
            if (data.password !== data.confirmPassword) {
              void this.presentToast('MGR_PASSWORDS_MISMATCH', 'danger');
              return false;
            }
            this.changePassword(email, otpCode, data.password, data.confirmPassword);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private changePassword(
    email: string,
    otpCode: string,
    password: string,
    confirmPassword: string,
  ): void {
    this.authService
      .confirmChangePassword({ email, otpCode, password, confirmPassword })
      .pipe(take(1))
      .subscribe({
        next: () => void this.presentToast('PROFILE_PWD_CHANGED', 'success'),
        error: () => void this.presentToast('ERROR_OCCURRED', 'danger'),
      });
  }

  // ── Schedule ───────────────────────────────────────────────────────────────

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

  public saveSchedule(): void {
    if (!this.selfId || !this.departmentId) return;

    const days = this.scheduleRows()
      .filter((r) => r.enabled)
      .map((r) => ({
        // JS day (0=Sun…6=Sat) → backend day (0=Mon…6=Sun)
        day: r.day === 0 ? 6 : r.day - 1,
        from: this.timeToISO(r.from),
        to: this.timeToISO(r.to),
        brake_times: [],
      }));

    if (!days.length) {
      void this.presentToast('PROFILE_SCHEDULE_EMPTY', 'danger');
      return;
    }

    this.isSavingSchedule.set(true);
    const payload: ISchedulePayload = {
      days,
      department: this.departmentId,
      employee: this.selfId,
    };

    const save$ = this.existingScheduleId
      ? this.schedulesService.patchSchedules(this.existingScheduleId, payload)
      : this.schedulesService.createSchedules(payload);

    save$.pipe(take(1)).subscribe({
      next: () => {
        this.isSavingSchedule.set(false);
        void this.presentToast('PROFILE_SCHEDULE_SAVED', 'success');
        this.loadSchedule();
      },
      error: () => {
        this.isSavingSchedule.set(false);
        void this.presentToast('ERROR_OCCURRED', 'danger');
      },
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private applyUser(
    user: IEmployee & { department?: { _id: string; name: string } | string | null },
  ): void {
    if (!user?._id) return;

    this.selfId = user._id;
    this.avatarUrl = user.avatar?.url ?? null;
    this.avatarFileId = user.avatar?._id ?? null;

    const dept = user.department;
    this.departmentId = typeof dept === 'string' ? dept : (dept?._id ?? null);
    this.departmentName.set(typeof dept === 'object' && dept ? dept.name : '');

    this.form.patchValue({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      dateOfBirth: user.dateOfBirth ? String(user.dateOfBirth).split('T')[0] : '',
    });

    if (!this.scheduleRows().length) {
      this.loadSchedule();
    }

    this.cdr.markForCheck();
  }

  private saveProfile(payload: Partial<IEmployee>, withToast = true): void {
    if (!this.selfId) return;

    this.isSaving.set(true);
    this.employeeService
      .patchEmployee(this.selfId, payload)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          if (withToast) void this.presentToast('PROFILE_SAVED', 'success');
          // Keep the cached auth user fresh for the side menu
          this.supervisorService.getSelf().pipe(take(1)).subscribe();
        },
        error: () => {
          this.isSaving.set(false);
          void this.presentToast('ERROR_OCCURRED', 'danger');
        },
      });
  }

  private loadSchedule(): void {
    if (!this.selfId) return;

    this.schedulesService
      .getSchedules({ employeeIds: [this.selfId] })
      .pipe(take(1))
      .subscribe((schedules) => {
        const hasSchedule =
          schedules?.length > 0 && schedules.some((s) => s.days?.length > 0);

        this.existingScheduleId = hasSchedule ? schedules[0]._id : null;

        const rows: IScheduleRow[] = DAY_ORDER.map((day) => {
          // JS day (0=Sun…6=Sat) ↔ backend day (0=Mon…6=Sun)
          const backendDay = day === 0 ? 6 : day - 1;
          const existing = hasSchedule
            ? schedules
                .find((sc) => sc.days.find((d) => d.day === backendDay))
                ?.days.find((d) => d.day === backendDay)
            : undefined;
          const enabled = !!existing?.from;
          return {
            day,
            label: this.t.instant(DAY_KEY_MAP[day]),
            enabled,
            from: existing?.from ? this.isoToTime(existing.from) : '09:00',
            to: existing?.to ? this.isoToTime(existing.to) : '18:00',
          };
        });

        this.scheduleRows.set(rows);
        this.cdr.markForCheck();
      });
  }

  public timeSummary(row: IScheduleRow): string {
    return `${row.from} — ${row.to}`;
  }

  private timeToISO(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const refUtc = new Date(
      `${today}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`,
    );
    const localHourAtRef = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit', hour12: false, timeZone: tz,
      }).format(refUtc),
    );
    const tzOffsetHours = localHourAtRef - h;
    const utcH = h - tzOffsetHours;
    const [year, month, day] = today.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, utcH, m, 0)).toISOString();
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
    } catch {
      return '09:00';
    }
  }

  private async presentToast(
    key: string,
    color: 'success' | 'danger',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.t.instant(key),
      duration: 2500,
      color,
    });
    await toast.present();
  }
}
