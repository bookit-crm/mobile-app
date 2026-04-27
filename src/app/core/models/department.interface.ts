import { ISupervisor } from './supervisor.interface';
import { IFileDTO } from './file.interface';

export interface IDepartmentLocation {
  formattedAddress?: string;
  lat?: number;
  lng?: number;
}

export interface IDepartmentScheduleDay {
  day: number;   // 0=Sun…6=Sat
  from: string | null;
  to: string | null;
}

export interface IDepartmentStats {
  employees?: number;
  services?: number;
  appointments?: number;
}

export interface IDepartment {
  _id: string;
  name: string;
  phone?: string;
  status?: 'active' | 'inactive';
  location?: IDepartmentLocation;
  websiteURL?: string;
  specializations?: string[];
  created?: string;
  logo?: IFileDTO | null;
  bannerImages?: IFileDTO[];
  galleryImages?: IFileDTO[];
  schedule?: IDepartmentScheduleDay[];
  manager?: ISupervisor | null;
  stats?: IDepartmentStats;
}

export interface IDepartmentList {
  results: IDepartment[];
  count: number;
}

