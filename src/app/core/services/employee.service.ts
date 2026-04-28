import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IEmployee, IEmployeeList } from '@core/models/employee.interface';

@Injectable({ providedIn: 'root' })
export class EmployeeService extends HttpHelper {
  /** Общее количество сотрудников — для проверки лимита подписки. */
  public readonly totalCount: WritableSignal<number> = signal(0);

  public getEmployees(filters?: Record<string, unknown>): Observable<IEmployeeList> {
    return this.httpGetRequest<IEmployeeList>('api/employee/', filters ?? {}).pipe(
      tap((res) => this.totalCount.set(res?.count ?? 0)),
    );
  }

  public getEmployeeById(id: string): Observable<IEmployee> {
    return this.httpGetRequest<IEmployee>(`api/employee/${id}/`);
  }

  public addEmployee(payload: Partial<IEmployee>): Observable<IEmployee> {
    return this.httpPostRequest<Partial<IEmployee>, IEmployee>('api/employee/', payload);
  }

  public patchEmployee(id: string, payload: Partial<IEmployee>): Observable<IEmployee> {
    return this.httpPatchRequest<IEmployee>(`api/employee/${id}/`, payload);
  }

  public deleteEmployee(id: string): Observable<void> {
    return this.httpDeleteRequest<void>(`api/employee/${id}/`);
  }
}
