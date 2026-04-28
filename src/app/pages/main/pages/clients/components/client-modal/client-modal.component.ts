import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  OnInit,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { take } from 'rxjs';

import { IClient, ICreateClientPayload } from '@core/models/client.interface';
import { ClientsService } from '@core/services/clients.service';

const PHONE_PATTERN = /^[+\d\s\-().]{7,20}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

@Component({
  selector: 'app-client-modal',
  templateUrl: './client-modal.component.html',
  styleUrls: ['./client-modal.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientModalComponent implements OnInit {
  @Input() client: IClient | null = null;

  private readonly clientsService = inject(ClientsService);
  private readonly modalCtrl = inject(ModalController);
  private readonly cdr = inject(ChangeDetectorRef);

  public isSaving = false;

  public form = new FormGroup({
    fullName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    phone: new FormControl('', [Validators.required, Validators.pattern(PHONE_PATTERN)]),
    email: new FormControl('', [Validators.pattern(EMAIL_PATTERN)]),
    dateOfBirth: new FormControl(''),
    city: new FormControl(''),
    description: new FormControl(''),
  });

  get isEditMode(): boolean {
    return !!this.client?._id;
  }

  get modalTitle(): string {
    return this.isEditMode ? 'Edit Client' : 'Add Client';
  }

  ngOnInit(): void {
    if (this.client) {
      this.form.patchValue({
        fullName: this.client.fullName ?? '',
        phone: this.client.phone ?? '',
        email: this.client.email ?? '',
        dateOfBirth: this.client.dateOfBirth ? this.client.dateOfBirth.split('T')[0] : '',
        city: this.client.city ?? '',
        description: this.client.description ?? '',
      });
    }
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  public submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    const raw = this.form.getRawValue();
    const payload: ICreateClientPayload = {
      fullName: raw.fullName!,
      phone: raw.phone!,
      email: raw.email || undefined,
      dateOfBirth: raw.dateOfBirth || undefined,
      city: raw.city || undefined,
      description: raw.description || undefined,
    };

    const save$ = this.isEditMode
      ? this.clientsService.patchClient(this.client!._id, payload)
      : this.clientsService.addClient(payload);

    save$.pipe(take(1)).subscribe({
      next: () => {
        this.isSaving = false;
        void this.modalCtrl.dismiss({ saved: true });
      },
      error: () => {
        this.isSaving = false;
        this.cdr.markForCheck();
      },
    });
  }

  public hasError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.touched && ctrl?.hasError(error));
  }
}

