import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IService } from '@core/models/appointment.interface';

export interface IServiceList {
  results: IService[];
  count: number;
}

@Injectable({ providedIn: 'root' })
export class ServicesService extends HttpHelper {
  public getServices(filters?: Record<string, unknown>): Observable<IServiceList> {
    return this.httpGetRequest<IServiceList>('api/service/', filters ?? {});
  }
}

