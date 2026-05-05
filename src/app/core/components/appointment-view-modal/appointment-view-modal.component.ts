import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule, ModalController } from '@ionic/angular';
import { take } from 'rxjs';

import {
  AppointmentStatus,
  IAppointment,
} from '@core/models/appointment.interface';
import { IDepartment } from '@core/models/department.interface';
import { AppointmentsService } from '@core/services/appointments.service';
import { AppointmentModalComponent } from '../appointment-modal/appointment-modal.component';
import { ClientDetailPage } from '../../../pages/main/pages/clients/pages/client-detail/client-detail.page';

const CLIENT_AVATAR_COLORS = [
  '#C8B6FF',
  '#B8E0D2',
  '#FFD6A5',
  '#FFADAD',
  '#A0C4FF',
  '#CAFFBF',
  '#FFC6FF',
  '#FDFFB6',
  '#BDB2FF',
  '#9BF6FF',
  '#F1C0E8',
  '#CDB4DB',
];

@Component({
  selector: 'app-appointment-view-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, IonicModule],
  templateUrl: './appointment-view-modal.component.html',
  styleUrls: ['./appointment-view-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentViewModalComponent implements OnInit {
  @Input() appointmentId!: string;

  private readonly ctrl = inject(ModalController);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly AppointmentStatus = AppointmentStatus;

  readonly isLoading = signal(true);
  readonly appointment = signal<IAppointment | null>(null);

  readonly departmentName = computed(() => {
    const dept = this.appointment()?.department;
    if (!dept) return '';
    if (typeof dept === 'string') return dept;
    return (dept as IDepartment).name ?? '';
  });

  readonly servicesText = computed(() => {
    const svcs = this.appointment()?.services ?? [];
    return svcs.map((s) => s.name).join(', ');
  });

  readonly servicesDuration = computed(() => {
    const svcs = this.appointment()?.services ?? [];
    const total = svcs.reduce((sum, s) => sum + (s.duration ?? 0), 0);
    return total ? `${total} min` : '';
  });

  readonly isCanceled = computed(
    () => this.appointment()?.status === AppointmentStatus.Canceled,
  );

  readonly isCompleted = computed(
    () => this.appointment()?.status === AppointmentStatus.Completed,
  );

  ngOnInit(): void {
    this.appointmentsService
      .getAppointmentById(this.appointmentId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((appt) => {
        this.appointment.set(appt);
        this.isLoading.set(false);
      });
  }

  async openEdit(): Promise<void> {
    const modal = await this.ctrl.create({
      component: AppointmentModalComponent,
      componentProps: { payload: { _id: this.appointmentId } },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) {
      await this.ctrl.dismiss({ saved: true });
    }
  }

  cancelAppointment(): void {
    this.appointmentsService
      .patchAppointmentById(this.appointmentId, {
        status: AppointmentStatus.Canceled,
      } as Partial<IAppointment>)
      .pipe(take(1))
      .subscribe((appt) => this.ctrl.dismiss({ saved: true, appointment: appt }));
  }

  markNoShow(): void {
    this.appointmentsService
      .patchAppointmentById(this.appointmentId, {
        status: AppointmentStatus.Canceled,
      } as Partial<IAppointment>)
      .pipe(take(1))
      .subscribe((appt) => this.ctrl.dismiss({ saved: true, appointment: appt }));
  }

  completeVisit(): void {
    this.appointmentsService
      .patchAppointmentById(this.appointmentId, {
        status: AppointmentStatus.Completed,
      } as Partial<IAppointment>)
      .pipe(take(1))
      .subscribe((appt) => this.ctrl.dismiss({ saved: true, appointment: appt }));
  }

  closeModal(): void {
    this.ctrl.dismiss();
  }

  async openClientProfile(clientId: string): Promise<void> {
    const modal = await this.ctrl.create({
      component: ClientDetailPage,
      componentProps: { clientId },
    });
    await modal.present();
  }

  getClientInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts[1]?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }

  getClientAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CLIENT_AVATAR_COLORS[Math.abs(hash) % CLIENT_AVATAR_COLORS.length];
  }
}

