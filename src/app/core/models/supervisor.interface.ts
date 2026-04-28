import { EUserRole } from '@core/enums/e-user-role';
import { ESalaryRateType } from '@core/enums/e-salary-rate-type';

export interface ISupervisor {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string;
  role: EUserRole;
  avatar?: { _id: string; url: string } | null;
  department?: { _id: string; name: string; manager?: string | null } | string | null;
  accessAllowed?: boolean;
  expiresSoon?: boolean;
  subscriptionRenewalDate?: string;
  salaryRateType?: ESalaryRateType;
  baseAmount?: number;
  commissionPercent?: number;
}

export interface ISupervisorList {
  results: ISupervisor[];
  count: number;
}
