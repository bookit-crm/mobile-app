import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IPromoCode, IPromoCodeList } from '@core/models/promo-code.interface';

export interface IPromoCodesFilters {
  isVisible?: string;
  departmentId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class PromoCodesService extends HttpHelper {

  public promoCodesSignal: WritableSignal<IPromoCodeList | null> = signal(null);

  getPromoCodes(filters?: IPromoCodesFilters): Observable<IPromoCodeList> {
    return this.httpGetRequest<IPromoCodeList>('api/promo-code/', filters).pipe(
      tap((res) => this.promoCodesSignal.set(res)),
    );
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

  create(payload: Partial<IPromoCode>): Observable<IPromoCode> {
    return this.httpPostRequest<Partial<IPromoCode>, IPromoCode>('api/promo-code/', payload);
  }

  update(id: string, payload: Partial<IPromoCode>): Observable<IPromoCode> {
    return this.httpPatchRequest<IPromoCode, Partial<IPromoCode>>(`api/promo-code/${id}/`, payload);
  }

  delete(id: string): Observable<void> {
    return this.httpDeleteRequest<void>(`api/promo-code/${id}/`);
  }

  toggleVisibility(id: string): Observable<IPromoCode> {
    return this.httpPatchRequest<IPromoCode, Record<string, never>>(`api/promo-code/${id}/toggle-visibility/`, {});
  }
}
