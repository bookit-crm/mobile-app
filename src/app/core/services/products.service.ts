import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IProduct, IProductList } from '@core/models/product.interface';

@Injectable({ providedIn: 'root' })
export class ProductsService extends HttpHelper {

  getProducts(filters?: {
    departmentId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Observable<IProductList> {
    return this.httpGetRequest<IProductList>('api/product/', filters);
  }

  getById(id: string): Observable<IProduct> {
    return this.httpGetRequest<IProduct>(`api/product/${id}/`);
  }
}

