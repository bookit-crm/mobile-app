import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DestroyRef, effect, inject, input, output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { isSameDay, parse } from 'date-fns';
import { IAppointment, INewAppointmentPayload } from '@core/models/appointment.interface';
import { IEmployee } from '@core/models/employee.interface';
import { ISchedule } from '@core/models/schedule.interface';
import {
  generateTimeSlots, getEventTopAndHeight, isOutsideWorkingHours,
  layoutOverlappingEvents, ITimeSlot, ICalendarColumn, IPositionedEvent,
  SLOT_HEIGHT_PX, DAY_START_HOUR, DAY_END_HOUR, SLOT_DURATION_MINUTES,
} from '../../utils/calendar-utils';
import { CalendarEventCardComponent } from '../calendar-event-card/calendar-event-card.component';
import { DateFnsHelper } from '@core/helpers/date-fns.helper';

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [CommonModule, CalendarEventCardComponent],
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayViewComponent {
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  public readonly date = input<string>('');
  public readonly appointments = input<IAppointment[]>([]);
  public readonly schedules = input<ISchedule[]>([]);
  public readonly employees = input<IEmployee[]>([]);
  public readonly selectedEmployeeIds = input<string[]>([]);

  public readonly slotClicked = output<INewAppointmentPayload>();
  public readonly eventClicked = output<INewAppointmentPayload>();

  public columns: ICalendarColumn[] = [];
  public timeLabels: ITimeSlot[] = [];
  public SLOT_HEIGHT = SLOT_HEIGHT_PX;
  public currentTimeTop: number | null = null;

  private readonly HEADER_HEIGHT = 57;
  private viewDate: Date = new Date();

  constructor() {
    effect(() => {
      const date = this.date();
      this.appointments();
      this.schedules();
      this.employees();
      this.selectedEmployeeIds();
      this.viewDate = date ? parse(date, 'yyyy-MM-dd', new Date()) : new Date();
      this.buildGrid();
    });

    const timerInterval = setInterval(() => {
      this.updateCurrentTimeLine();
      this.cdr.markForCheck();
    }, 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timerInterval));
  }

  public isSlotDisabled(slot: ITimeSlot, employeeId: string): boolean {
    if (!employeeId || !this.schedules()?.length) return false;
    return isOutsideWorkingHours(slot.date, employeeId, this.schedules());
  }

  public onSlotClick(slot: ITimeSlot, column: ICalendarColumn): void {
    if (this.isSlotDisabled(slot, column.employeeId)) return;
    this.slotClicked.emit({
      employee: column.employeeId,
      department: column.departmentId,
      startDate: DateFnsHelper.convertDate(this.viewDate),
      from: slot.time,
    });
  }

  public onEventClick(appointment: IAppointment, event: Event): void {
    event.stopPropagation();
    this.eventClicked.emit({ _id: appointment._id });
  }

  private buildGrid(): void {
    this.timeLabels = generateTimeSlots(this.viewDate);

    const employeeMap = new Map<string, IEmployee>();
    for (const emp of this.employees()) {
      employeeMap.set(emp._id, emp);
    }
    if (employeeMap.size === 0) {
      for (const schedule of this.schedules()) {
        if (schedule.employee) employeeMap.set(schedule.employee._id, schedule.employee);
      }
    }

    const selectedIds = this.selectedEmployeeIds();
    let visible: IEmployee[];
    if (selectedIds?.length) {
      visible = selectedIds.map(id => employeeMap.get(id)).filter(Boolean) as IEmployee[];
    } else {
      visible = Array.from(employeeMap.values());
    }
    visible.sort((a, b) => a._id.localeCompare(b._id));

    const dayAppts = this.appointments().filter(apt =>
      isSameDay(new Date(apt.startDate), this.viewDate),
    );

    this.columns = visible.map(emp => {
      const empAppts = dayAppts.filter(apt => {
        // employee may be a string ID (not populated) or a full IEmployee object
        const aptEmpId = typeof apt.employee === 'string' ? apt.employee : apt.employee?._id;
        return aptEmpId === emp._id;
      });
      const events: IPositionedEvent[] = empAppts.map(apt => {
        const { top, height } = getEventTopAndHeight(apt);
        return { appointment: apt, top, height, left: 0, width: 100 };
      });
      layoutOverlappingEvents(events);
      return {
        employeeId: emp._id,
        departmentId: emp.department?._id || '',
        employeeName: `${emp.firstName} ${emp.lastName}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        avatarUrl: emp.avatar?.url || null,
        slots: this.timeLabels,
        events,
      };
    });

    this.updateCurrentTimeLine();
    this.cdr.detectChanges();
  }

  private updateCurrentTimeLine(): void {
    const now = new Date();
    if (!isSameDay(this.viewDate, now)) { this.currentTimeTop = null; return; }
    const minutesFromDayStart = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
    const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    if (minutesFromDayStart < 0 || minutesFromDayStart > totalMinutes) { this.currentTimeTop = null; return; }
    this.currentTimeTop = this.HEADER_HEIGHT + minutesFromDayStart * (SLOT_HEIGHT_PX / SLOT_DURATION_MINUTES);
  }
}

