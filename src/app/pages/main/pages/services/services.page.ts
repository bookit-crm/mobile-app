import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AlertController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { debounceTime, firstValueFrom, Subject, take } from 'rxjs';

import { IDepartment } from '@core/models/department.interface';
import { IService } from '@core/models/service.interface';
import { DepartmentService } from '@core/services/department.service';
import { ServicesService, IServicesFilters } from '@core/services/services.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { EUserRole } from '@core/enums/e-user-role';
import { TranslateService } from '@ngx-translate/core';
import { ServiceModalComponent } from './components/service-modal/service-modal.component';

@Component({
  selector: 'app-services',
  templateUrl: './services.page.html',
  styleUrls: ['./services.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage {
  private readonly servicesService = inject(ServicesService);
  private readonly departmentService = inject(DepartmentService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  // ── List state ─────────────────────────────────────────────────────────────
  public services = signal<IService[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public offset = signal(0);
  public hasMore = signal(true);

  // ── Filters ────────────────────────────────────────────────────────────────
  public searchQuery = signal('');
  public departmentFilter = signal<string>('');
  public showFilterModal = signal(false);
  public tempDept = '';

  // ── Filter options ─────────────────────────────────────────────────────────
  public departments = signal<IDepartment[]>([]);

  // ── Permissions ───────────────────────────────────────────────────────────
  public readonly isManager = computed(
    () => this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER,
  );
  public readonly singleDepartmentMode = computed(
    () => this.isManager() || this.subscriptionService.isSingleLocationPlan(),
  );
  public readonly canManage = computed(() => this.subscriptionService.isActive());

  public readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (!this.singleDepartmentMode() && this.departmentFilter()) n++;
    return n;
  });

  private readonly search$ = new Subject<string>();

  ionViewWillEnter(): void {
    this.loadFilterOptions();
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadServices(true);

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.offset.set(0);
        this.hasMore.set(true);
        this.loadServices(true);
      });
  }

  // ── Search & Filters ──────────────────────────────────────────────────────
  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  public openFilterModal(): void {
    this.tempDept = this.departmentFilter();
    this.showFilterModal.set(true);
  }

  public applyFilters(): void {
    this.departmentFilter.set(this.tempDept);
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadServices(true);
  }

  public resetFilters(): void {
    this.tempDept = '';
    if (!this.singleDepartmentMode()) this.departmentFilter.set('');
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadServices(true);
  }

  // ── Infinite scroll & Load more ──────────────────────────────────────────
  public loadMore(): void {
    this.offset.set(this.services().length);
    this.loadServices(false);
  }

  public async onInfiniteScroll(event: Event): Promise<void> {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete(): void } }).target.complete();
      return;
    }
    this.offset.set(this.services().length);
    await this.loadServicesAsync(false);
    (event as CustomEvent & { target: { complete(): void } }).target.complete();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  public async openCreateModal(): Promise<void> {
    if (!this.canManage()) {
      await this.showSubscriptionAlert();
      return;
    }

    const deptId = this.getDefaultDepartmentId();
    const modal = await this.modalCtrl.create({
      component: ServiceModalComponent,
      componentProps: { departmentId: deptId },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) this.refresh();
  }

  public async openEditModal(service: IService, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canManage()) {
      await this.showSubscriptionAlert();
      return;
    }

    let full: IService;
    try {
      full = await firstValueFrom(this.servicesService.getServiceById(service._id));
    } catch (err) {
      console.error('[Services] getServiceById error', err);
      await this.showToast(this.t.instant('SVC_FAIL_LOAD'), 'danger');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: ServiceModalComponent,
      componentProps: { service: full },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) this.refresh();
  }

  public async confirmDelete(service: IService, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canManage()) {
      await this.showSubscriptionAlert();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.t.instant('SVC_DELETE_TITLE'),
      message: this.t.instant('SVC_DELETE_MSG', { name: service.name }),
      buttons: [
        { text: this.t.instant('CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('DELETE'),
          role: 'destructive',
          handler: () => this.deleteService(service._id),
        },
      ],
    });
    await alert.present();
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  public getDepartmentName(service: IService): string {
    if (!service.department) return '—';
    return typeof service.department === 'string'
      ? service.department
      : (service.department as IDepartment).name;
  }

  public getConsumablesLabel(service: IService): string {
    if (!service.consumableProducts?.length) return '—';
    return service.consumableProducts
      .map((cp) => {
        const name = typeof cp.product === 'string' ? cp.product : (cp.product as { name: string }).name;
        return `${name} ×${cp.quantity}`;
      })
      .join(', ');
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private refresh(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadServices(true);
  }

  private buildFilters(): IServicesFilters {
    const filters: IServicesFilters = { limit: 25, offset: this.offset() };
    if (this.searchQuery()) filters.search = this.searchQuery();

    if (this.singleDepartmentMode()) {
      const dept = this.supervisorService.authUserSignal()?.department;
      const deptId = dept ? (typeof dept === 'string' ? dept : dept._id) : '';
      if (deptId) filters.departmentId = deptId;
    } else if (this.departmentFilter()) {
      filters.departmentId = this.departmentFilter();
    }

    return filters;
  }

  private loadServices(reset: boolean): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);

    this.servicesService
      .getServices(this.buildFilters())
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = reset ? res.results : [...this.services(), ...res.results];
          this.services.set(list);
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

  private async loadServicesAsync(reset: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (!this.hasMore()) { resolve(); return; }
      this.servicesService
        .getServices(this.buildFilters())
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            const list = reset ? res.results : [...this.services(), ...res.results];
            this.services.set(list);
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
      const dept = this.supervisorService.authUserSignal()?.department;
      const deptId = dept ? (typeof dept === 'string' ? dept : dept._id) : '';
      if (deptId) this.departmentFilter.set(deptId);
    } else {
      this.departmentService
        .getDepartments({ limit: 50 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe((res) => {
          this.departments.set(res.results);
          if (this.subscriptionService.isSingleLocationPlan() && res.results.length > 0) {
            this.departmentFilter.set(res.results[0]._id);
          }
          this.cdr.markForCheck();
        });
    }
  }

  private getDefaultDepartmentId(): string {
    if (this.singleDepartmentMode()) {
      const dept = this.supervisorService.authUserSignal()?.department;
      return dept ? (typeof dept === 'string' ? dept : dept._id) : '';
    }
    const depts = this.departments();
    return depts.length === 1 ? depts[0]._id : '';
  }

  private deleteService(id: string): void {
    this.servicesService.delete(id).pipe(take(1)).subscribe({
      next: async () => {
        this.refresh();
        await this.showToast(this.t.instant('SVC_DELETED'));
      },
    });
  }

  private async showSubscriptionAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('SVC_SUB_REQUIRED_TITLE'),
      message: this.t.instant('SVC_SUB_REQUIRED_MSG'),
      buttons: [this.t.instant('OK')],
    });
    await alert.present();
  }

  private async showToast(message: string, color = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }
}
