import { Injectable } from '@angular/core';
import { Params } from '@angular/router';
import { HttpHelper } from '@core/helpers/http-helper';
import { Observable } from 'rxjs';

export type ReportType =
  | 'appointments'
  | 'staff_performance'
  | 'client_detailed'
  | 'inventory_history';

export type ReportFormat = 'excel' | 'pdf';

export interface IReportParams extends Params {
  type: ReportType;
  format: ReportFormat;
  departmentId?: string;
  employeeIds?: string[];
  from?: string;
  to?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ReportService extends HttpHelper {
  public downloadReport(params: IReportParams): Observable<Blob> {
    const headers = this.getHttpHeaders();
    return this.http.get('api/report/generate/', {
      headers,
      params: params as Params,
      responseType: 'blob',
    });
  }
}

