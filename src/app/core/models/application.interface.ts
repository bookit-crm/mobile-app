import { EUserRole } from '@core/enums/e-user-role';

export interface IBaseQueries {
  departmentId?: string;
  employeeIds?: string[];
  clientId?: string;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
  search?: string;
  role?: EUserRole;
  status?: string;
  stockStatus?: string;
  lastVisitFrom?: string;
  lastVisitTo?: string;
}

export interface IKeyValuePair<T = string> {
  value: T;
  display: string;
  text?: string;
  isSelected?: boolean;
}

export type AnyEntity = unknown;

