export interface IProduct {
  _id: string;
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number;
  description?: string;
  stock?: number;
  minStock?: number;
  maxStock?: number;
  status: 'active' | 'archived';
  stockStatus?: 'normal' | 'low' | 'out_of_stock';
  department?: { _id: string; name: string } | string;
  updatedAt?: string;
  created?: string;
}

export interface IConsumableProduct {
  product: string | IProduct;
  quantity: number;
}

export interface IProductList {
  results: IProduct[];
  count: number;
}

export type TProductHistoryAction =
  | 'created'
  | 'updated'
  | 'archived'
  | 'unarchived'
  | 'imported'
  | 'deleted'
  | 'consumed';

export interface IProductHistoryChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface IProductHistory {
  _id: string;
  product: string | IProduct;
  productName: string;
  action: TProductHistoryAction;
  changes?: IProductHistoryChange[];
  comment?: string;
  createdBy?: string;
  createdAt: string;
}

export interface IProductHistoryList {
  results: IProductHistory[];
  count: number;
}
