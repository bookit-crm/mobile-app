import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import {
  ICreatePeriodsPayload,
  ICreatePeriodsResponse,
  IMonthStatus,
  IPayoutPayload,
  IPayrollLineItem,
  IPayrollPeriod,
  IPayrollPeriodSummary,
} from '@core/models/payroll.interface';

export interface IPaginatedPayrollPeriods {
  results: IPayrollPeriod[];
  count: number;
}

export interface IPaginatedPayrollLineItems {
  results: IPayrollLineItem[];
  count: number;
}

@Injectable({ providedIn: 'root' })
export class PayrollService extends HttpHelper {
  public readonly periodsSignal: WritableSignal<IPaginatedPayrollPeriods | null> = signal(null);
  public readonly lineItemsSignal: WritableSignal<IPaginatedPayrollLineItems | null> = signal(null);
  public readonly monthStatusesSignal: WritableSignal<IMonthStatus[]> = signal([]);

  public getPeriods(filters?: Record<string, unknown>): Observable<IPaginatedPayrollPeriods> {
    return this.httpGetRequest<IPaginatedPayrollPeriods>('api/payroll/periods/', filters ?? {}).pipe(
      tap((res) => this.periodsSignal.set(res)),
    );
  }

  public getMonthStatuses(year: number): Observable<IMonthStatus[]> {
    return this.httpGetRequest<IMonthStatus[]>('api/payroll/periods/month-statuses/', { year }).pipe(
      tap((res) => this.monthStatusesSignal.set(res)),
    );
  }

  public createPeriodsForMonth(
    employeeIds: string[],
    supervisorIds: string[] = [],
    month?: number,
    year?: number,
  ): Observable<ICreatePeriodsResponse> {
    return this.httpPostRequest<ICreatePeriodsPayload, ICreatePeriodsResponse>(
      'api/payroll/periods/batch/',
      { employeeIds, supervisorIds, month, year },
    );
  }

  public getPeriodById(id: string): Observable<IPayrollPeriod> {
    return this.httpGetRequest<IPayrollPeriod>(`api/payroll/periods/${id}/`);
  }

  public getPeriodSummary(periodId: string): Observable<IPayrollPeriodSummary> {
    return this.httpGetRequest<IPayrollPeriodSummary>(`api/payroll/periods/${periodId}/summary/`);
  }

  public deleteOpenPeriod(periodId: string): Observable<{ message: string }> {
    return this.httpDeleteRequest<{ message: string }>(`api/payroll/periods/${periodId}/`);
  }

  public syncLineItems(periodId: string): Observable<{ message: string; created: number; skipped: number }> {
    return this.httpPostRequest<object, { message: string; created: number; skipped: number }>(
      `api/payroll/periods/${periodId}/sync/`,
      {},
    );
  }

  public getLineItems(
    periodId: string,
    filters?: Record<string, unknown>,
  ): Observable<IPaginatedPayrollLineItems> {
    return this.httpGetRequest<IPaginatedPayrollLineItems>(
      `api/payroll/periods/${periodId}/line-items/`,
      filters ?? {},
    ).pipe(tap((res) => this.lineItemsSignal.set(res)));
  }

  public payoutPeriod(periodId: string, payload: IPayoutPayload): Observable<{ message: string }> {
    return this.httpPostRequest<IPayoutPayload, { message: string }>(
      `api/payroll/periods/${periodId}/payout/`,
      payload,
    );
  }

  public downloadPdf(periodId: string): Observable<Blob> {
    return this.http.get(`api/payroll/periods/${periodId}/download-pdf/`, {
      headers: this.getHttpHeaders(),
      responseType: 'blob',
    });
  }

  public downloadCsv(periodId: string): Observable<Blob> {
    return this.http.get(`api/payroll/periods/${periodId}/download-csv/`, {
      headers: this.getHttpHeaders(),
      responseType: 'blob',
    });
  }
}

