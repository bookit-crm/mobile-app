export interface IProduct {
  _id: string;
  name: string;
  sku?: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number;
  description?: string;
  stock?: number;
  status: 'active' | 'archived';
}

export interface IConsumableProduct {
  product: string | IProduct;
  quantity: number;
}

export interface IProductList {
  results: IProduct[];
  count: number;
}

