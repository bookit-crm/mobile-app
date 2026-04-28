export type DiscountType = 'percentage' | 'fixed';

export interface IPromoCodeService {
  service: string | { _id: string; name: string };
  discountType: DiscountType;
  discountValue: number;
}

export interface IPromoCode {
  _id: string;
  name: string;
  services: IPromoCodeService[];
  startDate: string | null;
  endDate: string | null;
  isVisible: boolean;
}

export interface IPromoCodeList {
  results: IPromoCode[];
  count: number;
}

