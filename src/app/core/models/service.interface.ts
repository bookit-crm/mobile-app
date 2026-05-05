import { IFileDTO } from '@core/models/file.interface';
import { IProduct } from '@core/models/product.interface';
import { IDepartment } from '@core/models/department.interface';
import { IKeyValuePair } from '@core/models/application.interface';

export interface IConsumableProduct {
  product: IProduct | string;
  quantity: number;
}

export interface IConsumableStockWarning {
  productId: string;
  productName: string;
  sku: string;
  requiredQuantity: number;
  currentStock: number;
  status: 'out_of_stock' | 'low_stock' | 'insufficient';
}

export interface IService {
  _id: string;
  name: string;
  description: string;
  category: IKeyValuePair;
  duration: number;
  price: number;
  department: IDepartment | string;
  created: string;
  galleryImages?: IFileDTO[];
  consumableProducts?: IConsumableProduct[];
}

export interface IServiceList {
  results: IService[];
  count: number;
}

