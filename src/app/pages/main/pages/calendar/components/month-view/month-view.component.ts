import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject, input, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { IAppointment } from '@core/models/appointment.interface';

export interface IMonthDay {
  date: Date;
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  appointments: IAppointment[];
  appointmentCount: number;
}

@Component({
  selector: 'app-month-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthViewComponent {
  private cdr = inject(ChangeDetectorRef);

  public readonly date = input<string>('');
  public readonly appointments = input<IAppointment[]>([]);
  public readonly dayClicked = output<string>();

  public dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  public weeks: IMonthDay[][] = [];
  private viewDate: Date = new Date();

  constructor() {
    effect(() => {
      this.date();
      this.appointments();
      this.viewDate = new Date(this.date());
      this.buildCalendar();
    });
  }

  public onDayClick(day: IMonthDay): void { this.dayClicked.emit(day.dateStr); }
  public getVisibleAppointments(day: IMonthDay): IAppointment[] { return day.appointments.slice(0, 3); }
  public getRemainingCount(day: IMonthDay): number { return Math.max(0, day.appointmentCount - 3); }

  public getAppointmentColor(apt: IAppointment): string {
    switch (apt.status) {
      case 'new': return '#e8f4fd';
      case 'completed': return '#e8fdf3';
      case 'canceled': return '#fef2f2';
      default: return '#f5f5f5';
    }
  }

  public getAppointmentBorderColor(apt: IAppointment): string {
    switch (apt.status) {
      case 'new': return '#4a9fd5';
      case 'completed': return '#1be885';
      case 'canceled': return '#d92d20';
      default: return '#bbb';
    }
  }

  private buildCalendar(): void {
    const monthStart = startOfMonth(this.viewDate);
    const monthEnd = endOfMonth(this.viewDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const allAppts = this.appointments();

    this.weeks = [];
    let current = calStart;
    let week: IMonthDay[] = [];

    while (current <= calEnd) {
      const dayDate = new Date(current);
      const dayStr = format(dayDate, 'yyyy-MM-dd');
      const dayAppts = allAppts.filter(apt => isSameDay(new Date(apt.startDate), dayDate));

      week.push({
        date: dayDate, dateStr: dayStr,
        dayNumber: dayDate.getDate(),
        isCurrentMonth: isSameMonth(dayDate, this.viewDate),
        isToday: isToday(dayDate),
        appointments: dayAppts,
        appointmentCount: dayAppts.length,
      });

      if (week.length === 7) { this.weeks.push(week); week = []; }
      current = addDays(current, 1);
    }
    this.cdr.detectChanges();
  }
}

