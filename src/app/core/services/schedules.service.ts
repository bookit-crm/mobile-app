import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpHelper } from "@core/helpers/http-helper";
import { IDailyScheduleResponse, ISchedule, ISchedulePayload, IScheduleQueries } from "@core/models/schedule.interface";
@Injectable({ providedIn: "root" })
export class SchedulesService extends HttpHelper {
  public getSchedules(filters?: IScheduleQueries): Observable<ISchedule[]> {
    return this.httpGetRequest<ISchedule[]>("api/schedule/", filters ?? {});
  }

  public getDailySchedule(departmentId: string, date: string): Observable<IDailyScheduleResponse> {
    return this.httpGetRequest<IDailyScheduleResponse>("api/schedule/daily/", { departmentId, date });
  }

  public createSchedules(payload: ISchedulePayload): Observable<ISchedule> {
    return this.httpPostRequest<ISchedulePayload, ISchedule>("api/schedule/", payload);
  }

  public patchSchedules(id: string, payload: ISchedulePayload): Observable<ISchedule> {
    return this.httpPatchRequest<ISchedule>(`api/schedule/${id}/`, payload);
  }
}
