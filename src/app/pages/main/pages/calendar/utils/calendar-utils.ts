import { IAppointment } from '@core/models/appointment.interface';
import { ISchedule } from '@core/models/schedule.interface';
import { format, startOfDay } from 'date-fns';

export interface ITimeSlot {
  time: string;
  date: Date;
  hour: number;
  minute: number;
}

export interface ICalendarColumn {
  employeeId: string;
  departmentId: string;
  employeeName: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  slots: ITimeSlot[];
  events: IPositionedEvent[];
}

export interface IPositionedEvent {
  appointment: IAppointment;
  top: number;
  height: number;
  left: number;
  width: number;
}

export const DAY_START_HOUR = 5;
export const DAY_END_HOUR = 24;
export const SLOT_DURATION_MINUTES = 30;
export const SLOT_HEIGHT_PX = 48;

export function generateTimeSlots(
  date: Date,
  startHour = DAY_START_HOUR,
  endHour = DAY_END_HOUR,
  intervalMinutes = SLOT_DURATION_MINUTES,
): ITimeSlot[] {
  const slots: ITimeSlot[] = [];
  const baseDate = startOfDay(date);

  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      const slotDate = new Date(baseDate);
      slotDate.setHours(h, m, 0, 0);
      slots.push({ time: format(slotDate, 'HH:mm'), date: slotDate, hour: h, minute: m });
    }
  }
  return slots;
}

export function getEventTopAndHeight(
  appointment: IAppointment,
  dayStartHour = DAY_START_HOUR,
  slotHeightPx = SLOT_HEIGHT_PX,
  slotDurationMin = SLOT_DURATION_MINUTES,
): { top: number; height: number } {
  const start = new Date(appointment.startDate);
  const end = new Date(appointment.endDate);
  const startMin = (start.getHours() - dayStartHour) * 60 + start.getMinutes();
  const endMin = (end.getHours() - dayStartHour) * 60 + end.getMinutes();
  const pxPerMin = slotHeightPx / slotDurationMin;
  return {
    top: Math.max(startMin * pxPerMin, 0),
    height: Math.max((endMin - startMin) * pxPerMin, slotHeightPx / 2),
  };
}

export function isOutsideWorkingHours(
  segmentDate: Date,
  employeeId: string,
  schedules: ISchedule[],
): boolean {
  if (!employeeId) return true;
  const currentDay = (segmentDate.getDay() + 6) % 7;

  const empSchedules = schedules.filter(
    (s) => s.employee && s.employee._id === employeeId,
  );
  const defaultSchedule = empSchedules.find((s) => !s.date);
  const customSchedule = empSchedules.find(
    (s) => s.date && new Date(s.date).toLocaleDateString() === segmentDate.toLocaleDateString(),
  );
  const active = customSchedule || defaultSchedule;
  if (!active) return true;

  const daySchedule = active.days.find((d) => d.day === currentDay);
  if (!daySchedule) return true;

  const applyTime = (timeStr: string, target: Date): Date => {
    const t = new Date(timeStr);
    const res = new Date(target);
    res.setUTCHours(t.getUTCHours(), t.getUTCMinutes(), 0, 0);
    return res;
  };

  const workFrom = applyTime(daySchedule.from, segmentDate);
  const workTo = applyTime(daySchedule.to, segmentDate);
  const isWorking = segmentDate >= workFrom && segmentDate < workTo;
  const isBreak = daySchedule.brake_times?.some((b) => {
    const bFrom = applyTime(b.from, segmentDate);
    const bTo = applyTime(b.to, segmentDate);
    return segmentDate >= bFrom && segmentDate < bTo;
  });
  return !isWorking || !!isBreak;
}

export function layoutOverlappingEvents(events: IPositionedEvent[]): IPositionedEvent[] {
  if (!events.length) return events;

  const sorted = [...events].sort((a, b) => a.top - b.top || b.height - a.height);
  const clusters: IPositionedEvent[][] = [];
  let current: IPositionedEvent[] = [sorted[0]];
  let clusterEnd = sorted[0].top + sorted[0].height;

  for (let i = 1; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.top < clusterEnd) {
      current.push(ev);
      clusterEnd = Math.max(clusterEnd, ev.top + ev.height);
    } else {
      clusters.push(current);
      current = [ev];
      clusterEnd = ev.top + ev.height;
    }
  }
  clusters.push(current);

  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    for (const ev of cluster) {
      let placed = false;
      for (let col = 0; col < columnEnds.length; col++) {
        if (ev.top >= columnEnds[col]) {
          columnEnds[col] = ev.top + ev.height;
          (ev as any)['_col'] = col;
          placed = true;
          break;
        }
      }
      if (!placed) {
        (ev as any)['_col'] = columnEnds.length;
        columnEnds.push(ev.top + ev.height);
      }
    }
    const widthPct = 100 / columnEnds.length;
    for (const ev of cluster) {
      const col = (ev as any)['_col'] as number;
      ev.width = widthPct;
      ev.left = col * widthPct;
      delete (ev as any)['_col'];
    }
  }
  return events;
}

