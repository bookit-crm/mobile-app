import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { take } from 'rxjs';
import { IDepartment } from '@core/models/department.interface';
import { DepartmentService } from '@core/services/department.service';

@Component({
  selector: 'app-department-form-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  templateUrl: './department-form-modal.component.html',
  styleUrls: ['./department-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentFormModalComponent implements OnInit {
  @Input() department: IDepartment | null = null;

  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly departmentService = inject(DepartmentService);
  private readonly cdr = inject(ChangeDetectorRef);

  public isSubmitting = false;

  public form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl(''),
    websiteURL: new FormControl(''),
    formattedAddress: new FormControl(''),
  });

  public get isEditMode(): boolean {
    return !!this.department?._id;
  }

  ngOnInit(): void {
    if (this.department) {
      this.form.patchValue({
        name: this.department.name,
        phone: this.department.phone ?? '',
        websiteURL: this.department.websiteURL ?? '',
        formattedAddress: this.department.location?.formattedAddress ?? '',
      });
    }
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss(false);
  }

  public submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const { name, phone, websiteURL, formattedAddress } = this.form.getRawValue();

    const payload: Partial<IDepartment> = {
      name,
      phone: phone ?? undefined,
      websiteURL: websiteURL ?? undefined,
      location: formattedAddress ? { formattedAddress } : undefined,
    };

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const request$ = this.isEditMode
      ? this.departmentService.patchDepartment(this.department!._id, payload)
      : this.departmentService.addDepartment(payload);

    request$.pipe(take(1)).subscribe({
      next: async () => {
        this.isSubmitting = false;
        const toast = await this.toastCtrl.create({
          message: this.isEditMode ? 'Department updated' : 'Department created',
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
          message: 'An error occurred. Please try again.',
          duration: 3000,
          color: 'danger',
        });
        await toast.present();
      },
    });
  }
}

