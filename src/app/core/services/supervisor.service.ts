import { Injectable, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { ISupervisor } from '@core/models/supervisor.interface';
@Injectable({ providedIn: 'root' })
export class SupervisorService extends HttpHelper {
  public authUserSignal: WritableSignal<ISupervisor | null> = signal(null);
  public getSelf(): Observable<ISupervisor> {
    return this.httpGetRequest<ISupervisor>('api/supervisor/self/').pipe(
      tap((res) => this.authUserSignal.set(res)),
    );
  }
}
