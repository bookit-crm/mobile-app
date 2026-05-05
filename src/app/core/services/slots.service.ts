import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';

export interface ISlotItem {
  time: string;
  maxAvailableMinutes: number;
  employeeId: string;
}

export interface ISlotsResponse {
  slots: Record<string, ISlotItem[]>;
}

@Injectable({ providedIn: 'root' })
export class SlotsService extends HttpHelper {
  public getSlots(params: {
    departmentId: string;
    startDate: string;
    duration?: number;
  }): Observable<ISlotsResponse> {
    return this.httpGetRequest<ISlotsResponse>('api/slots', params);
  }
}

