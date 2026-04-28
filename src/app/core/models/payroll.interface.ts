import {
  EPaymentMethod,
  EPayrollLineItemStatus,
  EPayrollPeriodStatus,
} from '@core/enums/e-payroll';
import { ESalaryRateType } from '@core/enums/e-salary-rate-type';
import { IAppointment } from '@core/models/appointment.interface';
import { IEmployee } from '@core/models/employee.interface';
import { ISupervisor } from '@core/models/supervisor.interface';

export interface IPayrollPeriod {
  _id: string;
  employee: IEmployee | null;
  supervisor: ISupervisor | null;
  periodStart: string;
  periodEnd: string;
  status: EPayrollPeriodStatus;
  rateTypeSnapshot: ESalaryRateType | null;
  baseAmountSnapshot: number | null;
  commissionPercentSnapshot: number | null;
  totalBase: number;
  totalCommission: number;
  totalPayout: number;
  paidAt: string | null;
  paidBy: { _id: string; name: string; email: string } | null;
  paymentMethod: EPaymentMethod | null;
  paymentNote: string | null;
  expense: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IPayrollLineItem {
  _id: string;
  payrollPeriod: string;
  appointment: IAppointment;
  servicePrice: number;
  discount: number;
  commissionBase: number;
  appliedRatePercent: number;
  commissionAmount: number;
  status: EPayrollLineItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IPayrollPeriodSummary {
  appointmentCount: number;
  totalCommission: number;
  totalBase: number;
  totalPayout: number;
  rateType: ESalaryRateType;
  baseAmount: number;
  commissionPercent: number;
}

export interface IPayoutPayload {
  paymentMethod: EPaymentMethod;
  paymentDate: string;
  paymentNote?: string;
}

export interface ICreatePeriodsPayload {
  employeeIds?: string[];
  supervisorIds?: string[];
  month?: number;
  year?: number;
}

export interface ICreatePeriodsResponse {
  message: string;
  created: number;
  skipped: number;
}

export interface IMonthStatus {
  month: number;
  year: number;
  statuses: string[];
  periodsCount: number;
}

