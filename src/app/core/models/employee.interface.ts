import { ESalaryRateType } from '@core/enums/e-salary-rate-type';
import { IService } from './appointment.interface';

export interface IEmployee {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  position?: string;
  description?: string;
  dateOfBirth?: string;
  languages?: string[];
  department: { _id: string; name: string } | null;
  avatar?: { _id: string; url: string } | null;
  services?: IService[];
  salaryRateType?: ESalaryRateType;
  baseAmount?: number;
  commissionPercent?: number;
}

export interface IEmployeeList {
  results: IEmployee[];
  count: number;
}
