import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DestroyRef, effect, inject, input, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { addDays, addMinutes, format, isSameDay, startOfWeek } from 'date-fns';
import { IAppointment, INewAppointmentPayload } from '@core/models/appointment.interface';
import { ISchedule } from '@core/models/schedule.interface';
import {
  generateTimeSlots, getEventTopAndHeight, isOutsideWorkingHours,
  layoutOverlappingEvents, ITimeSlot, IPositionedEvent,
  SLOT_HEIGHT_PX, DAY_START_HOUR, DAY_END_HOUR, SLOT_DURATION_MINUTES,
} from '../../utils/calendar-utils';
import { CalendarEventCardComponent } from '../calendar-event-card/calendar-event-card.component';

export interface IWeekDayColumn {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  slots: ITimeSlot[];
  events: IPositionedEvent[];
}

@Component({
  selector: 'app-week-view',
  standalone: true,
  imports: [CommonModule, CalendarEventCardComponent],
  templateUrl: './week-view.component.html',
  styleUrls: ['./week-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekViewComponent {
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  public readonly date = input<string>('');
  public readonly appointments = input<IAppointment[]>([]);
  public readonly schedules = input<ISchedule[]>([]);
  public readonly selectedEmployeeId = input<string>('');

  public readonly slotClicked = output<INewAppointmentPayload>();
  public readonly eventClicked = output<INewAppointmentPayload>();

  public weekDays: IWeekDayColumn[] = [];
  public timeLabels: ITimeSlot[] = [];
  public SLOT_HEIGHT = SLOT_HEIGHT_PX;
  public currentTimeTop: number | null = null;

  private readonly HEADER_HEIGHT = 56;
  private viewDate: Date = new Date();

  constructor() {
    effect(() => {
      const date = this.date();
      this.appointments();
      this.schedules();
      this.selectedEmployeeId();
      this.viewDate = new Date(date);
      this.buildGrid();
    });

    const timerInterval = setInterval(() => {
      this.updateCurrentTimeLine();
      this.cdr.markForCheck();
    }, 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timerInterval));
  }

  public isSlotDisabled(slot: ITimeSlot, day: IWeekDayColumn): boolean {
    const empId = this.selectedEmployeeId();
    if (!empId || !this.schedules()?.length) return false;
    const slotDate = new Date(day.date);
    slotDate.setHours(slot.hour, slot.minute, 0, 0);
    return isOutsideWorkingHours(slotDate, empId, this.schedules());
  }

  public onSlotClick(slot: ITimeSlot, day: IWeekDayColumn): void {
    if (this.isSlotDisabled(slot, day)) return;
    this.slotClicked.emit({
      employee: this.selectedEmployeeId() || '',
      startDate: format(day.date, 'yyyy-MM-dd'),
      from: slot.time,
    });
  }

  public onEventClick(appointment: IAppointment, event: Event): void {
    event.stopPropagation();
    this.eventClicked.emit({ _id: appointment._id });
  }

  private buildGrid(): void {
    const monday = startOfWeek(this.viewDate, { weekStartsOn: 1 });
    const today = new Date();
    this.timeLabels = generateTimeSlots(monday);
    const empId = this.selectedEmployeeId();
    const allAppts = this.appointments();

    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(monday, i);
      const daySlots = generateTimeSlots(dayDate);
      const dayAppts = allAppts.filter(apt => {
        if (empId) {
          // employee may be a string ID (not populated) or a full IEmployee object
          const aptEmpId = typeof apt.employee === 'string' ? apt.employee : apt.employee?._id;
          if (aptEmpId !== empId) return false;
        }
        return isSameDay(new Date(apt.startDate), dayDate);
      });
      const events: IPositionedEvent[] = dayAppts.map(apt => {
        const { top, height } = getEventTopAndHeight(apt);
        return { appointment: apt, top, height, left: 0, width: 100 };
      });
      layoutOverlappingEvents(events);
      this.weekDays.push({
        date: dayDate,
        dateStr: format(dayDate, 'yyyy-MM-dd'),
        dayName: format(dayDate, 'EEE'),
        dayNumber: dayDate.getDate(),
        isToday: isSameDay(dayDate, today),
        slots: daySlots,
        events,
      });
    }

    this.updateCurrentTimeLine();
    this.cdr.detectChanges();
  }

  private updateCurrentTimeLine(): void {
    const now = new Date();
    if (!this.weekDays.some(d => d.isToday)) { this.currentTimeTop = null; return; }
    const min = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
    const total = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    if (min < 0 || min > total) { this.currentTimeTop = null; return; }
    this.currentTimeTop = this.HEADER_HEIGHT + min * (SLOT_HEIGHT_PX / SLOT_DURATION_MINUTES);
  }
}

