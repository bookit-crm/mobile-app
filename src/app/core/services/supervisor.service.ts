import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { EUserRole } from '@core/enums/e-user-role';
import { ISupervisor, ISupervisorList } from '@core/models/supervisor.interface';
import { SubscriptionService } from './subscription.service';
import { DepartmentService } from './department.service';

@Injectable({ providedIn: 'root' })
export class SupervisorService extends HttpHelper {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly departmentService = inject(DepartmentService);

  public authUserSignal: WritableSignal<ISupervisor | null> = signal(null);
  public supervisorsSignal: WritableSignal<ISupervisorList | null> = signal(null);
  public currentManagerSignal: WritableSignal<ISupervisor | null> = signal(null);

  public isManager: Signal<boolean> = computed(
    () => this.authUserSignal()?.role === EUserRole.MANAGER,
  );

  /**
   * true если пользователь фактически работает с одним департаментом:
   * - Manager привязан к одному департаменту
   * - Admin/Owner на плане с лимитом 1 локация
   */
  public singleDepartmentMode: Signal<boolean> = computed(
    () => this.isManager() || this.subscriptionService.isSingleLocationPlan(),
  );

  /**
   * Эффективный departmentId для single-department mode.
   */
  public effectiveDepartmentId: Signal<string | null> = computed(() => {
    if (this.isManager()) {
      const dept = this.authUserSignal()?.department;
      if (!dept) return null;
      return typeof dept === 'string' ? dept : dept._id;
    }
    if (this.subscriptionService.isSingleLocationPlan()) {
      return this.departmentService.singleDepartmentSignal()?._id ?? null;
    }
    return null;
  });

  public getSelf(): Observable<ISupervisor> {
    return this.httpGetRequest<ISupervisor>('api/supervisor/self/').pipe(
      tap((res) => this.authUserSignal.set(res)),
    );
  }

  public patchSelf(payload: Partial<ISupervisor>): Observable<ISupervisor> {
    return this.httpPatchRequest<ISupervisor>('api/supervisor/self/', payload).pipe(
      tap((res) => this.authUserSignal.set(res)),
    );
  }

  public getSupervisors(filters: Record<string, unknown> = {}): Observable<ISupervisorList> {
    return this.httpGetRequest<ISupervisorList>('api/supervisor/', filters).pipe(
      tap((res) => this.supervisorsSignal.set(res)),
    );
  }

  public getManagerById(id: string): Observable<ISupervisor> {
    return this.httpGetRequest<ISupervisor>(`api/supervisor/manager/${id}/`).pipe(
      tap((res) => this.currentManagerSignal.set(res)),
    );
  }

  public createSupervisorManager(payload: Partial<ISupervisor> & { password: string }): Observable<ISupervisor> {
    return this.httpPostRequest<Partial<ISupervisor> & { password: string }, ISupervisor>(
      'api/supervisor/manager/',
      payload,
    );
  }

  public editSupervisorManager(id: string, payload: Partial<ISupervisor>): Observable<ISupervisor> {
    return this.httpPatchRequest<ISupervisor>(`api/supervisor/manager/${id}/`, payload);
  }

  /** Менеджер редактирует свой профиль — обновляем authUserSignal */
  public editSupervisorManagerBySelf(id: string, payload: Partial<ISupervisor>): Observable<ISupervisor> {
    return this.httpPatchRequest<ISupervisor>(`api/supervisor/manager/${id}/`, payload);
  }

  public deleteManager(id: string): Observable<void> {
    return this.httpDeleteRequest<void>(`api/supervisor/manager/${id}/`);
  }
}
