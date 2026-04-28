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
  employee: IEmployee;
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
  statuses?: string[];
}

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

