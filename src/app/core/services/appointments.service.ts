import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IAppointment } from '@core/models/appointment.interface';

@Injectable({ providedIn: 'root' })
export class AppointmentsService extends HttpHelper {
  public getAppointmentsRaw(filters?: Record<string, unknown>): Observable<IAppointment[]> {
    return this.httpGetRequest<IAppointment[]>('api/appointment/', filters ?? {});
  }

  public getAppointmentById(id: string): Observable<IAppointment> {
    return this.httpGetRequest<IAppointment>(`api/appointment/${id}/`);
  }

  public postAppointment(payload: Partial<IAppointment>): Observable<IAppointment> {
    return this.httpPostRequest<Partial<IAppointment>, IAppointment>('api/appointment/', payload);
  }

  public patchAppointmentById(id: string, payload: Partial<IAppointment>): Observable<IAppointment> {
    return this.httpPatchRequest<IAppointment, Partial<IAppointment>>(`api/appointment/${id}/`, payload);
  }

  public deleteAppointmentById(id: string): Observable<void> {
    return this.httpDeleteRequest<void>(`api/appointment/${id}/`);
  }
}

