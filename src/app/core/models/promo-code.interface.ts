import { IDepartment } from './department.interface';

export type DiscountType = 'percentage' | 'fixed';

export interface IPromoCodeService {
  service: string | { _id: string; name: string };
  discountType: DiscountType;
  discountValue: number;
}

export interface IPromoCode {
  _id: string;
  name: string;
  department: IDepartment | string;
  services: IPromoCodeService[];
  startDate: string | null;
  endDate: string | null;
  isVisible: boolean;
  createdBy?: { _id: string; email: string } | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IPromoCodeList {
  results: IPromoCode[];
  count: number;
}
