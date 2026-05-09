import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';
import { IPromoCode, IPromoCodeService, DiscountType } from '@core/models/promo-code.interface';
import { IDepartment } from '@core/models/department.interface';
import { IService } from '@core/models/service.interface';
import { PromoCodesService } from '@core/services/promo-codes.service';
import { ServicesService } from '@core/services/services.service';

@Component({
  selector: 'app-promo-code-form-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './promo-code-form-modal.component.html',
  styleUrls: ['./promo-code-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromoCodeFormModalComponent implements OnInit {
  @Input() promoCode: IPromoCode | null = null;
  @Input() department!: IDepartment;

  private readonly promoCodesService = inject(PromoCodesService);
  private readonly servicesService = inject(ServicesService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  public isSubmitting = false;
  public isEditMode = false;
  public availableServices: IService[] = [];

  public readonly discountTypeOptions: { value: DiscountType; label: string }[] = [
    { value: 'percentage', label: 'PC_DISCOUNT_PERCENTAGE' },
    { value: 'fixed', label: 'PC_DISCOUNT_FIXED' },
  ];

  public form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl<string | null>(null),
    endDate: new FormControl<string | null>(null),
    isVisible: new FormControl<boolean>(true, { nonNullable: true }),
    serviceRows: new FormArray<FormGroup>([]),
  });

  get serviceRows(): FormArray<FormGroup> {
    return this.form.get('serviceRows') as FormArray<FormGroup>;
  }

  get departmentName(): string {
    return this.department?.name ?? '';
  }

  ngOnInit(): void {
    this.isEditMode = !!this.promoCode?._id;
    this.populateForm();
    this.loadServices();
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss(false);
  }

  public addServiceRow(svc: IPromoCodeService | null = null): void {
    const serviceValue = svc
      ? (typeof svc.service === 'string'
          ? this.availableServices.find((s) => s._id === svc.service) ?? null
          : svc.service)
      : null;

    const row = new FormGroup({
      service: new FormControl<IService | null>(serviceValue as IService | null, [Validators.required]),
      discountType: new FormControl<DiscountType>(svc?.discountType ?? 'percentage', { nonNullable: true }),
      discountValue: new FormControl<number>(svc?.discountValue ?? 0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
    });
    this.serviceRows.push(row);
    this.cdr.markForCheck();
  }

  public removeServiceRow(index: number): void {
    this.serviceRows.removeAt(index);
    this.cdr.markForCheck();
  }

  public getRowControl(row: AbstractControl, name: string): FormControl {
    return (row as FormGroup).get(name) as FormControl;
  }

  public submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const raw = this.form.getRawValue();

    const services: Partial<IPromoCodeService>[] = raw.serviceRows.map((r) => ({
      service: (r['service'] as IService)?._id ?? r['service'],
      discountType: r['discountType'] as DiscountType,
      discountValue: Number(r['discountValue']),
    }));

    const payload: Partial<IPromoCode> = {
      name: raw.name,
      department: this.department._id as unknown as IDepartment,
      services: services as IPromoCodeService[],
      startDate: raw.startDate || null,
      endDate: raw.endDate || null,
      isVisible: raw.isVisible,
    };

    const id = this.promoCode?._id;
    const save$ = id
      ? this.promoCodesService.update(id, payload)
      : this.promoCodesService.create(payload);

    save$.pipe(take(1)).subscribe({
      next: async () => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
        const toast = await this.toastCtrl.create({
          message: this.t.instant(this.isEditMode ? 'PC_UPDATED_TOAST' : 'PC_CREATED_TOAST'),
          duration: 2000,
          color: 'success',
        });
        await toast.present();
        void this.modalCtrl.dismiss(true);
      },
      error: async () => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
        const toast = await this.toastCtrl.create({
          message: this.t.instant('PC_ERROR_TOAST'),
          duration: 3000,
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  private populateForm(): void {
    const promo = this.promoCode;
    if (!promo) return;

    this.form.patchValue({
      name: promo.name,
      startDate: promo.startDate ? this.toDateInput(promo.startDate) : null,
      endDate: promo.endDate ? this.toDateInput(promo.endDate) : null,
      isVisible: promo.isVisible,
    });

    // Rows will be populated after services load
  }

  private loadServices(): void {
    const deptId = this.department?._id;
    if (!deptId) return;

    this.servicesService
      .getServices({ departmentId: deptId, limit: 100 })
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.availableServices = res.results;
          // Now populate service rows after services are loaded
          if (this.isEditMode && this.promoCode?.services?.length) {
            for (const svc of this.promoCode.services) {
              this.addServiceRow(svc);
            }
          } else if (!this.isEditMode && this.serviceRows.length === 0) {
            this.addServiceRow();
          }
          this.cdr.markForCheck();
        },
      });
  }

  private toDateInput(dateStr: string): string {
    try {
      return new Date(dateStr).toISOString().substring(0, 10);
    } catch {
      return dateStr;
    }
  }
}

