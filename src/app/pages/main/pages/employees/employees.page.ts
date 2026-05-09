import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, Subject, switchMap, take } from 'rxjs';
import { IEmployee } from '@core/models/employee.interface';
import { ISupervisor } from '@core/models/supervisor.interface';
import { IDepartment } from '@core/models/department.interface';
import { EUserRole } from '@core/enums/e-user-role';
import { EmployeeService } from '@core/services/employee.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { DepartmentService } from '@core/services/department.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { EmployeeFormModalComponent } from './components/employee-form-modal/employee-form-modal.component';
import { ManagerFormModalComponent } from './components/manager-form-modal/manager-form-modal.component';

@Component({
  selector: 'app-employees',
  templateUrl: './employees.page.html',
  styleUrls: ['./employees.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesPage implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly departmentService = inject(DepartmentService);
  public readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  // ── Состояние ──────────────────────────────────────────
  public activeTab = signal<'employees' | 'managers'>('employees');
  public isLoading = signal(false);
  public searchQuery = signal('');
  private readonly search$ = new Subject<string>();

  // ── Employees ──────────────────────────────────────────
  public employees = signal<IEmployee[]>([]);
  public employeesTotal = signal(0);
  public employeeOffset = signal(0);
  private readonly LIMIT = 25;

  // ── Managers ───────────────────────────────────────────
  public managers = signal<ISupervisor[]>([]);
  public managersTotal = signal(0);

  // ── Auth / Permissions ─────────────────────────────────
  public get isManager(): boolean {
    return this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER;
  }

  public readonly singleDepartmentMode = computed(() => this.supervisorService.singleDepartmentMode());

  public readonly canAddEmployee = computed(() => {
    const limit = this.subscriptionService.getLimit('employees');
    return limit === -1 || this.employeesTotal() < limit;
  });

  // ── Departments ────────────────────────────────────────
  public departments = computed(() => this.departmentService.departmentsSignal()?.results ?? []);

  ngOnInit(): void {
    this.loadDepartmentsIfNeeded();
    // Загружаем оба счётчика сразу, чтобы числа в табах отображались немедленно
    this.loadEmployees();
    if (!this.isManager) {
      this.loadManagers();
    }

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadCurrentTab());
  }

  public onTabChange(tab: 'employees' | 'managers'): void {
    this.activeTab.set(tab);
    this.searchQuery.set('');
    this.employeeOffset.set(0);
    this.loadCurrentTab();
  }

  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.employeeOffset.set(0);
    this.search$.next(value);
  }

  // ────── Employees actions ──────────────────────────────
  public async openAddEmployee(): Promise<void> {
    if (!this.canAddEmployee()) {
      await this.showLimitAlert();
      return;
    }
    const dept = await this.pickDepartment();
    if (!dept) return;
    const modal = await this.modalCtrl.create({
      component: EmployeeFormModalComponent,
      componentProps: { employee: null, department: dept },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) this.loadEmployees();
  }

  public async openEditEmployee(employee: IEmployee, event: Event): Promise<void> {
    event.stopPropagation();
    const dept = typeof employee.department === 'string'
      ? { _id: employee.department, name: '' }
      : employee.department;
    const modal = await this.modalCtrl.create({
      component: EmployeeFormModalComponent,
      componentProps: { employee, department: dept },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) this.loadEmployees();
  }

  public async confirmDeleteEmployee(employee: IEmployee, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: this.t.instant('DELETE_EMP_TITLE'),
      message: this.t.instant('DELETE_EMP_MSG', { name: `${employee.firstName} ${employee.lastName}` }),
      buttons: [
        { text: this.t.instant('CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('DELETE'),
          role: 'destructive',
          handler: () => this.deleteEmployee(employee._id),
        },
      ],
    });
    await alert.present();
  }

  // ────── Managers actions ───────────────────────────────
  public async openAddManager(): Promise<void> {
    const dept = await this.pickDepartment();
    if (!dept) return;
    const modal = await this.modalCtrl.create({
      component: ManagerFormModalComponent,
      componentProps: { manager: null, department: dept },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) this.loadManagers();
  }

  public async openEditManager(manager: ISupervisor, event: Event): Promise<void> {
    event.stopPropagation();
    const dept = typeof manager.department === 'string'
      ? { _id: manager.department, name: '', schedule: [] }
      : { ...manager.department, schedule: [] };
    const modal = await this.modalCtrl.create({
      component: ManagerFormModalComponent,
      componentProps: { manager, department: dept },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) this.loadManagers();
  }

  public async confirmDeleteManager(manager: ISupervisor, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: this.t.instant('DELETE_MGR_TITLE'),
      message: this.t.instant('DELETE_MGR_MSG', { name: `${manager.firstName} ${manager.lastName}` }),
      buttons: [
        { text: this.t.instant('CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('DELETE'),
          role: 'destructive',
          handler: () => this.deleteManager(manager._id),
        },
      ],
    });
    await alert.present();
  }

  public async toggleAssignManager(manager: ISupervisor, event: Event): Promise<void> {
    event.stopPropagation();
    const dept = typeof manager.department === 'object' && manager.department
      ? manager.department as { _id: string; name: string; manager?: string | null }
      : null;
    if (!dept) return;

    const isAssigned = !!dept.manager;

    if (isAssigned) {
      const alert = await this.alertCtrl.create({
        header: this.t.instant('MGR_UNASSIGN_TITLE'),
        message: this.t.instant('MGR_UNASSIGN_MSG', { name: `${manager.firstName} ${manager.lastName}`, dept: dept.name }),
        buttons: [
          { text: this.t.instant('CANCEL'), role: 'cancel' },
          {
            text: this.t.instant('MGR_UNASSIGN_BTN'),
            role: 'destructive',
            handler: () =>
              this.departmentService
                .patchDepartment(dept._id, { manager: null } as unknown as Partial<IDepartment>)
                .pipe(take(1), switchMap(() => this.supervisorService.getSupervisors({ role: EUserRole.MANAGER, limit: this.LIMIT })))
                .subscribe(() => this.loadManagers()),
          },
        ],
      });
      await alert.present();
    } else {
      this.departmentService
        .patchDepartment(dept._id, { manager: manager._id } as unknown as Partial<IDepartment>)
        .pipe(take(1))
        .subscribe(() => this.loadManagers());
    }
  }

  public getDeptName(employee: IEmployee | ISupervisor): string {
    const dept = employee.department;
    if (!dept) return '—';
    return typeof dept === 'string' ? dept : dept.name;
  }

  public isManagerAssigned(manager: ISupervisor): boolean {
    const dept = manager.department;
    if (!dept || typeof dept === 'string') return false;
    return !!(dept as { manager?: string | null }).manager;
  }

  // ── Private helpers ────────────────────────────────────
  private loadCurrentTab(): void {
    if (this.activeTab() === 'employees') {
      this.loadEmployees();
    } else {
      this.loadManagers();
    }
  }

  private loadDepartmentsIfNeeded(): void {
    if (!this.singleDepartmentMode() && !this.departmentService.departmentsSignal()) {
      this.departmentService
        .getDepartments({ limit: 50 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }

  private loadEmployees(): void {
    this.isLoading.set(true);
    const filters: Record<string, unknown> = {
      limit: this.LIMIT,
      offset: this.employeeOffset(),
    };
    if (this.searchQuery()) filters['search'] = this.searchQuery();
    if (this.singleDepartmentMode()) {
      const deptId = this.supervisorService.effectiveDepartmentId();
      if (deptId) filters['departmentId'] = deptId;
    }

    this.employeeService
      .getEmployees(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.employees.set(res.results);
          this.employeesTotal.set(res.count);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private loadManagers(): void {
    this.isLoading.set(true);
    const filters: Record<string, unknown> = { role: EUserRole.MANAGER, limit: this.LIMIT };
    if (this.searchQuery()) filters['search'] = this.searchQuery();
    if (this.singleDepartmentMode()) {
      const deptId = this.supervisorService.effectiveDepartmentId();
      if (deptId) filters['departmentId'] = deptId;
    }

    this.supervisorService
      .getSupervisors(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.managers.set(res.results);
          this.managersTotal.set(res.count);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private deleteEmployee(id: string): void {
    this.employeeService
      .deleteEmployee(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadEmployees();
          void this.showToast(this.t.instant('EMP_DELETED'));
        },
      });
  }

  private deleteManager(id: string): void {
    this.supervisorService
      .deleteManager(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadManagers();
          void this.showToast(this.t.instant('MGR_DELETED'));
        },
      });
  }

  /** Выбирает департамент для создания сотрудника/менеджера. */
  private async pickDepartment(): Promise<IDepartment | null> {
    if (this.singleDepartmentMode()) {
      const effectiveId = this.supervisorService.effectiveDepartmentId();
      if (effectiveId) {
        // Загружаем dept по ID если его нет в кеше
        let dept = this.departmentService.currentDepartmentSignal();
        if (!dept || dept._id !== effectiveId) {
          dept = await this.departmentService
            .getDepartmentById(effectiveId)
            .pipe(take(1))
            .toPromise() as IDepartment;
        }
        return dept;
      }
      return null;
    }

    const depts = this.departments();
    if (!depts.length) {
      await this.showToast(this.t.instant('EMP_NO_DEPTS_MSG'), 'warning');
      return null;
    }

    if (depts.length === 1) return depts[0];

    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: this.t.instant('SELECT_DEPT_HEADER'),
        inputs: depts.map((d, i) => ({
          type: 'radio' as const,
          label: d.name,
          value: d,
          checked: i === 0,
        })),
        buttons: [
          { text: this.t.instant('CANCEL'), role: 'cancel', handler: () => resolve(null) },
          { text: this.t.instant('SELECT'), handler: (data: IDepartment) => resolve(data) },
        ],
      });
      await alert.present();
    });
  }

  private async showLimitAlert(): Promise<void> {
    const limit = this.subscriptionService.getLimit('employees');
    const alert = await this.alertCtrl.create({
      header: this.t.instant('EMP_LIMIT_TITLE'),
      message: this.t.instant('EMP_LIMIT_MSG', { limit }),
      buttons: [{ text: this.t.instant('OK'), role: 'cancel' }],
    });
    await alert.present();
  }

  private async showToast(message: string, color = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }
}
