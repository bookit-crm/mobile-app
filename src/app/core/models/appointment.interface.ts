import { IEmployee } from './employee.interface';

export enum AppointmentStatus {
  New = 'new',
  Completed = 'completed',
  Canceled = 'canceled',
}

export interface IClient {
  _id: string;
  fullName: string;
  phone: string;
  email: string;
}

export interface IService {
  _id: string;
  name: string;
  duration: number;
  price: number;
}

export interface IConsumableProduct {
  product: string | { _id: string; name: string; unit?: string };
  quantity: number;
}

export interface IAppointment {
  _id: string;
  client?: IClient | null;
  clientName: string;
  clientPhone: string;
  startDate: string;
  endDate: string;
  duration: number;
  comment: string;
  status: AppointmentStatus;
  department: string | { _id: string; name: string };
  employee: IEmployee;
  services: IService[];
  totalPrice: number;
  discountAmount?: number;
  consumableProducts?: IConsumableProduct[];
  promoCode?: string;
  created: string;
}

export interface IAppointmentList {
  results: IAppointment[];
  count: number;
}

export interface IHistoryChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface IAppointmentHistory {
  _id: string;
  action: string;
  performedByName: string;
  changes: IHistoryChange[];
  created: string;
}

export interface IAppointmentHistoryList {
  results: IAppointmentHistory[];
  count: number;
}

export interface INewAppointmentPayload {
  employee?: string;
  department?: string;
  startDate?: string;
  _id?: string;
  from?: string;
  to?: string;
}
