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
import { Router } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { debounceTime, Subject, take } from 'rxjs';
import { IDepartment } from '@core/models/department.interface';
import { DepartmentService } from '@core/services/department.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { EUserRole } from '@core/enums/e-user-role';
import { DepartmentFormModalComponent } from './components/department-form-modal/department-form-modal.component';

@Component({
  selector: 'app-departments',
  templateUrl: './departments.page.html',
  styleUrls: ['./departments.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentsPage implements OnInit {
  private readonly router = inject(Router);
  private readonly departmentService = inject(DepartmentService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  public departments = signal<IDepartment[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public searchQuery = signal('');

  private readonly search$ = new Subject<string>();

  public get isManager(): boolean {
    return this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER;
  }

  /** true если подписка позволяет добавить ещё один департамент */
  public readonly canCreateDepartment = computed(() =>
    this.subscriptionService.canAddLocation(this.totalCount()),
  );

  /** Лимит локаций по текущему плану (-1 = безлимит) */
  public readonly locationLimit = computed(() =>
    this.subscriptionService.getLimit('locations'),
  );

  ngOnInit(): void {
    this.loadDepartments();
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadDepartments());
  }

  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  public openDepartment(department: IDepartment): void {
    void this.router.navigate(['/main/departments', department._id]);
  }

  public async openCreateModal(): Promise<void> {
    if (!this.canCreateDepartment()) {
      await this.showLimitAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: DepartmentFormModalComponent,
      componentProps: { department: null },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) {
      this.loadDepartments();
    }
  }

  public async openEditModal(department: IDepartment, event: Event): Promise<void> {
    event.stopPropagation();
    const modal = await this.modalCtrl.create({
      component: DepartmentFormModalComponent,
      componentProps: { department },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) {
      this.loadDepartments();
    }
  }

  public async toggleStatus(department: IDepartment, event: Event): Promise<void> {
    event.stopPropagation();
    const newStatus = department.status === 'active' ? 'inactive' : 'active';
    this.departmentService
      .patchDepartment(department._id, { status: newStatus })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadDepartments();
          void this.showToast(`Department is now ${newStatus}`);
        },
      });
  }

  public async confirmDelete(department: IDepartment, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete Department',
      message: `Are you sure you want to delete "${department.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteDepartment(department._id),
        },
      ],
    });
    await alert.present();
  }

  private async showLimitAlert(): Promise<void> {
    const limit = this.locationLimit();
    const alert = await this.alertCtrl.create({
      header: 'Location limit reached',
      message: `Your current plan allows up to ${limit} location(s). Upgrade your subscription to add more departments.`,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await alert.present();
  }

  private loadDepartments(): void {
    this.isLoading.set(true);
    const filters: Record<string, unknown> = { limit: 50, offset: 0 };
    if (this.searchQuery()) {
      filters['search'] = this.searchQuery();
    }
    this.departmentService
      .getDepartments(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.departments.set(res.results);
          this.totalCount.set(res.count);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private deleteDepartment(id: string): void {
    this.departmentService
      .deleteDepartment(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadDepartments();
          void this.showToast('Department deleted');
        },
      });
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color: 'success' });
    await toast.present();
  }
}

