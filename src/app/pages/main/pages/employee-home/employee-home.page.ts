import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { forkJoin, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
  AppointmentStatus,
  IAppointment,
} from '@core/models/appointment.interface';
import { AppointmentsService } from '@core/services/appointments.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { AppointmentViewModalComponent } from '@core/components/appointment-view-modal/appointment-view-modal.component';
import { ESalaryRateType } from '@core/enums/e-salary-rate-type';

/**
 * Employee dashboard: today's stats (earnings / completed / visits),
 * the appointment in progress right now and the next upcoming ones.
 * All appointment requests are scoped to the employee server-side.
 */
@Component({
  selector: 'app-employee-home',
  templateUrl: './employee-home.page.html',
  styleUrls: ['./employee-home.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ion-page' },
})
export class EmployeeHomePage implements OnInit {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);
  private readonly modalCtrl = inject(ModalController);

  public readonly AppointmentStatus = AppointmentStatus;

  public isLoading = signal(true);
  public todayAppointments = signal<IAppointment[]>([]);
  public upcomingAppointments = signal<IAppointment[]>([]);
  /** "now" snapshot — refreshed on each load so computeds stay consistent */
  private now = signal<Date>(new Date());

  public authUser = this.supervisorService.authUserSignal;

  public firstName = computed(() => this.authUser()?.firstName ?? '');

  /**
   * What the employee actually earns from today's completed visits — the
   * commission portion of each ticket, not the gross. Pure-Fixed accounts
   * don't accrue per-visit; the daily card stays at 0 (the monthly base
   * still shows up on the Performance page where the period context makes
   * it meaningful).
   */
  public todayEarnings = computed(() => {
    const user = this.authUser();
    const completed = this.todayAppointments().filter(
      (a) => a.status === AppointmentStatus.Completed,
    );
    const gross = completed.reduce((sum, a) => sum + (a.totalPrice || 0), 0);
    const rateType = user?.salaryRateType;
    const pct = (user?.commissionPercent ?? 0) / 100;
    if (
      rateType === ESalaryRateType.Commission ||
      rateType === ESalaryRateType.FixedPlusCommission ||
      rateType === ESalaryRateType.BaseOrCommission
    ) {
      return gross * pct;
    }
    if (rateType === ESalaryRateType.Fixed) {
      // Fixed-rate employees don't earn variable pay per visit; the daily
      // tile would be misleading if it showed the gross service revenue.
      return 0;
    }
    // No rate configured — surface the gross so the tile is not blank.
    return gross;
  });

  /** Gross service revenue for today — exposed for the secondary tile. */
  public todayGrossRevenue = computed(() =>
    this.todayAppointments()
      .filter((a) => a.status === AppointmentStatus.Completed)
      .reduce((sum, a) => sum + (a.totalPrice || 0), 0),
  );

  /**
   * Whether the employee's pay model includes a variable component —
   * drives the gross-revenue tile copy ("Service revenue" makes sense to
   * an employee whose payout depends on it; would be noise for a fixed-rate
   * account).
   */
  public hasVariablePay = computed(() => {
    const rt = this.authUser()?.salaryRateType;
    return (
      rt === ESalaryRateType.Commission ||
      rt === ESalaryRateType.FixedPlusCommission ||
      rt === ESalaryRateType.BaseOrCommission
    );
  });

  public completedToday = computed(
    () =>
      this.todayAppointments().filter(
        (a) => a.status === AppointmentStatus.Completed,
      ).length,
  );

  /** All non-canceled visits scheduled for today */
  public visitsToday = computed(
    () =>
      this.todayAppointments().filter(
        (a) => a.status !== AppointmentStatus.Canceled,
      ).length,
  );

  /** Visits still ahead of "now" today */
  public remainingToday = computed(() => {
    const now = this.now().getTime();
    return this.todayAppointments().filter(
      (a) =>
        a.status === AppointmentStatus.New &&
        new Date(a.startDate).getTime() > now,
    ).length;
  });

  /** The appointment happening right now (if any) */
  public currentAppointment = computed<IAppointment | null>(() => {
    const now = this.now().getTime();
    return (
      this.todayAppointments().find(
        (a) =>
          a.status === AppointmentStatus.New &&
          new Date(a.startDate).getTime() <= now &&
          new Date(a.endDate).getTime() >= now,
      ) ?? null
    );
  });

  /** Next 3 upcoming appointments (today and later) */
  public nextAppointments = computed<IAppointment[]>(() => {
    const now = this.now().getTime();
    return this.upcomingAppointments()
      .filter(
        (a) =>
          a.status === AppointmentStatus.New &&
          new Date(a.startDate).getTime() > now,
      )
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
      .slice(0, 3);
  });

  ngOnInit(): void {
    if (!this.authUser()) {
      this.supervisorService.getSelf().pipe(take(1)).subscribe();
    }
    this.loadData();
  }

  public handleRefresh(event: CustomEvent): void {
    this.loadData(() => (event.target as HTMLIonRefresherElement).complete());
  }

  public goToCalendar(): void {
    void this.router.navigate(['/main/calendar']);
  }

  /** Open the shared appointment preview modal — same one the calendar uses */
  public async openAppointment(appt: IAppointment): Promise<void> {
    if (!appt?._id) return;
    const modal = await this.modalCtrl.create({
      component: AppointmentViewModalComponent,
      componentProps: { appointmentId: appt._id },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) {
      this.loadData();
    }
  }

  public formatTimeRange(appt: IAppointment): string {
    const opts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    const from = new Date(appt.startDate).toLocaleTimeString([], opts);
    const to = new Date(appt.endDate).toLocaleTimeString([], opts);
    return `${from} – ${to}`;
  }

  public formatDayLabel(appt: IAppointment): string {
    const date = new Date(appt.startDate);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(date, today)) return this.t.instant('EH_TODAY');
    if (sameDay(date, tomorrow)) return this.t.instant('EH_TOMORROW');

    const lang = this.t.currentLang === 'ua' ? 'uk-UA' : 'en-US';
    return date.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  public servicesLabel(appt: IAppointment): string {
    return (appt.services ?? []).map((s) => s.name).join(', ');
  }

  private loadData(done?: () => void): void {
    this.now.set(new Date());

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);

    forkJoin({
      today: this.appointmentsService.getAppointmentsRaw({
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
      }),
      upcoming: this.appointmentsService.getAppointmentsRaw({
        from: new Date().toISOString(),
        to: weekAhead.toISOString(),
      }),
    })
      .pipe(take(1))
      .subscribe({
        next: ({ today, upcoming }) => {
          this.todayAppointments.set(today ?? []);
          this.upcomingAppointments.set(upcoming ?? []);
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
