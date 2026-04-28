import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';

export class HttpHelper {
  protected http = inject(HttpClient);

  public httpGetRequest<T>(url: string, params = {}): Observable<T> {
    return this.http.get<T>(url, { headers: this.getHttpHeaders(), params });
  }

  public httpPatchRequest<T, U = unknown>(url: string, body: U): Observable<T> {
    return this.http.patch<T>(url, body, {
      headers: this.getHttpHeaders().set('Content-Type', 'application/json'),
    });
  }

  public httpPostRequest<T, U = unknown>(url: string, body: T): Observable<U> {
    const headers = body instanceof FormData
      ? this.getHttpHeaders()
      : this.getHttpHeaders().set('Content-Type', 'application/json');
    return this.http.post<U>(url, body, { headers });
  }

  public httpDeleteRequest<T>(url: string, params = {}): Observable<T> {
    return this.http.delete<T>(url, { headers: this.getHttpHeaders(), params });
  }

  public getHttpHeaders(): HttpHeaders {
    return new HttpHeaders().set(
      'Authorization',
      `Bearer ${localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN) || ''}`,
    );
  }
}
