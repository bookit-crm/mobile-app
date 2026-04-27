import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IAppointment, AppointmentStatus } from '@core/models/appointment.interface';

@Component({
  selector: 'app-calendar-event-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-event-card.component.html',
  styleUrls: ['./calendar-event-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarEventCardComponent {
  public readonly appointment = input<IAppointment | null>(null);
  public readonly height = input<number>(48);

  public readonly statusClass = computed(() => {
    switch (this.appointment()?.status) {
      case AppointmentStatus.New: return 'status--new';
      case AppointmentStatus.Completed: return 'status--completed';
      case AppointmentStatus.Canceled: return 'status--canceled';
      default: return '';
    }
  });

  public readonly clientName = computed(() => {
    const apt = this.appointment();
    return apt?.client?.fullName || apt?.clientName || 'Booking blocked';
  });

  public readonly serviceName = computed(() =>
    this.appointment()?.services?.map(s => s.name).join(', ') || '',
  );

  public readonly timeRange = computed(() => {
    const apt = this.appointment();
    if (!apt) return '';
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${fmt(new Date(apt.startDate))} - ${fmt(new Date(apt.endDate))}`;
  });

  public readonly isCompact = computed(() => this.height() < 60);
}

