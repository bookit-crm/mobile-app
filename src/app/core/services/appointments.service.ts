import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import {
  IAppointment,
  IAppointmentList,
  IAppointmentHistoryList,
} from '@core/models/appointment.interface';

@Injectable({ providedIn: 'root' })
export class AppointmentsService extends HttpHelper {
  public appointmentsSignal: WritableSignal<IAppointmentList | null> = signal(null);

  public getAppointmentsPaginated(filters?: Record<string, unknown>): Observable<IAppointmentList> {
    return this.httpGetRequest<IAppointmentList>('api/appointment/paginated/', filters ?? {}).pipe(
      tap((res) => this.appointmentsSignal.set(res)),
    );
  }

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

  public getAppointmentHistory(id: string, filters?: Record<string, unknown>): Observable<IAppointmentHistoryList> {
    return this.httpGetRequest<IAppointmentHistoryList>(`api/appointment/${id}/history/`, filters ?? {});
  }
}

