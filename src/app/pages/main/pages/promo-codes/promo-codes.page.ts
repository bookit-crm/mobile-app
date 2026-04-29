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
import { debounceTime, Subject, take } from 'rxjs';
import { IPromoCode, IPromoCodeService } from '@core/models/promo-code.interface';
import { IDepartment } from '@core/models/department.interface';
import { EUserRole } from '@core/enums/e-user-role';
import { PromoCodesService, IPromoCodesFilters } from '@core/services/promo-codes.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { DepartmentService } from '@core/services/department.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { PromoCodeFormModalComponent } from './components/promo-code-form-modal/promo-code-form-modal.component';

@Component({
  selector: 'app-promo-codes',
  templateUrl: './promo-codes.page.html',
  styleUrls: ['./promo-codes.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromoCodesPage implements OnInit {
  private readonly promoCodesService = inject(PromoCodesService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly departmentService = inject(DepartmentService);
  public readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── State ──────────────────────────────────────────────────────────────────
  public isLoading = signal(false);
  public promoCodes = signal<IPromoCode[]>([]);
  public promoCodesTotal = signal(0);

  // ── Filters ────────────────────────────────────────────────────────────────
  public searchQuery = signal('');
  public visibilityFilter = signal<'all' | 'true' | 'false'>('all');
  public dateFrom = signal<string | null>(null);
  public dateTo = signal<string | null>(null);
  public isFilterOpen = signal(false);

  private readonly search$ = new Subject<string>();

  // ── Auth / Permissions ─────────────────────────────────────────────────────
  public get isManager(): boolean {
    return this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER;
  }

  public readonly singleDepartmentMode = computed(() => this.supervisorService.singleDepartmentMode());

  public readonly hasPromoCodesFeature = computed(() =>
    this.subscriptionService.hasFeature('promoCodes'),
  );

  // ── Departments ────────────────────────────────────────────────────────────
  public departments = computed(() => this.departmentService.departmentsSignal()?.results ?? []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  public readonly visibilityOptions = [
    { value: 'all' as const, label: 'All' },
    { value: 'true' as const, label: 'Visible' },
    { value: 'false' as const, label: 'Hidden' },
  ];

  ngOnInit(): void {
    this.loadDepartmentsIfNeeded();
    this.loadPromoCodes();

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPromoCodes());
  }

  public ionViewWillEnter(): void {
    this.loadPromoCodes();
  }

  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  public openFilterSheet(): void {
    this.isFilterOpen.set(true);
  }

  public closeFilterSheet(): void {
    this.isFilterOpen.set(false);
  }

  public applyFilters(): void {
    this.isFilterOpen.set(false);
    this.loadPromoCodes();
  }

  public resetFilters(): void {
    this.visibilityFilter.set('all');
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.isFilterOpen.set(false);
    this.loadPromoCodes();
  }

  public get activeFiltersCount(): number {
    let count = 0;
    if (this.visibilityFilter() !== 'all') count++;
    if (this.dateFrom()) count++;
    if (this.dateTo()) count++;
    return count;
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  public async openAdd(): Promise<void> {
    if (!this.hasPromoCodesFeature()) {
      await this.showUpgradeAlert();
      return;
    }
    const dept = await this.pickDepartment();
    if (!dept) return;

    const modal = await this.modalCtrl.create({
      component: PromoCodeFormModalComponent,
      componentProps: { promoCode: null, department: dept },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) this.loadPromoCodes();
  }

  public async openEdit(promoCode: IPromoCode, event: Event): Promise<void> {
    event.stopPropagation();
    const dept = typeof promoCode.department === 'string'
      ? { _id: promoCode.department, name: '' } as IDepartment
      : promoCode.department as IDepartment;

    const modal = await this.modalCtrl.create({
      component: PromoCodeFormModalComponent,
      componentProps: { promoCode, department: dept },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) this.loadPromoCodes();
  }

  public async confirmDelete(promoCode: IPromoCode, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete Promo Code',
      message: `Delete "${promoCode.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deletePromoCode(promoCode._id),
        },
      ],
    });
    await alert.present();
  }

  public toggleVisibility(promoCode: IPromoCode, event: Event): void {
    event.stopPropagation();
    this.promoCodesService
      .toggleVisibility(promoCode._id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadPromoCodes();
          void this.showToast(promoCode.isVisible ? 'Hidden from clients' : 'Now visible to clients');
        },
      });
  }

  // ── Display helpers ────────────────────────────────────────────────────────
  public getDeptName(promoCode: IPromoCode): string {
    const dept = promoCode.department;
    if (!dept) return '—';
    return typeof dept === 'string' ? dept : (dept as IDepartment).name;
  }

  public formatDiscount(svc: IPromoCodeService): string {
    const serviceName = typeof svc.service === 'string'
      ? svc.service
      : (svc.service as { name: string }).name;
    const discount = svc.discountType === 'percentage'
      ? `${svc.discountValue}%`
      : `$${svc.discountValue}`;
    return `${serviceName}: ${discount}`;
  }

  public formatDate(dateStr: string | null): string {
    if (!dateStr) return '∞';
    try {
      return new Date(dateStr).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────
  private loadPromoCodes(): void {
    this.isLoading.set(true);
    const filters: IPromoCodesFilters = { limit: 50 };

    if (this.searchQuery()) filters.search = this.searchQuery();
    if (this.visibilityFilter() !== 'all') filters.isVisible = this.visibilityFilter();
    if (this.dateFrom()) filters.dateFrom = this.dateFrom()!;
    if (this.dateTo()) filters.dateTo = this.dateTo()!;

    if (this.singleDepartmentMode()) {
      const deptId = this.supervisorService.effectiveDepartmentId();
      if (deptId) filters.departmentId = deptId;
    }

    this.promoCodesService
      .getPromoCodes(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.promoCodes.set(res.results);
          this.promoCodesTotal.set(res.count);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private loadDepartmentsIfNeeded(): void {
    if (!this.singleDepartmentMode() && !this.departmentService.departmentsSignal()) {
      this.departmentService
        .getDepartments({ limit: 50 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }

  private deletePromoCode(id: string): void {
    this.promoCodesService
      .delete(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.loadPromoCodes();
          void this.showToast('Promo code deleted');
        },
      });
  }

  private async pickDepartment(): Promise<IDepartment | null> {
    if (this.singleDepartmentMode()) {
      const effectiveId = this.supervisorService.effectiveDepartmentId();
      if (effectiveId) {
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
      await this.showToast('No departments found. Create a department first.', 'warning');
      return null;
    }
    if (depts.length === 1) return depts[0];

    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: 'Select Department',
        inputs: depts.map((d, i) => ({
          type: 'radio' as const,
          label: d.name,
          value: d,
          checked: i === 0,
        })),
        buttons: [
          { text: 'Cancel', role: 'cancel', handler: () => resolve(null) },
          { text: 'Select', handler: (data: IDepartment) => resolve(data) },
        ],
      });
      await alert.present();
    });
  }

  private async showUpgradeAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Feature not available',
      message: 'Promo codes are not available on your current plan. Upgrade to use this feature.',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await alert.present();
  }

  private async showToast(message: string, color = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }
}
