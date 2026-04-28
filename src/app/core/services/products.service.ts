import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IProduct, IProductHistoryList, IProductList } from '@core/models/product.interface';

export interface IProductFilters {
  search?: string;
  status?: string;
  stockStatus?: string;
  departmentId?: string;
  limit?: number;
  offset?: number;
}

export interface ICreateProductPayload {
  name: string;
  sku?: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  stock?: number;
  minStock?: number;
  maxStock?: number;
  description?: string;
  department?: string;
}

export interface IUpdateProductPayload extends Partial<ICreateProductPayload> {
  comment?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductsService extends HttpHelper {

  getProducts(filters?: IProductFilters): Observable<IProductList> {
    return this.httpGetRequest<IProductList>('api/product/', filters);
  }

  getById(id: string): Observable<IProduct> {
    return this.httpGetRequest<IProduct>(`api/product/${id}/`);
  }

  create(payload: ICreateProductPayload): Observable<IProduct> {
    return this.httpPostRequest<ICreateProductPayload, IProduct>('api/product/', payload);
  }

  update(id: string, payload: IUpdateProductPayload): Observable<IProduct> {
    return this.httpPatchRequest<IProduct>(`api/product/${id}/`, payload);
  }

  archive(id: string, comment?: string): Observable<IProduct> {
    const url = comment
      ? `api/product/${id}/archive/?comment=${encodeURIComponent(comment)}`
      : `api/product/${id}/archive/`;
    return this.httpPatchRequest<IProduct>(url, {});
  }

  unarchive(id: string, comment?: string): Observable<IProduct> {
    const url = comment
      ? `api/product/${id}/unarchive/?comment=${encodeURIComponent(comment)}`
      : `api/product/${id}/unarchive/`;
    return this.httpPatchRequest<IProduct>(url, {});
  }

  delete(id: string): Observable<void> {
    return this.httpDeleteRequest(`api/product/${id}/`);
  }

  getProductHistory(
    productId: string,
    filters?: { action?: string; from?: string; to?: string; limit?: number; offset?: number },
  ): Observable<IProductHistoryList> {
    return this.httpGetRequest<IProductHistoryList>(`api/product/${productId}/history/`, filters);
  }

  getAllProductsHistory(
    filters?: { action?: string; from?: string; to?: string; limit?: number; offset?: number },
  ): Observable<IProductHistoryList> {
    return this.httpGetRequest<IProductHistoryList>('api/product/history/', filters);
  }
}
