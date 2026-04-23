import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';

export class HttpHelper {
  protected http = inject(HttpClient);

  public httpPostRequest<T, U = unknown>(url: string, body: T): Observable<U> {
    return this.http.post<U>(url, body, { headers: this.getHttpHeaders() });
  }

  public httpGetRequest<T>(url: string, params = {}): Observable<T> {
    return this.http.get<T>(url, { headers: this.getHttpHeaders(), params });
  }

  public httpPatchRequest<T, U = unknown>(url: string, body: U): Observable<T> {
    return this.http.patch<T>(url, body, { headers: this.getHttpHeaders() });
  }

  public httpDeleteRequest<T>(url: string, params = {}): Observable<T> {
    return this.http.delete<T>(url, { headers: this.getHttpHeaders(), params });
  }

  private getHttpHeaders(): HttpHeaders {
    return new HttpHeaders().set(
      'Authorization',
      `Bearer ${localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN) || ''}`,
    );
  }
}
