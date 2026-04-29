import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalController } from '@ionic/angular';
import { take } from 'rxjs';

import { IProductHistory, IProductHistoryList, TProductHistoryAction } from '@core/models/product.interface';
import { ProductsService } from '@core/services/products.service';

@Component({
  selector: 'app-product-history',
  templateUrl: './product-history.component.html',
  styleUrls: ['./product-history.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductHistoryComponent implements OnInit {
  /** Если передан — история конкретного товара, иначе — глобальная */
  @Input() productId: string | null = null;
  @Input() productName: string | null = null;

  private readonly productsService = inject(ProductsService);
  private readonly modalCtrl = inject(ModalController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  public history = signal<IProductHistory[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public hasMore = signal(true);
  private offset = 0;

  public readonly actionOptions: Array<{ value: TProductHistoryAction | 'all'; label: string }> = [
    { value: 'all', label: 'All Actions' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'archived', label: 'Archived' },
    { value: 'unarchived', label: 'Unarchived' },
    { value: 'imported', label: 'Imported' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'consumed', label: 'Consumed' },
  ];

  public selectedAction: TProductHistoryAction | 'all' = 'all';

  get modalTitle(): string {
    return this.productName ? `History: ${this.productName}` : 'Products History';
  }

  ngOnInit(): void {
    this.loadHistory(true);
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  public onActionChange(event: CustomEvent): void {
    this.selectedAction = event.detail.value as TProductHistoryAction | 'all';
    this.offset = 0;
    this.hasMore.set(true);
    this.loadHistory(true);
  }

  public async onInfiniteScroll(event: Event): Promise<void> {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    await this.loadHistoryAsync();
    (event as CustomEvent & { target: { complete: () => void } }).target.complete();
  }

  public getActionColor(action: TProductHistoryAction): string {
    const map: Record<TProductHistoryAction, string> = {
      created: 'success',
      updated: 'primary',
      archived: 'warning',
      unarchived: 'tertiary',
      imported: 'secondary',
      deleted: 'danger',
      consumed: 'medium',
    };
    return map[action] ?? 'medium';
  }

  public formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  public getProductName(item: IProductHistory): string {
    if (item.productName) return item.productName;
    if (typeof item.product === 'object' && item.product?.name) return item.product.name;
    return '—';
  }

  private buildFilters() {
    return {
      limit: 25,
      offset: this.offset,
      ...(this.selectedAction !== 'all' ? { action: this.selectedAction } : {}),
    };
  }

  private loadHistory(reset: boolean): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);

    const request$ = this.productId
      ? this.productsService.getProductHistory(this.productId, this.buildFilters())
      : this.productsService.getAllProductsHistory(this.buildFilters());

    request$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: IProductHistoryList) => {
          const list = reset ? res.results : [...this.history(), ...res.results];
          this.history.set(list);
          this.totalCount.set(res.count);
          this.offset = list.length;
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

  private async loadHistoryAsync(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.hasMore()) { resolve(); return; }
      const request$ = this.productId
        ? this.productsService.getProductHistory(this.productId, this.buildFilters())
        : this.productsService.getAllProductsHistory(this.buildFilters());

      request$.pipe(take(1)).subscribe({
        next: (res: IProductHistoryList) => {
          const list = [...this.history(), ...res.results];
          this.history.set(list);
          this.totalCount.set(res.count);
          this.offset = list.length;
          this.hasMore.set(list.length < res.count);
          this.cdr.markForCheck();
          resolve();
        },
        error: () => resolve(),
      });
    });
  }
}

