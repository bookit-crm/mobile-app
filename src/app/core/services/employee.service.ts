import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpHelper } from "@core/helpers/http-helper";
import { IEmployee } from "@core/models/employee.interface";
export interface IEmployeeList {
  results: IEmployee[];
  count: number;
}
@Injectable({ providedIn: "root" })
export class EmployeeService extends HttpHelper {
  public getEmployees(filters?: Record<string, unknown>): Observable<IEmployeeList> {
    return this.httpGetRequest<IEmployeeList>("api/employee/", filters ?? {});
  }
}
