import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IExpense } from '@core/models/expense.interface';
import { PaginatedResponseModel } from '@core/models/paginated-response.model';

export interface IExpenseFilters {
  search?: string;
  category?: string;
  status?: string;
  recurrence?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class ExpensesService extends HttpHelper {

  public readonly expensesSignal: WritableSignal<PaginatedResponseModel<IExpense> | null> = signal(null);

  getExpenses(filters?: IExpenseFilters): Observable<PaginatedResponseModel<IExpense>> {
    return this.httpGetRequest<PaginatedResponseModel<IExpense>>('api/expense/', filters).pipe(
      tap((res) => this.expensesSignal.set(res)),
    );
  }

  getExpenseById(id: string): Observable<IExpense> {
    return this.httpGetRequest<IExpense>(`api/expense/${id}/`);
  }

  createExpense(payload: Record<string, unknown>): Observable<IExpense> {
    return this.httpPostRequest<Record<string, unknown>, IExpense>('api/expense/', payload);
  }

  updateExpense(id: string, payload: Record<string, unknown>): Observable<IExpense> {
    return this.httpPatchRequest<IExpense>(`api/expense/${id}/`, payload);
  }

  deleteExpense(id: string): Observable<void> {
    return this.httpDeleteRequest<void>(`api/expense/${id}/`);
  }
}

