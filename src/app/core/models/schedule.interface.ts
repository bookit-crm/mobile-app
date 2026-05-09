import { IEmployee } from './employee.interface';

export interface ITimeSegment {
  from: string;
  to: string;
}

export interface IDayModel extends ITimeSegment {
  day: number;
  brake_times: ITimeSegment[];
}

export interface ISchedule {
  _id: string;
  employee?: IEmployee;
  department: string;
  days: IDayModel[];
  date?: string;
}

export interface IScheduleQueries {
  from?: string;
  to?: string;
  default?: boolean;
  departmentId?: string;
  employeeIds?: string[];
  supervisorIds?: string[];
  statuses?: string[];
}

export interface ISchedulePayload {
  days: Partial<IDayModel>[];
  department: string;
  employee?: string;
  supervisor?: string;
}

/** Строка расписания для UI (сигнальный подход, как в department) */
export interface IScheduleRow {
  day: number;    // 0=Sun … 6=Sat
  label: string;
  enabled: boolean;
  from: string;   // HH:mm
  to: string;     // HH:mm
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Порядок отображения: Пн–Вс */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Маппинг dayIndex → i18n ключ для локализованных меток дней */
export const DAY_KEY_MAP: Record<number, string> = {
  0: 'DAY_SUN',
  1: 'DAY_MON',
  2: 'DAY_TUE',
  3: 'DAY_WED',
  4: 'DAY_THU',
  5: 'DAY_FRI',
  6: 'DAY_SAT',
};

export interface IDailyEmployeeSchedule {
  employee: IEmployee;
  daySchedule: IDayModel | null;
  status: 'working' | 'dayOff';
}

export interface IDailyScheduleResponse {
  departmentSchedule: IDayModel | null;
  employees: IDailyEmployeeSchedule[];
  managers: IDailyEmployeeSchedule[];
}
