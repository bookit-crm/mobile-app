import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IClient, IClientList, ICreateClientPayload } from '@core/models/client.interface';
import { IAppointmentList } from '@core/models/appointment.interface';

@Injectable({ providedIn: 'root' })
export class ClientsService extends HttpHelper {
  public getClients(filters?: Record<string, unknown>): Observable<IClientList> {
    return this.httpGetRequest<IClientList>('api/client/', filters ?? {});
  }

  public getClientById(id: string): Observable<IClient> {
    return this.httpGetRequest<IClient>(`api/client/${id}/`);
  }

  public addClient(payload: ICreateClientPayload): Observable<IClient> {
    return this.httpPostRequest<ICreateClientPayload, IClient>('api/client/', payload);
  }

  public patchClient(id: string, payload: Partial<ICreateClientPayload>): Observable<IClient> {
    return this.httpPatchRequest<IClient, Partial<ICreateClientPayload>>(`api/client/${id}/`, payload);
  }

  public deleteClient(id: string): Observable<void> {
    return this.httpDeleteRequest<void>(`api/client/${id}/`);
  }

  public importExcel(file: File): Observable<{ created: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.httpPostRequest<FormData, { created: number; errors: string[] }>(
      'api/client/import-excel',
      formData,
    );
  }

  public getClientAppointments(
    clientId: string,
    filters?: Record<string, unknown>,
  ): Observable<IAppointmentList> {
    return this.httpGetRequest<IAppointmentList>(
      `api/appointment/client/${clientId}/`,
      filters ?? {},
    );
  }
}
