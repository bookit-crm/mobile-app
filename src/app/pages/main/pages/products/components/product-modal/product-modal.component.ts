import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular';
import { take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { IDepartment } from '@core/models/department.interface';
import { IProduct } from '@core/models/product.interface';
import { DepartmentService } from '@core/services/department.service';
import { ICreateProductPayload, IUpdateProductPayload, ProductsService } from '@core/services/products.service';
import { SupervisorService } from '@core/services/supervisor.service';

@Component({
  selector: 'app-product-modal',
  templateUrl: './product-modal.component.html',
  styleUrls: ['./product-modal.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductModalComponent implements OnInit {
  @Input() product: IProduct | null = null;

  private readonly productsService = inject(ProductsService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly departmentService = inject(DepartmentService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  public isSaving = false;
  public selectedDepartmentId: string | null = null;
  public selectedDepartmentName = '';
  public departmentTouched = false;

  public productPhotoIds: string[] = [];
  public existingProductPhotos: { _id: string; url: string }[] = [];

  public readonly singleDepartmentMode = computed(() => this.supervisorService.singleDepartmentMode());

  public get departments(): IDepartment[] {
    return this.departmentService.departmentsSignal()?.results ?? [];
  }

  public get unitOptions() {
    return [
      { value: 'pcs', label: this.t.instant('PROD_UNIT_PCS') },
      { value: 'kg', label: this.t.instant('PROD_UNIT_KG') },
      { value: 'l', label: this.t.instant('PROD_UNIT_L') },
    ];
  }

  public form!: FormGroup;

  get isEditMode(): boolean {
    return !!this.product?._id;
  }

  get modalTitle(): string {
    return this.isEditMode ? this.t.instant('PROD_EDIT_TITLE') : this.t.instant('PROD_ADD_TITLE');
  }

  ngOnInit(): void {
    const p = this.product;

    // Init photos
    this.existingProductPhotos = (p?.photos ?? []).map(ph => ({ _id: ph._id, url: ph.url }));
    this.productPhotoIds = this.existingProductPhotos.map(ph => ph._id);

    // Инициализируем departmentId
    if (p?.department) {
      // Режим редактирования — берём из товара
      if (typeof p.department === 'string') {
        this.selectedDepartmentId = p.department;
      } else {
        this.selectedDepartmentId = p.department._id;
        this.selectedDepartmentName = p.department.name;
      }
    } else {
      // Создание — сначала пробуем из сигнала
      const effId = this.supervisorService.effectiveDepartmentId();
      if (effId) {
        this.selectedDepartmentId = effId;
        const dept = this.departmentService.departmentsSignal()?.results?.find(d => d._id === effId);
        this.selectedDepartmentName = dept?.name ?? '';
      } else {
        // effectiveDepartmentId ещё не готов — загружаем департаменты
        this.departmentService.getDepartments({ limit: 50 })
          .pipe(take(1))
          .subscribe(() => {
            // После загрузки effectiveDepartmentId должен обновиться через computed signal
            const freshId = this.supervisorService.effectiveDepartmentId();
            if (freshId && !this.selectedDepartmentId) {
              this.selectedDepartmentId = freshId;
              const dept = this.departmentService.departmentsSignal()?.results?.find(d => d._id === freshId);
              this.selectedDepartmentName = dept?.name ?? '';
              this.cdr.markForCheck();
            }
          });
      }
    }
    const controls: Record<string, FormControl> = {
      name: new FormControl(p?.name ?? '', [Validators.required, Validators.minLength(1)]),
      sku: new FormControl(p?.sku ?? ''),
      unit: new FormControl(p?.unit ?? 'pcs'),
      purchasePrice: new FormControl(p?.purchasePrice ?? null, [Validators.required, Validators.min(0)]),
      salePrice: new FormControl(p?.salePrice ?? null, [Validators.required, Validators.min(0)]),
      stock: new FormControl(p?.stock ?? 0, [Validators.min(0)]),
      minStock: new FormControl(p?.minStock ?? null, [Validators.min(0)]),
      maxStock: new FormControl(p?.maxStock ?? null, [Validators.min(0)]),
      description: new FormControl(p?.description ?? ''),
    };

    if (this.isEditMode) {
      controls['comment'] = new FormControl('');
    }

    this.form = new FormGroup(controls);
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  public onPhotosChanged(files: { _id: string; url: string }[]): void {
    this.productPhotoIds = files.map(f => f._id);
  }

  public submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    if (!this.isEditMode && !this.selectedDepartmentId) {
      if (this.singleDepartmentMode()) {
        // Должно разрешиться после загрузки — пробуем ещё раз
        const freshId = this.supervisorService.effectiveDepartmentId();
        if (freshId) {
          this.selectedDepartmentId = freshId;
        } else {
          // Кеш пустой — загружаем и повторяем submit
          this.isSaving = true;
          this.cdr.markForCheck();
          this.departmentService.getDepartments({ limit: 50 })
            .pipe(take(1))
            .subscribe(() => {
              this.isSaving = false;
              this.selectedDepartmentId = this.supervisorService.effectiveDepartmentId();
              this.cdr.markForCheck();
              if (this.selectedDepartmentId) {
                this.submit();
              }
            });
          return;
        }
      } else {
        // Для multi-department — пользователь должен выбрать через селект
        this.departmentTouched = true;
        this.cdr.markForCheck();
        return;
      }
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    const raw = this.form.getRawValue();

    if (this.isEditMode) {
      const payload: IUpdateProductPayload = {
        name: raw['name'],
        sku: raw['sku'] || undefined,
        unit: raw['unit'],
        purchasePrice: Number(raw['purchasePrice']),
        salePrice: Number(raw['salePrice']),
        stock: raw['stock'] != null ? Number(raw['stock']) : 0,
        minStock: raw['minStock'] != null && raw['minStock'] !== '' ? Number(raw['minStock']) : undefined,
        maxStock: raw['maxStock'] != null && raw['maxStock'] !== '' ? Number(raw['maxStock']) : undefined,
        description: raw['description'] || undefined,
        comment: raw['comment'] || undefined,
        photos: this.productPhotoIds.length > 0 ? this.productPhotoIds : undefined,
      };
      this.productsService.update(this.product!._id, payload).pipe(take(1)).subscribe({
        next: () => { this.isSaving = false; void this.modalCtrl.dismiss({ saved: true }); },
        error: (err) => {
          this.isSaving = false;
          this.cdr.markForCheck();
          const msg = err?.error?.message ?? this.t.instant('PROD_FAIL_SAVE');
          void this.showErrorToast(msg);
        },
      });
    } else {
      const payload: ICreateProductPayload = {
        name: raw['name'],
        sku: raw['sku'] || undefined,
        unit: raw['unit'],
        purchasePrice: Number(raw['purchasePrice']),
        salePrice: Number(raw['salePrice']),
        stock: raw['stock'] != null ? Number(raw['stock']) : 0,
        minStock: raw['minStock'] != null && raw['minStock'] !== '' ? Number(raw['minStock']) : undefined,
        maxStock: raw['maxStock'] != null && raw['maxStock'] !== '' ? Number(raw['maxStock']) : undefined,
        description: raw['description'] || undefined,
        department: this.selectedDepartmentId!,
        photos: this.productPhotoIds.length > 0 ? this.productPhotoIds : undefined,
      };
      this.productsService.create(payload).pipe(take(1)).subscribe({
        next: () => { this.isSaving = false; void this.modalCtrl.dismiss({ saved: true }); },
        error: (err) => {
          this.isSaving = false;
          this.cdr.markForCheck();
          const msg = err?.error?.message ?? this.t.instant('PROD_FAIL_CREATE');
          void this.showErrorToast(msg);
        },
      });
    }
  }

  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color: 'danger',
      icon: 'alert-circle-outline',
      position: 'top',
    });
    await toast.present();
  }

  public hasError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.hasError(error));
  }
}



