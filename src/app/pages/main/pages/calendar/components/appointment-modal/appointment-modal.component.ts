import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  computed, DestroyRef, inject, Input, OnInit, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule, ModalController } from '@ionic/angular';
import { combineLatest, Observable, of, switchMap, take } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

import { IAppointment, AppointmentStatus, IService } from '@core/models/appointment.interface';
import { IEmployee } from '@core/models/employee.interface';
import { IDepartment } from '@core/models/department.interface';
import { IClient } from '@core/models/client.interface';
import { EUserRole } from '@core/enums/e-user-role';

import { AppointmentsService } from '@core/services/appointments.service';
import { ClientsService } from '@core/services/clients.service';
import { DepartmentService } from '@core/services/department.service';
import { EmployeeService } from '@core/services/employee.service';
import { ServicesService } from '@core/services/services.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { DateFnsHelper } from '@core/helpers/date-fns.helper';

export interface IAppointmentModalPayload {
  _id?: string;          // если задан → edit mode
  department?: string;
  employee?: string;
  startDate?: string;    // YYYY-MM-DD
  from?: string;         // HH:mm
}

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
  templateUrl: './appointment-modal.component.html',
  styleUrls: ['./appointment-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentModalComponent implements OnInit {
  @Input() payload: IAppointmentModalPayload = {};

  private readonly ctrl = inject(ModalController);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  private readonly appointmentsService = inject(AppointmentsService);
  private readonly clientsService = inject(ClientsService);
  private readonly departmentService = inject(DepartmentService);
  private readonly employeeService = inject(EmployeeService);
  private readonly servicesService = inject(ServicesService);
  private readonly supervisorService = inject(SupervisorService);

  public readonly AppointmentStatus = AppointmentStatus;

  public readonly isManager = computed(
    () => this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER,
  );

  private readonly managerDepartmentId = computed(() => {
    const dept = this.supervisorService.authUserSignal()?.department;
    if (!dept) return '';
    return typeof dept === 'string' ? dept : dept._id;
  });

  // ── State ─────────────────────────────────────────────────────────────────
  public isEditMode = false;
  public isLoading = signal(false);
  public isSaving = signal(false);
  public isNewClient = signal(false);

  public appointment = signal<IAppointment | null>(null);
  public form!: FormGroup;

  public clients = signal<IClient[]>([]);
  public filteredClients = signal<IClient[]>([]);
  public departments = signal<IDepartment[]>([]);
  public employees = signal<IEmployee[]>([]);
  public services = signal<IService[]>([]);

  public clientSearch = '';
  public totalPrice = signal(0);
  public totalDuration = signal(0); // минут

  public readonly statusOptions = [
    { value: AppointmentStatus.New, label: 'New' },
    { value: AppointmentStatus.Completed, label: 'Completed' },
    { value: AppointmentStatus.Canceled, label: 'Canceled' },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.isEditMode = !!this.payload?._id;
    this.isLoading.set(true);

    if (this.isEditMode) {
      this.loadExistingAppointment();
    } else {
      this.initForm(null);
      this.loadInitialData();
    }
  }

  // ── Public actions ────────────────────────────────────────────────────────
  public close(): void {
    this.ctrl.dismiss(null);
  }

  public toggleNewClient(): void {
    const v = !this.isNewClient();
    this.isNewClient.set(v);
    if (v) {
      this.form.get('clientId')?.clearValidators();
      this.form.get('clientId')?.setValue('');
      this.form.get('clientName')?.setValidators([Validators.required]);
      this.form.get('clientPhone')?.setValidators([Validators.required]);
    } else {
      this.form.get('clientId')?.setValidators([Validators.required]);
      this.form.get('clientName')?.clearValidators();
      this.form.get('clientPhone')?.clearValidators();
    }
    this.form.get('clientId')?.updateValueAndValidity();
    this.form.get('clientName')?.updateValueAndValidity();
    this.form.get('clientPhone')?.updateValueAndValidity();
  }

  public filterClients(search: string): void {
    this.clientSearch = search;
    const q = search.toLowerCase().trim();
    if (!q) {
      this.filteredClients.set(this.clients());
    } else {
      this.filteredClients.set(
        this.clients().filter(c =>
          c.fullName?.toLowerCase().includes(q) || c.phone?.includes(q),
        ),
      );
    }
  }

  public selectClient(client: IClient): void {
    this.form.get('clientId')?.setValue(client._id);
    this.clientSearch = client.fullName;
  }

  public isClientSelected(id: string): boolean {
    return this.form.get('clientId')?.value === id;
  }

  public onDepartmentChange(deptId: string): void {
    this.form.get('employeeId')?.setValue('');
    this.form.get('serviceIds')?.setValue([]);
    this.employees.set([]);
    this.services.set([]);
    this.totalPrice.set(0);
    this.totalDuration.set(0);
    if (deptId) {
      this.loadEmployeesAndServices(deptId);
    }
  }

  public toggleService(id: string): void {
    const current: string[] = [...(this.form.get('serviceIds')?.value ?? [])];
    const idx = current.indexOf(id);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(id);
    }
    this.form.get('serviceIds')?.setValue(current);
    this.recalculate();
  }

  public isServiceSelected(id: string): boolean {
    return (this.form.get('serviceIds')?.value ?? []).includes(id);
  }

  public onServicesChange(): void {
    this.recalculate();
  }

  public async save(): Promise<void> {
    if (this.form.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    const payload = this.buildPayload();

    const client$: Observable<IClient | null> = this.isNewClient()
      ? this.clientsService.addClient({
          fullName: this.form.value.clientName,
          phone: this.form.value.clientPhone,
        })
      : of(null);

    client$
      .pipe(
        take(1),
        switchMap((newClient) => {
          if (newClient?._id) {
            payload['client'] = newClient._id;
          }
          return this.isEditMode
            ? this.appointmentsService.patchAppointmentById(this.payload._id!, payload)
            : this.appointmentsService.postAppointment(payload);
        }),
        take(1),
      )
      .subscribe({
        next: (result) => {
          this.isSaving.set(false);
          this.ctrl.dismiss({ saved: true, appointment: result });
        },
        error: () => {
          this.isSaving.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  public cancelAppointment(): void {
    if (!this.payload._id) return;
    this.isSaving.set(true);
    this.appointmentsService
      .patchAppointmentById(this.payload._id, { status: AppointmentStatus.Canceled } as any)
      .pipe(take(1))
      .subscribe({
        next: (apt) => {
          this.isSaving.set(false);
          this.ctrl.dismiss({ saved: true, appointment: apt });
        },
        error: () => { this.isSaving.set(false); this.cdr.markForCheck(); },
      });
  }

  public deleteAppointment(): void {
    if (!this.payload._id) return;
    this.isSaving.set(true);
    this.appointmentsService
      .deleteAppointmentById(this.payload._id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.ctrl.dismiss({ deleted: true });
        },
        error: () => { this.isSaving.set(false); this.cdr.markForCheck(); },
      });
  }

  // ── Service helpers ───────────────────────────────────────────────────────
  public getServiceName(id: string): string {
    return this.services().find(s => s._id === id)?.name ?? id;
  }

  public formatDuration(minutes: number): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : `${m}min`;
  }

  // ── DateTime picker helpers ───────────────────────────────────────────────
  /** Converts "HH:mm" string to ISO format for ion-datetime */
  public getTimeISO(time: string): string {
    if (!time || time.length < 4) return '';
    return `2000-01-01T${time}:00`;
  }

  public onStartDateChange(ev: Event): void {
    const val = (ev as CustomEvent).detail.value as string | null;
    if (!val) return;
    this.form.get('startDate')?.setValue(val.slice(0, 10));
  }

  public onFromTimeChange(ev: Event): void {
    const val = (ev as CustomEvent).detail.value as string | null;
    if (!val) return;
    const timePart = val.includes('T') ? val.split('T')[1]!.slice(0, 5) : val.slice(0, 5);
    this.form.get('fromTime')?.setValue(timePart);
  }

  public onToTimeChange(ev: Event): void {
    const val = (ev as CustomEvent).detail.value as string | null;
    if (!val) return;
    const timePart = val.includes('T') ? val.split('T')[1]!.slice(0, 5) : val.slice(0, 5);
    this.form.get('toTime')?.setValue(timePart);
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private initForm(apt: IAppointment | null): void {
    const today = DateFnsHelper.getCurrentDate();
    const defaultDeptId = this.isManager() ? this.managerDepartmentId() : (this.payload?.department ?? '');

    this.form = this.fb.group({
      clientId: [apt?.client?._id ?? '', Validators.required],
      clientName: [''],
      clientPhone: [''],
      departmentId: [
        apt ? (typeof apt.department === 'string' ? apt.department : apt.department?._id) ?? '' : defaultDeptId,
        Validators.required,
      ],
      employeeId: [apt?.employee?._id ?? this.payload?.employee ?? '', Validators.required],
      serviceIds: [apt?.services?.map(s => s._id) ?? [], Validators.required],
      startDate: [
        apt ? DateFnsHelper.convertDate(apt.startDate) : (this.payload?.startDate ?? today),
        Validators.required,
      ],
      fromTime: [
        apt ? DateFnsHelper.convertDate(apt.startDate, 'HH:mm') : (this.payload?.from ?? ''),
        [Validators.required],
      ],
      toTime: [
        apt ? DateFnsHelper.convertDate(apt.endDate, 'HH:mm') : '',
        [Validators.required],
      ],
      comment: [apt?.comment ?? ''],
      status: [apt?.status ?? AppointmentStatus.New],
    });

    // auto-recalculate end time on service/time change
    combineLatest([
      this.form.get('fromTime')!.valueChanges.pipe(startWith(this.form.value.fromTime)),
      this.form.get('serviceIds')!.valueChanges.pipe(startWith(this.form.value.serviceIds)),
    ])
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(([from, ids]) => this.autoCalcEndTime(from, ids));

    this.cdr.markForCheck();
  }

  private loadExistingAppointment(): void {
    this.appointmentsService
      .getAppointmentById(this.payload._id!)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apt) => {
          this.appointment.set(apt);
          this.initForm(apt);
          this.loadClients();
          const deptId = typeof apt.department === 'string' ? apt.department : apt.department?._id;
          if (deptId) {
            this.loadEmployeesAndServices(deptId);
          }
          if (!this.isManager()) this.loadDepartments();
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => { this.isLoading.set(false); this.cdr.markForCheck(); },
      });
  }

  private loadInitialData(): void {
    this.loadClients();
    if (!this.isManager()) {
      this.loadDepartments();
    }
    const deptId = this.isManager()
      ? this.managerDepartmentId()
      : (this.payload?.department ?? '');
    if (deptId) {
      this.loadEmployeesAndServices(deptId);
    }
    this.isLoading.set(false);
    this.cdr.markForCheck();
  }

  private loadClients(): void {
    this.clientsService
      .getClients({ limit: 50 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.clients.set(res.results);
        this.filteredClients.set(res.results);
        // pre-fill search with selected client name
        const clientId = this.form.get('clientId')?.value;
        if (clientId) {
          const found = res.results.find(c => c._id === clientId);
          if (found) this.clientSearch = found.fullName;
        }
        this.cdr.markForCheck();
      });
  }

  private loadDepartments(): void {
    this.departmentService
      .getDepartments({ limit: 50 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.departments.set(res.results);
        this.cdr.markForCheck();
      });
  }

  private loadEmployeesAndServices(deptId: string): void {
    this.employeeService
      .getEmployees({ departmentId: deptId, limit: 50 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.employees.set(res.results);
        this.cdr.markForCheck();
      });
    this.servicesService
      .getServices({ departmentId: deptId, limit: 100 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.services.set(res.results);
        this.recalculate();
        this.cdr.markForCheck();
      });
  }

  private autoCalcEndTime(from: string, serviceIds: string[]): void {
    if (!from || !serviceIds?.length) return;
    const total = this.calcTotalDuration(serviceIds);
    if (total <= 0) return;
    const [hStr, mStr] = from.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return;
    const endMin = h * 60 + m + total;
    const endH = Math.floor(endMin / 60) % 24;
    const endM = endMin % 60;
    const toTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    this.form.get('toTime')?.setValue(toTime, { emitEvent: false });
    this.totalDuration.set(total);
    this.cdr.markForCheck();
  }

  private recalculate(): void {
    const ids: string[] = this.form?.get('serviceIds')?.value ?? [];
    const allServices = this.services();
    let price = 0;
    let duration = 0;
    for (const id of ids) {
      const svc = allServices.find(s => s._id === id);
      if (svc) {
        price += svc.price ?? 0;
        duration += svc.duration ?? 0;
      }
    }
    this.totalPrice.set(price);
    this.totalDuration.set(duration);
    this.cdr.markForCheck();
  }

  private calcTotalDuration(serviceIds: string[]): number {
    const allServices = this.services();
    return serviceIds.reduce((sum, id) => {
      const svc = allServices.find(s => s._id === id);
      return sum + (svc?.duration ?? 0);
    }, 0);
  }

  private buildPayload(): Record<string, unknown> {
    const v = this.form.getRawValue();
    const startISO = new Date(`${v.startDate}T${v.fromTime}`).toISOString();
    const endISO = new Date(`${v.startDate}T${v.toTime}`).toISOString();
    const durationMin = this.calcTotalDuration(v.serviceIds) ||
      (() => {
        const [fh, fm] = v.fromTime.split(':').map(Number);
        const [th, tm] = v.toTime.split(':').map(Number);
        return (th * 60 + tm) - (fh * 60 + fm);
      })();

    const payload: Record<string, unknown> = {
      client: v.clientId || undefined,
      department: v.departmentId || undefined,
      employee: v.employeeId || undefined,
      services: v.serviceIds,
      startDate: startISO,
      endDate: endISO,
      duration: durationMin,
      comment: v.comment || undefined,
    };
    if (this.isEditMode) {
      payload['status'] = v.status;
    }
    return payload;
  }
}


