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
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, Subject, take } from 'rxjs';
import { IDepartment, IDepartmentScheduleDay } from '@core/models/department.interface';
import { IFileDTO } from '@core/models/file.interface';
import { DepartmentService } from '@core/services/department.service';
import { FilesService } from '@core/services/files.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { EUserRole } from '@core/enums/e-user-role';
import { DepartmentFormModalComponent } from '../../components/department-form-modal/department-form-modal.component';
import { Share } from '@capacitor/share';
import { environment } from '@environments/environment';

export type DepartmentTab = 'overview' | 'branding' | 'schedule';

export interface IScheduleRow {
  day: number;       // 0=Sun … 6=Sat
  label: string;
  enabled: boolean;
  from: string;      // HH:mm
  to: string;        // HH:mm
}

const DAY_KEY_MAP: Record<number, string> = {
  0: 'DAY_SUN',
  1: 'DAY_MON',
  2: 'DAY_TUE',
  3: 'DAY_WED',
  4: 'DAY_THU',
  5: 'DAY_FRI',
  6: 'DAY_SAT',
};
// Display order: Mon → Sun
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

@Component({
  selector: 'app-department',
  templateUrl: './department.page.html',
  styleUrls: ['./department.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly departmentService = inject(DepartmentService);
  private readonly filesService = inject(FilesService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  private readonly scheduleSave$ = new Subject<void>();

  public department = signal<IDepartment | null>(null);
  public isLoading = signal(true);
  public isSavingSchedule = signal(false);
  public activeTab = signal<DepartmentTab>('overview');
  public scheduleRows = signal<IScheduleRow[]>([]);

  /** Which branding field is currently uploading */
  public uploadingField = signal<'logo' | 'gallery' | 'banner' | null>(null);

  /** true если план позволяет редактировать расписание — убрано ограничение, всегда true */
  public readonly canEditSchedule = computed(() => true);

  public get isManager(): boolean {
    return this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDepartment(id);
    }

    // Auto-save schedule with debounce
    this.scheduleSave$
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.saveSchedule());
  }

  public setTab(tab: DepartmentTab): void {
    this.activeTab.set(tab);
  }

  // ── Schedule ────────────────────────────────────────────────────────────────

  public toggleDay(day: number, event: CustomEvent): void {
    const enabled = event.detail.checked as boolean;
    this.scheduleRows.update((rows) =>
      rows.map((r) => (r.day === day ? { ...r, enabled } : r)),
    );
    this.scheduleSave$.next();
  }

  public updateTime(day: number, field: 'from' | 'to', event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.scheduleRows.update((rows) =>
      rows.map((r) => (r.day === day ? { ...r, [field]: value } : r)),
    );
    this.scheduleSave$.next();
  }

  public updateTimeNative(day: number, field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.scheduleRows.update((rows) =>
      rows.map((r) => (r.day === day ? { ...r, [field]: value } : r)),
    );
    this.scheduleSave$.next();
  }

  // ── Branding ─────────────────────────────────────────────────────────────────

  public onFileSelected(
    event: Event,
    field: 'logo' | 'gallery' | 'banner',
  ): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const dept = this.department();
    if (!dept) return;

    this.uploadingField.set(field);
    this.cdr.markForCheck();

    // Upload all selected files sequentially
    const uploads = Array.from(files).map((file) => {
      const fd = new FormData();
      fd.append('file', file);
      return this.filesService.uploadFile(fd);
    });

    // Use forkJoin-equivalent: chain uploads one by one
    import('rxjs').then(({ forkJoin }) => {
      forkJoin(uploads)
        .pipe(take(1))
        .subscribe({
          next: (uploaded: IFileDTO[]) => {
            this.applyBrandingUpload(dept, field, uploaded);
            // Reset input value so the same file can be re-selected
            input.value = '';
          },
            error: async () => {
              this.uploadingField.set(null);
              this.cdr.markForCheck();
              const toast = await this.toastCtrl.create({
                message: this.t.instant('UPLOAD_FAILED'),
                duration: 3000,
                color: 'danger',
              });
              await toast.present();
              input.value = '';
            },
        });
    });
  }

  public async removeImage(
    field: 'logo' | 'gallery' | 'banner',
    fileId: string,
  ): Promise<void> {
    const dept = this.department();
    if (!dept) return;

    // Confirm before removing the avatar
    if (field === 'logo') {
      const alert = await this.alertCtrl.create({
        header: this.t.instant('REMOVE_AVATAR_TITLE'),
        message: this.t.instant('REMOVE_AVATAR_MSG'),
        buttons: [
          { text: this.t.instant('CANCEL'), role: 'cancel' },
          {
            text: this.t.instant('REMOVE'),
            role: 'destructive',
            cssClass: 'alert-btn-danger',
            handler: () => this.doRemoveImage(dept, { logo: null }),
          },
        ],
      });
      await alert.present();
      return;
    }

    let payload: Partial<IDepartment>;

    if (field === 'gallery') {
      payload = {
        galleryImages: (dept.galleryImages ?? [])
          .filter((f) => f._id !== fileId),
      };
    } else {
      payload = {
        bannerImages: (dept.bannerImages ?? [])
          .filter((f) => f._id !== fileId),
      };
    }

    this.doRemoveImage(dept, this.toIdPayload(payload));
  }

  private doRemoveImage(dept: IDepartment, payload: Partial<IDepartment>): void {
    this.departmentService
      .patchDepartment(dept._id, payload)
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.department.set(updated);
          this.cdr.markForCheck();
        },
      });
  }

  private applyBrandingUpload(
    dept: IDepartment,
    field: 'logo' | 'gallery' | 'banner',
    uploaded: IFileDTO[],
  ): void {
    let payload: Partial<IDepartment>;

    if (field === 'logo') {
      payload = { logo: uploaded[0] };
    } else if (field === 'gallery') {
      payload = { galleryImages: [...(dept.galleryImages ?? []), ...uploaded] };
    } else {
      payload = { bannerImages: [...(dept.bannerImages ?? []), ...uploaded] };
    }

    this.departmentService
      .patchDepartment(dept._id, this.toIdPayload(payload))
      .pipe(take(1))
      .subscribe({
        next: (updated) => {
          this.department.set(updated);
          this.uploadingField.set(null);
          this.cdr.markForCheck();
        },
        error: () => {
          this.uploadingField.set(null);
          this.cdr.markForCheck();
        },
      });
  }

  /** Convert IFileDTO fields to _id strings for PATCH payload */
  private toIdPayload(payload: Partial<IDepartment>): Partial<IDepartment> {
    const result: Record<string, unknown> = { ...payload };
    if (payload.logo !== undefined) {
      result['logo'] = payload.logo ? payload.logo._id : null;
    }
    if (payload.galleryImages) {
      result['galleryImages'] = payload.galleryImages.map((f) => f._id);
    }
    if (payload.bannerImages) {
      result['bannerImages'] = payload.bannerImages.map((f) => f._id);
    }
    return result as Partial<IDepartment>;
  }

  // ── Status toggle ────────────────────────────────────────────────────────────

  public isTogglingStatus = signal(false);

  public toggleStatus(): void {
    const dept = this.department();
    if (!dept) return;

    const newStatus = dept.status === 'active' ? 'inactive' : 'active';

    this.isTogglingStatus.set(true);
    this.cdr.markForCheck();

    this.departmentService
      .patchDepartment(dept._id, { status: newStatus })
      .pipe(take(1))
      .subscribe({
        next: async (updated) => {
          this.department.set(updated);
          this.isTogglingStatus.set(false);
          this.cdr.markForCheck();
          const msgKey = newStatus === 'active' ? 'DEPT_NOW_ACTIVE' : 'DEPT_NOW_INACTIVE';
          const toast = await this.toastCtrl.create({
            message: this.t.instant(msgKey),
            duration: 2000,
            color: newStatus === 'active' ? 'success' : 'medium',
          });
          await toast.present();
        },
        error: async () => {
          this.isTogglingStatus.set(false);
          this.cdr.markForCheck();
          const toast = await this.toastCtrl.create({
            message: this.t.instant('DEPT_STATUS_FAILED'),
            duration: 3000,
            color: 'danger',
          });
          await toast.present();
        },
      });
  }

  // ── Client booking link ───────────────────────────────────────────────────────

  public get clientBookingLink(): string {
    const dept = this.department();
    if (!dept) return '';
    return `${environment.client_url}/department?id=${dept._id}&dataBaseId=${dept.dataBaseId}`;
  }

  public async shareClientLink(): Promise<void> {
    const link = this.clientBookingLink;
    if (!link) return;

    try {
      await Share.share({
        title: this.t.instant('DEPT_SHARE_TITLE'),
        text: link,
        url: link,
        dialogTitle: this.t.instant('DEPT_SHARE_DIALOG_TITLE'),
      });
    } catch {
      // fallback to clipboard (web/browser)
      try {
        await navigator.clipboard.writeText(link);
        const toast = await this.toastCtrl.create({
          message: this.t.instant('LINK_COPIED'),
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      } catch {
        // silently ignore if both fail
      }
    }
  }

  // ── Overview helpers ─────────────────────────────────────────────────────────

  public getInfoItems(): Array<{ label: string; value: string }> {
    const dept = this.department();
    if (!dept) return [];

    const items: Array<{ label: string; value: string }> = [
      { label: this.t.instant('NAME'), value: dept.name },
      { label: this.t.instant('STATUS'), value: dept.status ?? 'active' },
      { label: this.t.instant('PHONE'), value: dept.phone ?? '—' },
      { label: this.t.instant('ADDRESS'), value: dept.location?.formattedAddress ?? '—' },
      { label: this.t.instant('WEBSITE'), value: dept.websiteURL ?? '—' },
    ];

    if (dept.manager) {
      const full = `${dept.manager.firstName} ${dept.manager.lastName}`.trim();
      items.push({ label: this.t.instant('MANAGER'), value: full || '—' });
    }

    if (dept.stats) {
      items.push(
        { label: this.t.instant('EMPLOYEES'), value: String(dept.stats.employees ?? 0) },
        { label: this.t.instant('SERVICES'), value: String(dept.stats.services ?? 0) },
      );
    }

    if (dept.created) {
      items.push({
        label: this.t.instant('CREATED'),
        value: new Date(dept.created).toLocaleDateString('en-GB'),
      });
    }

    if (dept.specializations?.length) {
      items.push({ label: this.t.instant('SPECIALIZATIONS'), value: dept.specializations.join(', ') });
    }

    return items;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  public async openEditModal(): Promise<void> {
    const dept = this.department();
    if (!dept) return;
    const modal = await this.modalCtrl.create({
      component: DepartmentFormModalComponent,
      componentProps: { department: dept },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) {
      this.loadDepartment(dept._id);
    }
  }

  public async confirmDelete(): Promise<void> {
    const dept = this.department();
    if (!dept) return;
    const alert = await this.alertCtrl.create({
      header: this.t.instant('DELETE_DEPT_TITLE'),
      message: this.t.instant('DELETE_DEPT_MSG_UNDONE', { name: dept.name }),
      buttons: [
        { text: this.t.instant('CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('DELETE'),
          role: 'destructive',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.departmentService
              .deleteDepartment(dept._id)
              .pipe(take(1))
              .subscribe({
                next: async () => {
                  const toast = await this.toastCtrl.create({
                    message: this.t.instant('DEPT_DELETED'),
                    duration: 2000,
                    color: 'success',
                  });
                  await toast.present();
                  void this.router.navigate(['/main/departments']);
                },
              });
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Returns locale-formatted time string for display (e.g. "8:00 AM" or "08:00").
   * Input is already a local HH:mm — we format it using the device's locale
   * WITHOUT any timezone conversion (set as UTC, format as UTC).
   */
  public formatTimeLocale(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setUTCHours(h, m, 0, 0); // pin value in UTC — no TZ shift
    return new Intl.DateTimeFormat([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',  // format in UTC so h:m are shown as-is
    }).format(d);
  }

  /** Short "from — to" summary in locale format for collapsed rows */
  public timeSummary(row: IScheduleRow): string {
    return `${this.formatTimeLocale(row.from)} — ${this.formatTimeLocale(row.to)}`;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private loadDepartment(id: string): void {
    this.isLoading.set(true);
    this.departmentService
      .getDepartmentById(id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dept) => {
          this.department.set(dept);
          this.initScheduleRows(dept);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: async () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
          const toast = await this.toastCtrl.create({
            message: this.t.instant('DEPT_LOAD_FAILED'),
            duration: 3000,
            color: 'danger',
          });
          await toast.present();
          void this.router.navigate(['/main/departments']);
        },
      });
  }

  private initScheduleRows(dept: IDepartment): void {
    const rows: IScheduleRow[] = DAY_ORDER.map((day) => {
      const existing = dept.schedule?.find((d) => d.day === day);
      const enabled = !!(existing?.from && existing?.to);
      return {
        day,
        label: this.t.instant(DAY_KEY_MAP[day]),
        enabled,
        from: existing?.from ? this.isoToTime(existing.from) : '08:00',
        to:   existing?.to   ? this.isoToTime(existing.to)   : '18:00',
      };
    });
    this.scheduleRows.set(rows);
  }

  private saveSchedule(): void {
    const dept = this.department();
    if (!dept) return;

    const schedule: IDepartmentScheduleDay[] = this.scheduleRows().map((r) => ({
      day: r.day,
      from: r.enabled ? this.timeToISO(r.from) : null,
      to:   r.enabled ? this.timeToISO(r.to)   : null,
    }));

    this.isSavingSchedule.set(true);
    this.cdr.markForCheck();

    this.departmentService
      .patchDepartment(dept._id, { schedule })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isSavingSchedule.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isSavingSchedule.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * UTC ISO → local HH:mm (for <input type="time"> value).
   *
   * Uses Intl.DateTimeFormat with the device's IANA timezone name — more
   * reliable on Capacitor/Android WebView than Date.getHours() which can
   * incorrectly return UTC hours even when the device is in another timezone.
   */
  private isoToTime(value: string): string {
    if (!value) return '08:00';
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    try {
      const date = new Date(value);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parts = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz,
      }).formatToParts(date);
      const h = (parts.find((p) => p.type === 'hour')?.value ?? '00').padStart(2, '0');
      const m = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
      // Some formatters return "24" for midnight — normalise
      return h === '24' ? `00:${m}` : `${h}:${m}`;
    } catch {
      return '08:00';
    }
  }

  /**
   * Local HH:mm → UTC ISO string.
   *
   * Algorithm: treat the given HH:mm as UTC to get a reference Date, then
   * check what local hour that UTC moment corresponds to (via Intl).
   * The difference is the TZ offset.  Subtract it to get the true UTC hour.
   */
  private timeToISO(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Today's date in the user's local timezone (sv-SE locale → YYYY-MM-DD)
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()); // e.g. "2026-04-27"

    // Build a reference UTC timestamp using h:m as if it were UTC
    const refUtc = new Date(`${today}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);

    // What local hour does that UTC moment correspond to?
    const localHourAtRef = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(refUtc),
    );

    // TZ offset in hours: localHour = utcHour + offset  →  offset = localHour - h
    const tzOffsetHours = localHourAtRef - h;

    // True UTC hour for the given local h:m
    const utcH = h - tzOffsetHours;

    const [year, month, day] = today.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, utcH, m, 0)).toISOString();
  }
}
