import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import {
  IConsumableStockWarning,
  IService,
  IServiceList,
} from '@core/models/service.interface';

export interface IServicesFilters {
  search?: string;
  departmentId?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class ServicesService extends HttpHelper {
  public servicesSignal: WritableSignal<IServiceList | null> = signal(null);

  public getServices(filters?: IServicesFilters): Observable<IServiceList> {
    return this.httpGetRequest<IServiceList>('api/service/', filters ?? {}).pipe(
      tap((resp) => this.servicesSignal.set(resp)),
    );
  }

  public getServiceById(id: string): Observable<IService> {
    return this.httpGetRequest<IService>(`api/service/${id}/`);
  }

  public create(payload: Partial<IService>): Observable<IService> {
    return this.httpPostRequest<Partial<IService>, IService>('api/service/', payload);
  }

  public patchServiceById(id: string, payload: Partial<IService>): Observable<IService> {
    return this.httpPatchRequest<IService, Partial<IService>>(`api/service/${id}/`, payload);
  }

  public delete(id: string): Observable<void> {
    return this.httpDeleteRequest<void>(`api/service/${id}/`);
  }

  public importExcel(file: File, departmentId: string): Observable<{ created: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('departmentId', departmentId);
    return this.httpPostRequest<FormData, { created: number; errors: string[] }>(
      'api/service/import-excel/',
      formData,
    );
  }

  public checkConsumablesStock(serviceIds: string[]): Observable<IConsumableStockWarning[]> {
    return this.httpPostRequest<{ serviceIds: string[] }, IConsumableStockWarning[]>(
      'api/service/check-consumables-stock/',
      { serviceIds },
    );
  }
}
