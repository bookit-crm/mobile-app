import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpHelper } from "@core/helpers/http-helper";
import { IDailyScheduleResponse, ISchedule, IScheduleQueries } from "@core/models/schedule.interface";
@Injectable({ providedIn: "root" })
export class SchedulesService extends HttpHelper {
  public getSchedules(filters?: IScheduleQueries): Observable<ISchedule[]> {
    return this.httpGetRequest<ISchedule[]>("api/schedule/", filters ?? {});
  }

  public getDailySchedule(departmentId: string, date: string): Observable<IDailyScheduleResponse> {
    return this.httpGetRequest<IDailyScheduleResponse>("api/schedule/daily/", { departmentId, date });
  }
}
