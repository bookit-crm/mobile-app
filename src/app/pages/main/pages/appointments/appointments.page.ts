import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AlertController, IonItemSliding, ModalController, ToastController } from '@ionic/angular';
import { debounceTime, Subject, take } from 'rxjs';

import { IAppointment, AppointmentStatus } from '@core/models/appointment.interface';
import { IDepartment } from '@core/models/department.interface';
import { IEmployee } from '@core/models/employee.interface';
import { IClient } from '@core/models/client.interface';
import { AppointmentsService } from '@core/services/appointments.service';
import { DepartmentService } from '@core/services/department.service';
import { EmployeeService } from '@core/services/employee.service';
import { ClientsService } from '@core/services/clients.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { EUserRole } from '@core/enums/e-user-role';
import { AppointmentModalComponent } from '../calendar/components/appointment-modal/appointment-modal.component';

@Component({
  selector: 'app-appointments',
  templateUrl: './appointments.page.html',
  styleUrls: ['./appointments.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsPage {
  @ViewChildren(IonItemSliding) private slidingItems!: QueryList<IonItemSliding>;
  private readonly SWIPE_HINT_KEY = 'appt_swipe_hint_v1';
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly departmentService = inject(DepartmentService);
  private readonly employeeService = inject(EmployeeService);
  private readonly clientsService = inject(ClientsService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── List state ────────────────────────────────────────────────────────────
  public appointments = signal<IAppointment[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public offset = signal(0);
  public hasMore = signal(true);

  // ── Active filters ────────────────────────────────────────────────────────
  public searchQuery = signal('');
  public statusFilter = signal<string>('all');
  public departmentFilter = signal<string>('');
  public employeeFilter = signal<string>('');
  public clientFilter = signal<string>('');
  public dateFrom = signal<string>('');
  public dateTo = signal<string>('');

  // ── Filter modal temp state (ngModel bindings) ────────────────────────────
  public showFilterModal = signal(false);
  public tempDept = '';
  public tempEmployee = '';
  public tempClient = '';
  public tempDateFrom = '';
  public tempDateTo = '';

  // ── Filter options ────────────────────────────────────────────────────────
  public departments = signal<IDepartment[]>([]);
  public employees = signal<IEmployee[]>([]);
  public clientOptions = signal<IClient[]>([]);

  // ── Permissions ───────────────────────────────────────────────────────────
  public readonly isManager = computed(
    () => this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER,
  );
  /**
   * Manager OR admin on single-location plan → hide department filter,
   * auto-set the only department.
   * Mirrors desktop SupervisorsService.singleDepartmentMode.
   */
  public readonly singleDepartmentMode = computed(
    () => this.isManager() || this.subscriptionService.isSingleLocationPlan(),
  );
  /** Create/edit/delete requires active subscription */
  public readonly canCreateAppointment = computed(
    () => this.subscriptionService.isActive(),
  );
  /** History requires auditLogs feature */
  public readonly canViewHistory = computed(
    () => this.subscriptionService.hasFeature('auditLogs'),
  );

  public readonly AppointmentStatus = AppointmentStatus;

  public readonly statusOptions = [
    { value: 'all',       label: 'All' },
    { value: 'new',       label: 'New' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled',  label: 'Canceled' },
  ];

  /** Count of active advanced filters (not counting search/status).
   *  Department is excluded when user cannot change it (singleDepartmentMode). */
  public readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (!this.singleDepartmentMode() && this.departmentFilter()) n++;
    if (this.employeeFilter()) n++;
    if (this.clientFilter()) n++;
    if (this.dateFrom() || this.dateTo()) n++;
    return n;
  });

  private readonly search$ = new Subject<string>();

  ionViewWillEnter(): void {
    this.loadFilterOptions();
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadAppointments(true);
    this.peekFirstItem();

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.offset.set(0);
        this.hasMore.set(true);
        this.loadAppointments(true);
      });
  }

  // ── Search & Status ───────────────────────────────────────────────────────
  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  public onStatusChange(status: string | undefined): void {
    this.statusFilter.set(status ?? 'all');
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadAppointments(true);
  }

  // ── Advanced filter modal ─────────────────────────────────────────────────
  public openFilterModal(): void {
    this.tempDept = this.departmentFilter();
    this.tempEmployee = this.employeeFilter();
    this.tempClient = this.clientFilter();
    this.tempDateFrom = this.dateFrom();
    this.tempDateTo = this.dateTo();
    this.showFilterModal.set(true);
  }

  public applyFilters(): void {
    this.departmentFilter.set(this.tempDept);
    this.employeeFilter.set(this.tempEmployee);
    this.clientFilter.set(this.tempClient);
    this.dateFrom.set(this.tempDateFrom);
    this.dateTo.set(this.tempDateTo);
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadAppointments(true);
  }

  public resetFilters(): void {
    this.tempDept = '';
    this.tempEmployee = '';
    this.tempClient = '';
    this.tempDateFrom = '';
    this.tempDateTo = '';
    // Don't reset department when the user has no choice (single-dept mode)
    if (!this.singleDepartmentMode()) {
      this.departmentFilter.set('');
    }
    this.employeeFilter.set('');
    this.clientFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadAppointments(true);
  }

  // ── Infinite scroll ───────────────────────────────────────────────────────
  public async onInfiniteScroll(event: Event): Promise<void> {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    await this.loadAppointmentsAsync(false);
    (event as CustomEvent & { target: { complete: () => void } }).target.complete();
  }

  // ── CRUD actions ──────────────────────────────────────────────────────────
  public async openCreateModal(): Promise<void> {
    if (!this.canCreateAppointment()) {
      await this.showSubscriptionAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: AppointmentModalComponent,
      componentProps: { payload: {} },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) { this.refresh(); }
  }

  public async openEditModal(appt: IAppointment, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canCreateAppointment()) {
      await this.showSubscriptionAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: AppointmentModalComponent,
      componentProps: { payload: { _id: appt._id } },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) { this.refresh(); }
  }

  public async openHistory(appt: IAppointment, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canViewHistory()) {
      const toast = await this.toastCtrl.create({
        message: 'Upgrade your plan to view appointment history.',
        duration: 3000,
        color: 'warning',
        icon: 'lock-closed-outline',
      });
      await toast.present();
      return;
    }
    void this.router.navigate(['/main/appointments', appt._id, 'history']);
  }

  public async confirmDelete(appt: IAppointment, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canCreateAppointment()) {
      await this.showSubscriptionAlert();
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Delete Appointment',
      message: `Are you sure you want to delete this appointment?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteAppointment(appt._id),
        },
      ],
    });
    await alert.present();
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  public getStatusColor(status: AppointmentStatus | string): string {
    switch (status) {
      case AppointmentStatus.Completed: return 'success';
      case AppointmentStatus.Canceled:  return 'danger';
      case AppointmentStatus.New:       return 'warning';
      default: return 'medium';
    }
  }

  public getDepartmentName(dept: string | { _id: string; name: string }): string {
    if (!dept) return '—';
    return typeof dept === 'string' ? dept : dept.name;
  }

  public getEmployeeName(appt: IAppointment): string {
    const emp = appt.employee;
    if (!emp) return '—';
    return `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() || '—';
  }

  public getServiceNames(appt: IAppointment): string {
    if (!appt.services?.length) return '—';
    return appt.services.map((s) => s.name).join(', ');
  }

  /** Итоговая цена — бэк уже возвращает totalPrice со скидкой */
  public getFinalPrice(appt: IAppointment): number {
    return appt.totalPrice ?? 0;
  }

  /** Цена до скидки = totalPrice + discountAmount */
  public getOriginalPrice(appt: IAppointment): number {
    return (appt.totalPrice ?? 0) + (appt.discountAmount ?? 0);
  }

  public getEmployeeDisplayName(emp: IEmployee): string {
    return `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  /** Auto-peek the first sliding item once so the user discovers swipe actions. */
  private peekFirstItem(): void {
    if (localStorage.getItem(this.SWIPE_HINT_KEY)) return;
    // Wait for data to load and list to render
    setTimeout(async () => {
      const first = this.slidingItems?.first;
      if (!first) return;
      try {
        await first.open('end');
        setTimeout(async () => {
          await first.close();
          localStorage.setItem(this.SWIPE_HINT_KEY, '1');
        }, 900);
      } catch {
        // ignore if item already destroyed
      }
    }, 900);
  }

  private refresh(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadAppointments(true);
  }

  private buildFilters(): Record<string, unknown> {
    const filters: Record<string, unknown> = {
      limit: 25,
      offset: this.offset(),
    };
    if (this.searchQuery())         filters['search']       = this.searchQuery();
    if (this.statusFilter() !== 'all') filters['status']    = this.statusFilter();
    if (this.departmentFilter())    filters['departmentId'] = this.departmentFilter();
    if (this.employeeFilter())      filters['employeeIds']  = this.employeeFilter();
    if (this.clientFilter())        filters['clientId']     = this.clientFilter();
    if (this.dateFrom())            filters['from']         = this.dateFrom();
    if (this.dateTo())              filters['to']           = this.dateTo();
    return filters;
  }

  private loadAppointments(reset: boolean): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);

    this.appointmentsService
      .getAppointmentsPaginated(this.buildFilters())
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = reset ? res.results : [...this.appointments(), ...res.results];
          this.appointments.set(list);
          this.totalCount.set(res.count);
          this.offset.set(list.length);
          this.hasMore.set(list.length < res.count);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private async loadAppointmentsAsync(reset: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (!this.hasMore()) { resolve(); return; }
      this.appointmentsService
        .getAppointmentsPaginated(this.buildFilters())
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            const list = reset ? res.results : [...this.appointments(), ...res.results];
            this.appointments.set(list);
            this.totalCount.set(res.count);
            this.offset.set(list.length);
            this.hasMore.set(list.length < res.count);
            this.cdr.markForCheck();
            resolve();
          },
          error: () => resolve(),
        });
    });
  }

  private loadFilterOptions(): void {
    if (this.isManager()) {
      // Manager: department comes from their profile — auto-set filter immediately
      const dept = this.supervisorService.authUserSignal()?.department;
      const deptId = dept ? (typeof dept === 'string' ? dept : dept._id) : '';
      if (deptId) {
        this.departmentFilter.set(deptId);
      }
    } else {
      // Admin: load departments for the filter dropdown
      this.departmentService
        .getDepartments({ limit: 50 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe((res) => {
          this.departments.set(res.results);
          // Single-location plan → only one dept available, auto-select it
          if (this.subscriptionService.isSingleLocationPlan() && res.results.length > 0) {
            this.departmentFilter.set(res.results[0]._id);
          }
          this.cdr.markForCheck();
        });
    }
    this.employeeService
      .getEmployees({ limit: 100 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => { this.employees.set(res.results); this.cdr.markForCheck(); });
    this.clientsService
      .getClients({ limit: 100 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => { this.clientOptions.set(res.results); this.cdr.markForCheck(); });
  }

  private deleteAppointment(id: string): void {
    this.appointmentsService
      .deleteAppointmentById(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.refresh();
          void this.showToast('Appointment deleted');
        },
      });
  }

  private async showSubscriptionAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Subscription Required',
      message: 'Your subscription is not active. Please renew your plan to manage appointments.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async showToast(message: string, color = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }
}
