import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
import { IFileDTO } from '@core/models/file.interface';

@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly http = inject(HttpClient);

  /**
   * Upload a single file as multipart/form-data.
   * Content-Type is NOT set manually so the browser adds the correct
   * multipart boundary automatically.
   */
  public uploadFile(formData: FormData): Observable<IFileDTO> {
    const token = localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN) ?? '';
    return this.http.post<IFileDTO>('api/files/', formData, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
    });
  }
}

