import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IDepartment, IDepartmentList } from '@core/models/department.interface';

@Injectable({ providedIn: 'root' })
export class DepartmentService extends HttpHelper {
  public getDepartments(filters?: Record<string, unknown>): Observable<IDepartmentList> {
    return this.httpGetRequest<IDepartmentList>('api/department/', filters ?? {});
  }

  public getDepartmentById(id: string): Observable<IDepartment> {
    return this.httpGetRequest<IDepartment>(`api/department/${id}/`);
  }
}

