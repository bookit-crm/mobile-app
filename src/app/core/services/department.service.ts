import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IDepartment, IDepartmentList } from '@core/models/department.interface';

@Injectable({ providedIn: 'root' })
export class DepartmentService extends HttpHelper {
  public readonly departmentsSignal: WritableSignal<IDepartmentList | null> = signal(null);
  public readonly currentDepartmentSignal: WritableSignal<IDepartment | null> = signal(null);

  /** Возвращает первый (единственный) департамент при single-location плане. */
  public readonly singleDepartmentSignal: Signal<IDepartment | null> = computed(
    () => this.departmentsSignal()?.results?.[0] ?? null,
  );

  public getDepartments(filters?: Record<string, unknown>): Observable<IDepartmentList> {
    return this.httpGetRequest<IDepartmentList>('api/department/', filters ?? {}).pipe(
      tap((res) => this.departmentsSignal.set(res)),
    );
  }

  public getDepartmentById(id: string): Observable<IDepartment> {
    return this.httpGetRequest<IDepartment>(`api/department/${id}/`).pipe(
      tap((res) => this.currentDepartmentSignal.set(res)),
    );
  }

  public addDepartment(payload: Partial<IDepartment>): Observable<IDepartment> {
    return this.httpPostRequest<Partial<IDepartment>, IDepartment>('api/department/', payload);
  }

  public patchDepartment(id: string, payload: Partial<IDepartment>): Observable<IDepartment> {
    return this.httpPatchRequest<IDepartment, Partial<IDepartment>>(`api/department/${id}/`, payload).pipe(
      tap((res) => this.currentDepartmentSignal.set(res)),
    );
  }

  public deleteDepartment(id: string): Observable<{ message: string }> {
    return this.httpDeleteRequest<{ message: string }>(`api/department/${id}/`);
  }
}

