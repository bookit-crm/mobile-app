import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DestroyRef, effect, ElementRef, inject, input, output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { isSameDay, parse } from 'date-fns';
import { IAppointment, INewAppointmentPayload } from '@core/models/appointment.interface';
import { IEmployee } from '@core/models/employee.interface';
import { ISchedule } from '@core/models/schedule.interface';
import {
  generateTimeSlots, getEventTopAndHeight, isOutsideWorkingHours,
  layoutOverlappingEvents, ITimeSlot, ICalendarColumn, IPositionedEvent,
  IDragDropResult,
  SLOT_HEIGHT_PX, DAY_START_HOUR, DAY_END_HOUR, SLOT_DURATION_MINUTES,
} from '../../utils/calendar-utils';
import { CalendarEventCardComponent } from '../calendar-event-card/calendar-event-card.component';
import { DateFnsHelper } from '@core/helpers/date-fns.helper';

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [CommonModule, TranslateModule, CalendarEventCardComponent],
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayViewComponent {
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private readonly el = inject(ElementRef<HTMLElement>);

  public readonly date = input<string>('');
  public readonly appointments = input<IAppointment[]>([]);
  public readonly schedules = input<ISchedule[]>([]);
  public readonly employees = input<IEmployee[]>([]);
  public readonly selectedEmployeeIds = input<string[]>([]);

  public readonly slotClicked = output<INewAppointmentPayload>();
  public readonly eventClicked = output<INewAppointmentPayload>();
  public readonly eventDropped = output<IDragDropResult>();

  public columns: ICalendarColumn[] = [];
  public timeLabels: ITimeSlot[] = [];
  public SLOT_HEIGHT = SLOT_HEIGHT_PX;
  public currentTimeTop: number | null = null;

  // ── Ghost & drop highlight ─────────────────────────────────────────────────
  public readonly ghostVisible = signal(false);
  public readonly ghostTop = signal(0);
  public readonly ghostLeft = signal(0);
  public readonly ghostHeight = signal(48);
  public readonly ghostWidth = signal(160);
  public readonly ghostAppointment = signal<IAppointment | null>(null);
  /** {colIdx, top, height} — колонка и позиция drop-индикатора */
  public readonly dropHighlight = signal<{ colIdx: number; top: number; height: number } | null>(null);

  private readonly HEADER_HEIGHT = 57;
  private viewDate: Date = new Date();

  // ── Drag state ─────────────────────────────────────────────────────────────
  private dragAppt: IAppointment | null = null;
  private dragDurationMin = 0;
  private isDragging = false;
  private dragOffsetY = 0;        // touch Y - top of the event card
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private preventNextClick = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly LONG_PRESS_MS = 450;
  private readonly MOVE_CANCEL_PX = 10;
  private readonly boundTouchMove = (e: TouchEvent) => this.onDocTouchMove(e);
  private readonly boundTouchEnd = (e: TouchEvent) => this.onDocTouchEnd(e);
  private readonly boundMouseMove = (e: MouseEvent) => this.onDocMouseMove(e);
  private readonly boundMouseUp = (e: MouseEvent) => this.onDocMouseUp(e);

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

    this.destroyRef.onDestroy(() => {
      clearInterval(timerInterval);
      this.cancelDrag();
    });
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
    if (this.preventNextClick) {
      this.preventNextClick = false;
      return;
    }
    this.eventClicked.emit({ _id: appointment._id });
  }

  // ── Mouse drag handlers (эмулятор / десктоп браузер) ─────────────────────

  public onEventMouseDown(e: MouseEvent, appt: IAppointment): void {
    if (e.button !== 0) return; // только левая кнопка
    e.stopPropagation();

    this.dragAppt = appt;
    this.dragDurationMin = Math.round(
      (new Date(appt.endDate).getTime() - new Date(appt.startDate).getTime()) / 60000,
    );
    this.dragStartClientX = e.clientX;
    this.dragStartClientY = e.clientY;

    const { height } = getEventTopAndHeight(appt);
    this.ghostHeight.set(Math.max(height, 48));
    this.ghostWidth.set(this.getColumnWidth());
    this.ghostAppointment.set(appt);

    const eventEl = (e.target as HTMLElement).closest('.day-view__event') as HTMLElement | null;
    this.dragOffsetY = eventEl
      ? Math.min(e.clientY - eventEl.getBoundingClientRect().top, this.ghostHeight())
      : 24;

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onDocMouseMove(e: MouseEvent): void {
    if (!this.dragAppt) return;

    if (!this.isDragging) {
      const dx = Math.abs(e.clientX - this.dragStartClientX);
      const dy = Math.abs(e.clientY - this.dragStartClientY);
      if (dx > 5 || dy > 5) {
        this.isDragging = true;
        this.updateGhost(e.clientX, e.clientY);
        this.ghostVisible.set(true);
        this.cdr.markForCheck();
      }
      return;
    }

    this.updateGhost(e.clientX, e.clientY);
    this.updateDropHighlight(e.clientX, e.clientY);
    this.cdr.markForCheck();
  }

  private onDocMouseUp(e: MouseEvent): void {
    if (this.isDragging && this.dragAppt) {
      const result = this.computeDropResult(e.clientX, e.clientY);
      if (result) {
        this.eventDropped.emit(result);
      }
      this.preventNextClick = true;
      setTimeout(() => { this.preventNextClick = false; }, 300);
    }
    this.cancelMouseDrag();
    this.cdr.markForCheck();
  }

  private cancelMouseDrag(): void {
    this.isDragging = false;
    this.dragAppt = null;
    this.ghostVisible.set(false);
    this.dropHighlight.set(null);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  // ── Touch drag handlers ────────────────────────────────────────────────────

  public onEventTouchStart(e: TouchEvent, appt: IAppointment): void {
    if (e.touches.length !== 1) return;
    e.stopPropagation(); // не триггерить слот

    const touch = e.touches[0];
    this.dragAppt = appt;
    this.dragDurationMin = Math.round(
      (new Date(appt.endDate).getTime() - new Date(appt.startDate).getTime()) / 60000,
    );
    this.dragStartClientX = touch.clientX;
    this.dragStartClientY = touch.clientY;

    const { height } = getEventTopAndHeight(appt);
    this.ghostHeight.set(Math.max(height, 48));
    this.ghostWidth.set(this.getColumnWidth());
    this.ghostAppointment.set(appt);

    // Смещение тача относительно верха карточки
    const eventEl = (e.target as HTMLElement).closest('.day-view__event') as HTMLElement | null;    this.dragOffsetY = eventEl
      ? Math.min(touch.clientY - eventEl.getBoundingClientRect().top, this.ghostHeight())
      : 24;

    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);

    this.longPressTimer = setTimeout(() => {
      this.isDragging = true;
      this.updateGhost(touch.clientX, touch.clientY);
      this.ghostVisible.set(true);
      this.cdr.markForCheck();
      try { navigator.vibrate(30); } catch { /* ignore */ }
    }, this.LONG_PRESS_MS);
  }

  private onDocTouchMove(e: TouchEvent): void {
    if (!e.touches.length) return;
    const touch = e.touches[0];

    if (!this.isDragging) {
      const dx = Math.abs(touch.clientX - this.dragStartClientX);
      const dy = Math.abs(touch.clientY - this.dragStartClientY);
      if (dx > this.MOVE_CANCEL_PX || dy > this.MOVE_CANCEL_PX) {
        this.cancelDrag(); // пользователь скроллит — отменяем drag
      }
      return;
    }

    e.preventDefault(); // блокируем скролл во время drag
    this.updateGhost(touch.clientX, touch.clientY);
    this.updateDropHighlight(touch.clientX, touch.clientY);
    this.cdr.markForCheck();
  }

  private onDocTouchEnd(e: TouchEvent): void {
    if (this.isDragging && this.dragAppt) {
      const touch = e.changedTouches[0];
      const result = this.computeDropResult(touch.clientX, touch.clientY);
      if (result) {
        this.eventDropped.emit(result);
      }
      // Блокируем synthetic click, который браузер испустит после touchend
      this.preventNextClick = true;
      setTimeout(() => { this.preventNextClick = false; }, 600);
    }
    this.cancelDrag();
    this.cdr.markForCheck();
  }

  // ── Drop calculation ───────────────────────────────────────────────────────

  private updateGhost(clientX: number, clientY: number): void {
    this.ghostTop.set(clientY - this.dragOffsetY);
    this.ghostLeft.set(clientX - this.ghostWidth() / 2);
  }

  private updateDropHighlight(clientX: number, clientY: number): void {
    const pos = this.getDropPosition(clientX, clientY);
    if (!pos) { this.dropHighlight.set(null); return; }
    const snappedMin = Math.round(pos.minutesFromStart / 15) * 15;
    const pxPerMin = SLOT_HEIGHT_PX / SLOT_DURATION_MINUTES;
    const top = snappedMin * pxPerMin;
    this.dropHighlight.set({ colIdx: pos.colIdx, top, height: this.ghostHeight() });
  }

  private computeDropResult(clientX: number, clientY: number): IDragDropResult | null {
    const pos = this.getDropPosition(clientX, clientY);
    if (!pos || !this.dragAppt) return null;
    const column = this.columns[pos.colIdx];
    if (!column) return null;

    const snappedMin = Math.round(pos.minutesFromStart / 15) * 15;
    const totalMin = DAY_START_HOUR * 60 + snappedMin;
    // Строим DateTime явно через конструктор Date с компонентами — надёжно в любом timezone
    const newStart = new Date(
      this.viewDate.getFullYear(),
      this.viewDate.getMonth(),
      this.viewDate.getDate(),
      Math.floor(totalMin / 60),
      totalMin % 60,
      0,
      0,
    );
    const newEnd = new Date(newStart.getTime() + this.dragDurationMin * 60000);

    return {
      appointmentId: this.dragAppt._id,
      newStartDate: newStart.toISOString(),
      newEndDate: newEnd.toISOString(),
      newEmployeeId: column.employeeId,
    };
  }

  private getDropPosition(clientX: number, clientY: number): { colIdx: number; minutesFromStart: number } | null {
    const hostEl = this.el.nativeElement as HTMLElement;
    const columnsEl = hostEl.querySelector('.day-view__columns') as HTMLElement | null;
    if (!columnsEl || this.columns.length === 0) return null;

    const colEls = Array.from(
      columnsEl.querySelectorAll('.day-view__column'),
    ) as HTMLElement[];

    let colIdx = -1;
    colEls.forEach((el: HTMLElement, i: number) => {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) colIdx = i;
    });

    if (colIdx < 0) {
      const first = colEls[0]?.getBoundingClientRect();
      const last = colEls[colEls.length - 1]?.getBoundingClientRect();
      if (first && clientX < first.left) colIdx = 0;
      else if (last && clientX > last.right) colIdx = colEls.length - 1;
      else return null;
    }

    const columnsRect = columnsEl.getBoundingClientRect();
    const yInGrid = clientY - columnsRect.top - this.HEADER_HEIGHT;
    const pxPerMin = SLOT_HEIGHT_PX / SLOT_DURATION_MINUTES;
    const minutesFromStart = Math.max(0, yInGrid / pxPerMin);

    return { colIdx, minutesFromStart };
  }

  private getColumnWidth(): number {
    const hostEl = this.el.nativeElement as HTMLElement;
    const col = hostEl.querySelector('.day-view__column') as HTMLElement | null;
    const w = col?.getBoundingClientRect().width ?? 160;
    return Math.max(100, Math.min(w, 260));
  }

  private cancelDrag(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.isDragging = false;
    this.dragAppt = null;
    this.ghostVisible.set(false);
    this.dropHighlight.set(null);
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  // ── Grid build ────────────────────────────────────────────────────────────

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


