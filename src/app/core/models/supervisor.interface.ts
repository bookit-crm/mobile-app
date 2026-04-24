import { EUserRole } from '@core/enums/e-user-role';

export interface ISupervisor {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: EUserRole;
  avatar?: { url: string };
  department?: { _id: string; name: string } | string;
}

