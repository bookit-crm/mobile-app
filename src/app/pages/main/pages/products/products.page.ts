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
import { AlertController, IonItemSliding, ModalController, ToastController } from '@ionic/angular';
import { debounceTime, Subject, take } from 'rxjs';

import { IProduct } from '@core/models/product.interface';
import { ProductsService } from '@core/services/products.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { DepartmentService } from '@core/services/department.service';
import { ProductModalComponent } from './components/product-modal/product-modal.component';
import { ProductHistoryComponent } from './components/product-history/product-history.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage {
  @ViewChildren(IonItemSliding) private slidingItems!: QueryList<IonItemSliding>;
  private readonly SWIPE_HINT_KEY = 'products_swipe_hint_v1';

  private readonly productsService = inject(ProductsService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly departmentService = inject(DepartmentService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  // ── List state ────────────────────────────────────────────────────────────
  public products = signal<IProduct[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public offset = signal(0);
  public hasMore = signal(true);

  // ── Search & Filter ───────────────────────────────────────────────────────
  public searchQuery = signal('');
  public showFilterModal = signal(false);
  public statusFilter = signal<string>('');
  public stockStatusFilter = signal<string>('');
  public tempStatusFilter = '';
  public tempStockStatusFilter = '';

  public readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (this.statusFilter()) n++;
    if (this.stockStatusFilter()) n++;
    return n;
  });

  // ── Permissions ───────────────────────────────────────────────────────────
  /** Базовое управление складом — warehouse feature минимум basic */
  public readonly canManageProducts = computed(() =>
    this.subscriptionService.isActive() && this.subscriptionService.hasFeature('warehouse'),
  );
  /** История товаров — productsHistory feature */
  public readonly canViewHistory = computed(() =>
    this.subscriptionService.hasFeature('productsHistory'),
  );

  private readonly search$ = new Subject<string>();

  ionViewWillEnter(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadProducts(true);
    this.peekFirstItem();
    this.ensureDepartmentsLoaded();

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.offset.set(0);
        this.hasMore.set(true);
        this.loadProducts(true);
      });
  }

  // ── Search ────────────────────────────────────────────────────────────────
  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  // ── Filter modal ──────────────────────────────────────────────────────────
  public openFilterModal(): void {
    this.tempStatusFilter = this.statusFilter();
    this.tempStockStatusFilter = this.stockStatusFilter();
    this.showFilterModal.set(true);
  }

  public applyFilters(): void {
    this.statusFilter.set(this.tempStatusFilter);
    this.stockStatusFilter.set(this.tempStockStatusFilter);
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadProducts(true);
  }

  public resetFilters(): void {
    this.tempStatusFilter = '';
    this.tempStockStatusFilter = '';
    this.statusFilter.set('');
    this.stockStatusFilter.set('');
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadProducts(true);
  }

  // ── Infinite scroll ───────────────────────────────────────────────────────
  public async onInfiniteScroll(event: Event): Promise<void> {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    await this.loadProductsAsync();
    (event as CustomEvent & { target: { complete: () => void } }).target.complete();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  public async openCreateModal(): Promise<void> {
    if (!this.canManageProducts()) {
      await this.showSubscriptionAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ProductModalComponent,
      componentProps: { product: null },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) { this.refresh(); }
  }

  public async openEditModal(product: IProduct, event: Event): Promise<void> {
    event.stopPropagation();
    this.closeSlidingItems();
    if (!this.canManageProducts()) {
      await this.showSubscriptionAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ProductModalComponent,
      componentProps: { product },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) { this.refresh(); }
  }

  public async openHistory(product: IProduct, event: Event): Promise<void> {
    event.stopPropagation();
    this.closeSlidingItems();
    if (!this.canViewHistory()) {
      const toast = await this.toastCtrl.create({
        message: this.t.instant('PROD_UPGRADE_HISTORY'),
        duration: 3000,
        color: 'warning',
        icon: 'lock-closed-outline',
      });
      await toast.present();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ProductHistoryComponent,
      componentProps: { productId: product._id, productName: product.name },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
  }

  public async openAllHistory(): Promise<void> {
    if (!this.canViewHistory()) {
      const toast = await this.toastCtrl.create({
        message: this.t.instant('PROD_UPGRADE_HISTORY'),
        duration: 3000,
        color: 'warning',
        icon: 'lock-closed-outline',
      });
      await toast.present();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ProductHistoryComponent,
      componentProps: { productId: null, productName: null },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
  }

  public async confirmArchive(product: IProduct, event: Event): Promise<void> {
    event.stopPropagation();
    this.closeSlidingItems();
    if (!this.canManageProducts()) { await this.showSubscriptionAlert(); return; }

    const isArchived = product.status === 'archived';
    const stockWarn = !isArchived && (product.stock ?? 0) > 0
      ? this.t.instant('PROD_ARCHIVE_STOCK_WARN', { stock: product.stock })
      : '';

    const alert = await this.alertCtrl.create({
      header: isArchived ? this.t.instant('PROD_ACTIVATE_TITLE') : this.t.instant('PROD_ARCHIVE_TITLE'),
      message: isArchived
        ? this.t.instant('PROD_ACTIVATE_MSG', { name: product.name })
        : this.t.instant('PROD_ARCHIVE_MSG', { name: product.name }) + stockWarn,
      inputs: [{ name: 'comment', type: 'text', placeholder: this.t.instant('PROD_COMMENT_PLACEHOLDER') }],
      buttons: [
        { text: this.t.instant('PROD_CANCEL'), role: 'cancel' },
        {
          text: isArchived ? this.t.instant('PROD_ACTIVATE_BTN') : this.t.instant('PROD_ARCHIVE_BTN'),
          handler: (data) => {
            const action$ = isArchived
              ? this.productsService.unarchive(product._id, data.comment)
              : this.productsService.archive(product._id, data.comment);
            action$.pipe(take(1)).subscribe({
              next: () => {
                this.refresh();
                void this.showToast(isArchived ? this.t.instant('PROD_ACTIVATED') : this.t.instant('PROD_ARCHIVED_TOAST'));
              },
              error: (err) => {
                const msg = err?.error?.message ?? (isArchived ? this.t.instant('PROD_FAIL_ACTIVATE') : this.t.instant('PROD_FAIL_ARCHIVE'));
                void this.showToast(msg, 'danger');
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  public async confirmDelete(product: IProduct, event: Event): Promise<void> {
    event.stopPropagation();
    this.closeSlidingItems();
    if (!this.canManageProducts()) { await this.showSubscriptionAlert(); return; }

    const alert = await this.alertCtrl.create({
      header: this.t.instant('PROD_DELETE_TITLE'),
      message: this.t.instant('PROD_DELETE_MSG', { name: product.name }),
      buttons: [
        { text: this.t.instant('PROD_CANCEL'), role: 'cancel' },
        {
          text: this.t.instant('PROD_DELETE_BTN'),
          role: 'destructive',
          handler: () => this.deleteProduct(product._id),
        },
      ],
    });
    await alert.present();
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  /** stockStatus не хранится в БД — вычисляем на фронте из stock/minStock */
  public computeStockStatus(product: IProduct): 'normal' | 'low' | 'out_of_stock' {
    if (product.stockStatus) return product.stockStatus; // если бэк всё же прислал
    const stock = product.stock ?? 0;
    if (stock <= 0) return 'out_of_stock';
    if (product.minStock != null && stock <= product.minStock) return 'low';
    return 'normal';
  }

  public getStockStatusColor(product: IProduct): string {
    switch (this.computeStockStatus(product)) {
      case 'low': return 'warning';
      case 'out_of_stock': return 'danger';
      default: return 'success';
    }
  }

  public getStockStatusLabel(product: IProduct): string {
    switch (this.computeStockStatus(product)) {
      case 'low': return this.t.instant('PROD_STOCK_LOW');
      case 'out_of_stock': return this.t.instant('PROD_STOCK_OUT');
      default: return 'OK';
    }
  }

  public formatPrice(value: number | undefined): string {
    if (value == null) return '—';
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private peekFirstItem(): void {
    if (localStorage.getItem(this.SWIPE_HINT_KEY)) return;
    setTimeout(async () => {
      const first = this.slidingItems?.first;
      if (!first) return;
      try {
        await first.open('end');
        setTimeout(async () => {
          await first.close();
          localStorage.setItem(this.SWIPE_HINT_KEY, '1');
        }, 900);
      } catch { /* ignore */ }
    }, 900);
  }

  private refresh(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadProducts(true);
  }

  private buildFilters() {
    const f: Record<string, unknown> = { limit: 25, offset: this.offset() };
    if (this.searchQuery())       f['search']      = this.searchQuery();
    if (this.statusFilter())      f['status']      = this.statusFilter();
    if (this.stockStatusFilter()) f['stockStatus'] = this.stockStatusFilter();
    return f;
  }

  private loadProducts(reset: boolean): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);

    this.productsService
      .getProducts(this.buildFilters())
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = reset ? res.results : [...this.products(), ...res.results];
          this.products.set(list);
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

  private async loadProductsAsync(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.hasMore()) { resolve(); return; }
      this.productsService
        .getProducts(this.buildFilters())
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            const list = [...this.products(), ...res.results];
            this.products.set(list);
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

  private deleteProduct(id: string): void {
    this.productsService
      .delete(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.refresh();
          void this.showToast(this.t.instant('PROD_DELETED'));
        },
        error: (err) => {
          const msg = err?.error?.message ?? this.t.instant('PROD_FAIL_DELETE');
          void this.showToast(msg, 'danger');
        },
      });
  }

  private closeSlidingItems(): void {
    this.slidingItems?.forEach((item) => item.close());
  }

  private ensureDepartmentsLoaded(): void {
    // Загружаем всегда — нужно для effectiveDepartmentId() single-mode тоже
    if (!this.departmentService.departmentsSignal()) {
      this.departmentService
        .getDepartments({ limit: 50 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }

  private async showSubscriptionAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t.instant('PROD_SUB_REQUIRED_TITLE'),
      message: this.t.instant('PROD_SUB_REQUIRED_MSG'),
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async showToast(message: string, color = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }
}
