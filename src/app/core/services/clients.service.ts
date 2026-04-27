import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IClient, IClientList } from '@core/models/client.interface';

@Injectable({ providedIn: 'root' })
export class ClientsService extends HttpHelper {
  public getClients(filters?: Record<string, unknown>): Observable<IClientList> {
    return this.httpGetRequest<IClientList>('api/client/', filters ?? {});
  }

  public getClientById(id: string): Observable<IClient> {
    return this.httpGetRequest<IClient>(`api/client/${id}/`);
  }

  public addClient(payload: { fullName: string; phone: string; email?: string }): Observable<IClient> {
    return this.httpPostRequest<typeof payload, IClient>('api/client/', payload);
  }
}

