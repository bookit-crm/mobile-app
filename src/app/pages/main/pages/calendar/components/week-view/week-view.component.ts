import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  DestroyRef, effect, ElementRef, inject, input, output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { addDays, format, isSameDay, parse, startOfWeek } from 'date-fns';
import { IAppointment, INewAppointmentPayload } from '@core/models/appointment.interface';
import { ISchedule } from '@core/models/schedule.interface';
import {
  generateTimeSlots, getEventTopAndHeight, isOutsideWorkingHours,
  layoutOverlappingEvents, ITimeSlot, IPositionedEvent,
  IDragDropResult,
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
  private readonly el = inject(ElementRef<HTMLElement>);

  public readonly date = input<string>('');
  public readonly appointments = input<IAppointment[]>([]);
  public readonly schedules = input<ISchedule[]>([]);
  public readonly selectedEmployeeId = input<string>('');

  public readonly slotClicked = output<INewAppointmentPayload>();
  public readonly eventClicked = output<INewAppointmentPayload>();
  public readonly eventDropped = output<IDragDropResult>();

  public weekDays: IWeekDayColumn[] = [];
  public timeLabels: ITimeSlot[] = [];
  public SLOT_HEIGHT = SLOT_HEIGHT_PX;
  public currentTimeTop: number | null = null;

  // ── Ghost & drop highlight ─────────────────────────────────────────────────
  public readonly ghostVisible = signal(false);
  public readonly ghostTop = signal(0);
  public readonly ghostLeft = signal(0);
  public readonly ghostHeight = signal(48);
  public readonly ghostWidth = signal(120);
  public readonly ghostAppointment = signal<IAppointment | null>(null);
  public readonly dropHighlight = signal<{ colIdx: number; top: number; height: number } | null>(null);

  private readonly HEADER_HEIGHT = 56;
  private viewDate: Date = new Date();

  // ── Drag state ─────────────────────────────────────────────────────────────
  private dragAppt: IAppointment | null = null;
  private dragDurationMin = 0;
  private isDragging = false;
  private dragOffsetY = 0;
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
      this.selectedEmployeeId();
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
    if (this.preventNextClick) {
      this.preventNextClick = false;
      return;
    }
    this.eventClicked.emit({ _id: appointment._id });
  }

  // ── Mouse drag handlers (эмулятор / десктоп браузер) ─────────────────────

  public onEventMouseDown(e: MouseEvent, appt: IAppointment): void {
    if (e.button !== 0) return;
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

    const eventEl = (e.target as HTMLElement).closest('.week-view__event') as HTMLElement | null;
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
    e.stopPropagation();

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

    const eventEl = (e.target as HTMLElement).closest('.week-view__event') as HTMLElement | null;
    this.dragOffsetY = eventEl
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
        this.cancelDrag();
      }
      return;
    }

    e.preventDefault();
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
    const day = this.weekDays[pos.colIdx];
    if (!day) return null;

    const snappedMin = Math.round(pos.minutesFromStart / 15) * 15;
    const totalMin = DAY_START_HOUR * 60 + snappedMin;
    const d = day.date;
    const newStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(totalMin / 60), totalMin % 60, 0, 0);
    const newEnd = new Date(newStart.getTime() + this.dragDurationMin * 60000);

    const empId = typeof this.dragAppt.employee === 'string'
      ? this.dragAppt.employee
      : this.dragAppt.employee?._id;

    return {
      appointmentId: this.dragAppt._id,
      newStartDate: newStart.toISOString(),
      newEndDate: newEnd.toISOString(),
      newEmployeeId: empId || undefined,
    };
  }

  private getDropPosition(clientX: number, clientY: number): { colIdx: number; minutesFromStart: number } | null {
    const hostEl = this.el.nativeElement as HTMLElement;
    const columnsEl = hostEl.querySelector('.week-view__columns') as HTMLElement | null;
    if (!columnsEl || this.weekDays.length === 0) return null;

    const colEls = Array.from(
      columnsEl.querySelectorAll('.week-view__column'),
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
    const col = hostEl.querySelector('.week-view__column') as HTMLElement | null;
    const w = col?.getBoundingClientRect().width ?? 120;
    return Math.max(80, Math.min(w, 200));
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

