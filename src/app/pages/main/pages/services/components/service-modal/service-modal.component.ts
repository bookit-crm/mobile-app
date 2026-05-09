import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import { IDepartment } from '@core/models/department.interface';
import { IProduct } from '@core/models/product.interface';
import { IService } from '@core/models/service.interface';
import { DepartmentService } from '@core/services/department.service';
import { ProductsService } from '@core/services/products.service';
import { ServicesService } from '@core/services/services.service';

interface IConsumableForm {
  productId: string;
  quantity: number;
}

interface IServicePayload {
  name: string;
  duration: number;
  price: number;
  department: string;
  description?: string;
  category?: string;
  consumableProducts?: { product: string; quantity: number }[];
}

@Component({
  selector: 'app-service-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, TranslateModule],
  templateUrl: './service-modal.component.html',
  styleUrls: ['./service-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceModalComponent implements OnInit {
  @Input() public service: IService | null = null;
  @Input() public departmentId: string = '';

  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly servicesService = inject(ServicesService);
  private readonly departmentService = inject(DepartmentService);
  private readonly productsService = inject(ProductsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  public readonly isLoading = signal(false);
  public departments: IDepartment[] = [];
  public availableProducts: IProduct[] = [];

  public name = '';
  public category = '';
  public description = '';
  public duration = 30;
  public price = 0;
  public selectedDepartmentId = '';
  public consumables: IConsumableForm[] = [];

  public get isEdit(): boolean { return !!this.service; }
  public get title(): string { return this.isEdit ? 'Edit Service' : 'Add Service'; }

  ngOnInit(): void {
    if (this.service) {
      this.name = this.service.name;
      this.category = this.service.category?.value ?? '';
      this.description = this.service.description ?? '';
      this.duration = this.service.duration;
      this.price = this.service.price;
      this.selectedDepartmentId =
        typeof this.service.department === 'string'
          ? this.service.department
          : (this.service.department as IDepartment)?._id ?? '';
      this.consumables = (this.service.consumableProducts ?? []).map((cp) => ({
        productId: typeof cp.product === 'string'
          ? cp.product
          : (cp.product as IProduct)._id,
        quantity: cp.quantity,
      }));
    } else if (this.departmentId) {
      this.selectedDepartmentId = this.departmentId;
    }
    this.loadDepartments();
    this.loadProducts();
  }

  public dismiss(): void { void this.modalCtrl.dismiss(null); }

  public save(): void {
    if (this.isLoading()) return;
    if (!this.name.trim() || !this.selectedDepartmentId) {
      void this.showToast(this.t.instant('SVC_NAME_DEPT_REQUIRED'), 'warning');
      return;
    }

    this.isLoading.set(true);

    const payload: IServicePayload = {
      name: this.name.trim(),
      duration: Number(this.duration),
      price: Number(this.price),
      department: this.selectedDepartmentId,
      consumableProducts: this.consumables
        .filter((c) => c.productId && c.quantity > 0)
        .map((c) => ({ product: c.productId, quantity: Number(c.quantity) })),
    };
    const trimmedCategory = this.category.trim();
    const trimmedDescription = this.description.trim();
    if (trimmedCategory) payload.category = trimmedCategory;
    if (trimmedDescription) payload.description = trimmedDescription;

    const request$ = this.isEdit
      ? this.servicesService.patchServiceById(this.service!._id, payload as any)
      : this.servicesService.create(payload as any);

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.isLoading.set(false);
        const msg = this.t.instant(this.isEdit ? 'SVC_UPDATED_TOAST' : 'SVC_CREATED_TOAST');
        void this.modalCtrl.dismiss({ saved: true });
        void this.showToast(msg);
      },
      error: (err) => {
        console.error('[ServiceModal] save error', {
          status: err?.status,
          message: err?.message,
          error: err?.error,
        });
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || this.t.instant('SVC_ERROR_TOAST');
        void this.showToast(msg, 'danger');
        this.cdr.markForCheck();
      },
    });
  }

  public addConsumable(): void {
    this.consumables = [...this.consumables, { productId: '', quantity: 1 }];
  }

  public removeConsumable(index: number): void {
    this.consumables = this.consumables.filter((_, i) => i !== index);
  }

  public trackByIndex(index: number): number { return index; }

  private loadDepartments(): void {
    this.departmentService.getDepartments({ limit: 50 }).pipe(take(1)).subscribe({
      next: (res) => {
        this.departments = res.results;
        if (!this.selectedDepartmentId && res.results.length === 1) {
          this.selectedDepartmentId = res.results[0]._id;
        }
        this.cdr.markForCheck();
      },
    });
  }

  private loadProducts(): void {
    const filters: { limit: number; status: string; departmentId?: string } = {
      limit: 200,
      status: 'active',
    };
    if (this.selectedDepartmentId) {
      filters.departmentId = this.selectedDepartmentId;
    }
    this.productsService.getProducts(filters).pipe(take(1)).subscribe({
      next: (res) => {
        this.availableProducts = res.results;
        this.cdr.markForCheck();
      },
      error: () => {
        this.availableProducts = [];
        this.cdr.markForCheck();
      },
    });
  }

  private showToast(message: string, color = 'success'): Promise<void> {
    return this.toastCtrl.create({ message, duration: 2500, color })
      .then((t) => t.present());
  }
}
