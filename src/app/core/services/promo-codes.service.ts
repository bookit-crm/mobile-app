import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IPromoCode, IPromoCodeList } from '@core/models/promo-code.interface';

@Injectable({ providedIn: 'root' })
export class PromoCodesService extends HttpHelper {

  getPromoCodes(filters?: {
    isVisible?: string;
    departmentId?: string;
    limit?: number;
    offset?: number;
  }): Observable<IPromoCodeList> {
    return this.httpGetRequest<IPromoCodeList>('api/promo-code/', filters);
  }

  getActiveForDepartment(departmentId: string): Observable<IPromoCodeList> {
    return this.httpGetRequest<IPromoCodeList>('api/promo-code/', {
      departmentId,
      isVisible: 'true',
      limit: 100,
    });
  }

  getById(id: string): Observable<IPromoCode> {
    return this.httpGetRequest<IPromoCode>(`api/promo-code/${id}/`);
  }
}

