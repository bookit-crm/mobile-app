import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  computed, DestroyRef, inject, Input, OnInit, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule, ModalController } from '@ionic/angular';
import { combineLatest, Observable, of, Subject, switchMap, take } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

import { IAppointment, AppointmentStatus, IService, IConsumableProduct } from '@core/models/appointment.interface';
import { IEmployee } from '@core/models/employee.interface';
import { IDepartment } from '@core/models/department.interface';
import { IClient } from '@core/models/client.interface';
import { IProduct } from '@core/models/product.interface';
import { IPromoCode } from '@core/models/promo-code.interface';
import { IConsumableStockWarning } from '@core/models/service.interface';
import { EUserRole } from '@core/enums/e-user-role';

import { AppointmentsService } from '@core/services/appointments.service';
import { ClientsService } from '@core/services/clients.service';
import { DepartmentService } from '@core/services/department.service';
import { EmployeeService } from '@core/services/employee.service';
import { ServicesService } from '@core/services/services.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { ProductsService } from '@core/services/products.service';
import { PromoCodesService } from '@core/services/promo-codes.service';
import { DateFnsHelper } from '@core/helpers/date-fns.helper';
import { AppointmentDayScrollerComponent } from '@core/components/appointment-day-scroller/appointment-day-scroller.component';
import { AppointmentSlotGridComponent, ISlotSelection } from '@core/components/appointment-slot-grid/appointment-slot-grid.component';

export interface IAppointmentModalPayload {
  _id?: string;          // если задан → edit mode
  department?: string;
  employee?: string;
  clientId?: string;     // если задан → клиент предзаполняется
  startDate?: string;    // YYYY-MM-DD
  from?: string;         // HH:mm
}

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule,
    AppointmentDayScrollerComponent, AppointmentSlotGridComponent],
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
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly productsService = inject(ProductsService);
  private readonly promoCodesService = inject(PromoCodesService);

  public readonly AppointmentStatus = AppointmentStatus;

  public readonly isManager = computed(
    () => this.supervisorService.authUserSignal()?.role === EUserRole.MANAGER,
  );

  /** true если работаем с одним департаментом (manager или single-location план) */
  public readonly singleDepartmentMode = computed(
    () => this.supervisorService.singleDepartmentMode(),
  );

  private readonly managerDepartmentId = computed(() => {
    const dept = this.supervisorService.authUserSignal()?.department;
    if (!dept) return '';
    return typeof dept === 'string' ? dept : dept._id;
  });

  /** Подписка разрешает прикрепление товаров к записи */
  public readonly canUseProducts = computed(() =>
    this.subscriptionService.hasFeature('productsAttachToAppointment'),
  );

  /** Подписка разрешает промокоды */
  public readonly canUsePromoCodes = computed(() =>
    this.subscriptionService.hasFeature('promoCodes'),
  );

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

  /** Предупреждения о нехватке склад-товаров для выбранных услуг */
  public stockWarnings = signal<IConsumableStockWarning[]>([]);

  /** Опции продуктов для селекта (value = _id, display = name (unit)) */
  public productOptions = signal<{ value: string; display: string }[]>([]);
  public productsMap = signal<Map<string, IProduct>>(new Map());
  public promoCodeOptions = signal<IPromoCode[]>([]);

  public clientSearch = '';
  /** Signal-зеркало имени выбранного клиента — нужно для реактивного summaryText */
  public selectedClientNameSignal = signal<string>('');
  public totalPrice = signal(0);
  public servicesPrice = signal(0);
  public productsPrice = signal(0);
  public discountAmount = signal(0);
  public totalDuration = signal(0); // минут

  /** Edit-mode signals — зеркала полей формы для реактивного summaryText */
  public editEmployeeIdSignal = signal<string>('');
  public editStartDateSignal  = signal<string>('');
  public editFromTimeSignal   = signal<string>('');
  public editToTimeSignal     = signal<string>('');

  /** Сводка визита: Клиент · Услуги · Сотрудник · Дата */
  public readonly summaryText = computed<string>(() => {
    const parts: string[] = [];

    const clientName = this.selectedClientNameSignal();
    if (clientName) parts.push(clientName);

    const ids = this.selectedServiceIds();
    const allServices = this.services();
    const svcNames = ids
      .map(id => allServices.find(s => s._id === id)?.name)
      .filter((n): n is string => !!n);
    if (svcNames.length) parts.push(svcNames.join(', '));

    const slot = this.selectedSlot();
    if (slot) {
      // create mode — берём из выбранного слота
      parts.push(`${slot.employee.firstName} ${slot.employee.lastName}`);
      const date = this.selectedDate();
      try {
        const d = new Date(date + 'T00:00:00');
        const day = d.getDate();
        const month = d.toLocaleString('en', { month: 'short' });
        parts.push(`${day} ${month}, ${slot.startTime}–${slot.endTime}`);
      } catch {
        parts.push(`${slot.startTime}–${slot.endTime}`);
      }
    } else if (this.isEditMode && this.form) {
      // edit mode — берём из сигналов-зеркал формы
      const empId = this.editEmployeeIdSignal();
      if (empId) {
        const emp = this.employees().find(e => e._id === empId);
        if (emp) parts.push(`${emp.firstName} ${emp.lastName}`);
      }
      const startDate = this.editStartDateSignal();
      const fromTime  = this.editFromTimeSignal();
      const toTime    = this.editToTimeSignal();
      if (startDate && fromTime) {
        try {
          const d = new Date(startDate + 'T00:00:00');
          const day   = d.getDate();
          const month = d.toLocaleString('en', { month: 'short' });
          const range = toTime ? `${fromTime}–${toTime}` : fromTime;
          parts.push(`${day} ${month}, ${range}`);
        } catch {
          if (toTime) parts.push(`${fromTime}–${toTime}`);
        }
      }
    }

    return parts.join(' · ');
  });

  // ── Client pagination state ──────────────────────────────────────────────
  private readonly paginationLimit = 25;
  private clientsOffset = 0;
  public hasMoreClients = true;
  private isLoadingClients = false;
  private readonly clientSearch$ = new Subject<string>();

  // ── Create-mode slot flow ─────────────────────────────────────────────────
  /** Selected date in create mode (YYYY-MM-DD) */
  public selectedDate = signal<string>(DateFnsHelper.getCurrentDate());
  /** Selected employee + time slot */
  public selectedSlot = signal<ISlotSelection | null>(null);
  /** Current departmentId signal for slot grid reactivity */
  public currentDepartmentId = signal<string | null>(null);
  /** Signal-зеркало выбранных услуг — нужно для реактивного computed slotDuration */
  public selectedServiceIds = signal<string[]>([]);
  /** Computed total duration for slot grid (реактивен через selectedServiceIds) */
  public readonly slotDuration = computed<number>(() => {
    const ids = this.selectedServiceIds();
    const allServices = this.services();
    const total = ids.reduce((sum, id) => {
      const svc = allServices.find(s => s._id === id);
      return sum + (svc?.duration ?? 0);
    }, 0);
    return total || 30;
  });
  /** Show extras section (promo, products, notes) */
  public showExtras = signal(false);

  public readonly statusOptions = [
    { value: AppointmentStatus.New, label: 'New' },
    { value: AppointmentStatus.Completed, label: 'Completed' },
    { value: AppointmentStatus.Canceled, label: 'Canceled' },
  ];

  get consumableProductsArray(): FormArray {
    return this.form?.get('consumableProducts') as FormArray;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.isEditMode = !!this.payload?._id;
    this.isLoading.set(true);
    this.setupClientSearch();

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
      this.form.get('clientName')?.enable();
      this.form.get('clientEmail')?.enable();
      this.form.get('clientPhone')?.enable();
    } else {
      this.form.get('clientId')?.setValidators([Validators.required]);
      this.form.get('clientName')?.clearValidators();
      this.form.get('clientPhone')?.clearValidators();
      this.form.get('clientName')?.disable();
      this.form.get('clientEmail')?.disable();
      this.form.get('clientPhone')?.disable();
    }
    this.form.get('clientId')?.updateValueAndValidity();
    this.form.get('clientName')?.updateValueAndValidity();
    this.form.get('clientPhone')?.updateValueAndValidity();
  }

  /** Серверный поиск клиентов с debounce */
  public onClientSearch(term: string): void {
    this.clientSearch = term;
    this.clientSearch$.next(term);
  }

  /** Подгрузить ещё клиентов (для infinite scroll) */
  public loadMoreClients(): void {
    if (!this.hasMoreClients || this.isLoadingClients) return;
    this.loadClients();
  }

  public filterClients(search: string): void {
    this.onClientSearch(search);
  }

  public selectClient(client: IClient): void {
    this.form.get('clientId')?.setValue(client._id);
    this.clientSearch = client.fullName;
    this.selectedClientNameSignal.set(client.fullName);
    this.cdr.markForCheck();
  }

  public clearClient(): void {
    this.form.get('clientId')?.setValue('');
    this.clientSearch = '';
    this.selectedClientNameSignal.set('');
    this.filteredClients.set(this.clients());
    this.cdr.markForCheck();
  }

  public isClientSelected(id: string): boolean {
    return this.form.get('clientId')?.value === id;
  }

  public onDepartmentChange(deptId: string): void {
    this.form.get('employeeId')?.setValue('');
    this.form.get('serviceIds')?.setValue([]);
    this.form.get('promoCode')?.setValue(null);
    this.consumableProductsArray?.clear();
    this.employees.set([]);
    this.services.set([]);
    this.productOptions.set([]);
    this.productsMap.set(new Map());
    this.promoCodeOptions.set([]);
    this.totalPrice.set(0);
    this.totalDuration.set(0);
    this.selectedSlot.set(null);
    this.selectedServiceIds.set([]); // сброс signal при смене департамента
    this.currentDepartmentId.set(deptId || null);
    if (deptId) {
      this.loadEmployeesAndServices(deptId);
    }
  }

  public onDateChange(date: string): void {
    this.selectedDate.set(date);
    this.selectedSlot.set(null);
    this.form.get('fromTime')?.setValue('');
    this.form.get('toTime')?.setValue('');
    this.form.get('employeeId')?.setValue('');
  }

  public onSlotSelected(slot: ISlotSelection): void {
    this.selectedSlot.set(slot);
    this.form.get('employeeId')?.setValue(slot.employeeId);
    this.form.get('fromTime')?.setValue(slot.startTime);
    this.form.get('toTime')?.setValue(slot.endTime);
  }

  public toggleExtras(): void {
    this.showExtras.update(v => !v);
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
    this.selectedServiceIds.set(current); // обновляем signal → slotDuration пересчитается
    this.selectedSlot.set(null);          // сбрасываем слот т.к. изменилась длительность
    this.recalculate();
  }

  public isServiceSelected(id: string): boolean {
    return (this.form.get('serviceIds')?.value ?? []).includes(id);
  }

  public onServicesChange(): void {
    this.recalculate();
  }

  public addConsumableProduct(): void {
    this.consumableProductsArray.push(
      this.fb.group({
        product: new FormControl<string | null>(null, [Validators.required]),
        quantity: new FormControl<number>(1, [Validators.required, Validators.min(0.01)]),
      }),
    );
    this.cdr.detectChanges();
  }

  public removeConsumableProduct(index: number): void {
    this.consumableProductsArray.removeAt(index);
    this.recalculate();
    this.cdr.detectChanges();
  }

  public onProductChange(): void {
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
          email: this.form.value.clientEmail || undefined,
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

  public getSelectedClient(): IClient | null {
    const id = this.form?.get('clientId')?.value;
    if (!id) return null;
    return this.clients().find(c => c._id === id) ?? null;
  }

  // ── Client avatar helpers ─────────────────────────────────────────────────
  private static readonly AVATAR_COLORS = [
    '#C8B6FF','#B8E0D2','#FFD6A5','#FFADAD','#A0C4FF',
    '#CAFFBF','#FFC6FF','#BDB2FF','#9BF6FF','#F1C0E8',
  ];

  public getClientInitials(client: IClient): string {
    if (!client?.fullName) return '?';
    const parts = client.fullName.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  public getClientAvatarColor(client: IClient): string {
    const name = client?.fullName ?? '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = AppointmentModalComponent.AVATAR_COLORS;
    return colors[Math.abs(hash) % colors.length];
  }

  // ── Service helpers ───────────────────────────────────────────────────────
  public getServiceName(id: string): string {
    return this.services().find(s => s._id === id)?.name ?? id;
  }

  public getProductDisplay(productId: string): string {
    const p = this.productsMap().get(productId);
    return p ? `${p.name} (${p.unit})` : productId;
  }

  public formatDuration(minutes: number): string {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : `${m}min`;
  }

  // ── DateTime picker helpers ───────────────────────────────────────────────
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
    const defaultDeptId = this.singleDepartmentMode()
      ? (this.supervisorService.effectiveDepartmentId() ?? this.managerDepartmentId())
      : (this.payload?.department ?? '');

    // Sync create-mode date signal with payload/today
    if (!apt && this.payload?.startDate) {
      this.selectedDate.set(this.payload.startDate);
    }
    // Sync currentDepartmentId signal
    const initDeptId = apt
      ? (typeof apt.department === 'string' ? apt.department : apt.department?._id) ?? defaultDeptId
      : defaultDeptId;
    this.currentDepartmentId.set(initDeptId || null);

    const consumableControls = (apt?.consumableProducts || []).map(
      (item: IConsumableProduct) => this.fb.group({
        product: new FormControl<string>(
          typeof item.product === 'string' ? item.product : (item.product as any)._id,
          [Validators.required],
        ),
        quantity: new FormControl<number>(item.quantity, [Validators.required, Validators.min(0.01)]),
      }),
    );

    this.form = this.fb.group({
      clientId: [apt?.client?._id ?? this.payload?.clientId ?? '', Validators.required],
      clientName: [{ value: '', disabled: true }],
      clientEmail: [{ value: '', disabled: true }, [Validators.email]],
      clientPhone: [{ value: '', disabled: true }],
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
      consumableProducts: new FormArray(consumableControls),
      promoCode: [apt?.promoCode
        ? (typeof apt.promoCode === 'string' ? apt.promoCode : apt.promoCode._id)
        : null],
    });

    // инициализируем signal-зеркало выбранных услуг
    const initIds: string[] = this.form.get('serviceIds')?.value ?? [];
    this.selectedServiceIds.set(initIds);

    // auto-recalculate end time on service/time change
    combineLatest([
      this.form.get('fromTime')!.valueChanges.pipe(startWith(this.form.value.fromTime)),
      this.form.get('serviceIds')!.valueChanges.pipe(startWith(this.form.value.serviceIds)),
    ])
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(([from, ids]) => this.autoCalcEndTime(from, ids));

    // watch consumableProducts + promoCode changes for price recalc
    combineLatest([
      this.form.get('consumableProducts')!.valueChanges.pipe(startWith(this.form.get('consumableProducts')!.value)),
      this.form.get('promoCode')!.valueChanges.pipe(startWith(this.form.value.promoCode)),
    ])
      .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculate());

    // sync edit-mode signals for summaryText reactivity
    if (this.isEditMode) {
      this.editEmployeeIdSignal.set(this.form.value.employeeId ?? '');
      this.editStartDateSignal.set(this.form.value.startDate ?? '');
      this.editFromTimeSignal.set(this.form.value.fromTime ?? '');
      this.editToTimeSignal.set(this.form.value.toTime ?? '');

      this.form.get('employeeId')!.valueChanges
        .pipe(startWith(this.form.value.employeeId), takeUntilDestroyed(this.destroyRef))
        .subscribe(v => this.editEmployeeIdSignal.set(v ?? ''));
      this.form.get('startDate')!.valueChanges
        .pipe(startWith(this.form.value.startDate), takeUntilDestroyed(this.destroyRef))
        .subscribe(v => this.editStartDateSignal.set(v ?? ''));
      this.form.get('fromTime')!.valueChanges
        .pipe(startWith(this.form.value.fromTime), takeUntilDestroyed(this.destroyRef))
        .subscribe(v => this.editFromTimeSignal.set(v ?? ''));
      this.form.get('toTime')!.valueChanges
        .pipe(startWith(this.form.value.toTime), takeUntilDestroyed(this.destroyRef))
        .subscribe(v => this.editToTimeSignal.set(v ?? ''));
    }

    // watch services for stock warnings
    this.watchServicesForStockCheck();

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
          if (!this.singleDepartmentMode()) this.loadDepartments();
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => { this.isLoading.set(false); this.cdr.markForCheck(); },
      });
  }

  private loadInitialData(): void {
    this.loadClients();
    if (!this.singleDepartmentMode()) {
      this.loadDepartments();
    }
    const deptId = this.singleDepartmentMode()
      ? (this.supervisorService.effectiveDepartmentId() ?? this.managerDepartmentId())
      : (this.payload?.department ?? '');
    if (deptId) {
      this.loadEmployeesAndServices(deptId);
    }
    this.isLoading.set(false);
    this.cdr.markForCheck();
  }

  private setupClientSearch(): void {
    this.clientSearch$
      .pipe(
        debounceTime(300),
        switchMap((term) => {
          this.clientsOffset = 0;
          this.hasMoreClients = true;
          this.isLoadingClients = true;
          this.clients.set([]);
          this.filteredClients.set([]);
          return this.clientsService.getClients({
            offset: 0,
            limit: this.paginationLimit,
            ...(term ? { search: term } : {}),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        const incoming = res.results || [];
        this.clients.set(incoming);
        this.filteredClients.set(incoming);
        this.clientsOffset = incoming.length;
        this.hasMoreClients = this.clientsOffset < (res.count || 0);
        this.isLoadingClients = false;
        this.cdr.markForCheck();
      });
  }

  private loadClients(): void {
    if (this.isLoadingClients) return;
    this.isLoadingClients = true;

    this.clientsService
      .getClients({ offset: this.clientsOffset, limit: this.paginationLimit })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        const incoming = res.results || [];
        if (this.clientsOffset === 0) {
          this.clients.set(incoming);
          this.filteredClients.set(incoming);
        } else {
          this.clients.update(prev => [...prev, ...incoming]);
          this.filteredClients.update(prev => [...prev, ...incoming]);
        }
        this.clientsOffset += incoming.length;
        this.hasMoreClients = this.clientsOffset < (res.count || 0);
        this.isLoadingClients = false;
        this.ensurePreselectedClientPresent();
        // pre-fill search field with pre-selected client name
        const clientId = this.form?.get('clientId')?.value;
        if (clientId && this.clientsOffset <= this.paginationLimit) {
          const found = this.clients().find(c => c._id === clientId);
          if (found) {
            this.clientSearch = found.fullName;
            this.selectedClientNameSignal.set(found.fullName);
          }
        }
        this.cdr.markForCheck();
      });
  }

  /** Если preselected client не попал в первую страницу — загружаем его отдельно */
  private ensurePreselectedClientPresent(): void {
    const preselectedId = this.payload?.clientId;
    if (!preselectedId) return;
    const exists = this.clients().some(c => c._id === preselectedId);
    if (exists) return;
    this.clientsService
      .getClientById(preselectedId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((client) => {
        if (!client) return;
        this.clients.update(prev =>
          prev.some(c => c._id === client._id) ? prev : [client, ...prev],
        );
        this.filteredClients.update(prev =>
          prev.some(c => c._id === client._id) ? prev : [client, ...prev],
        );
        this.clientSearch = client.fullName;
        this.selectedClientNameSignal.set(client.fullName);
        this.cdr.markForCheck();
      });
  }

  /** Наблюдает за выбором услуг и проверяет остатки на складе */
  private watchServicesForStockCheck(): void {
    const servicesCtrl = this.form?.get('serviceIds');
    if (!servicesCtrl) return;

    servicesCtrl.valueChanges
      .pipe(
        startWith(servicesCtrl.value),
        debounceTime(300),
        switchMap((ids: string[]) => {
          const validIds = (ids ?? []).filter(Boolean);
          if (!validIds.length) {
            this.stockWarnings.set([]);
            return of([] as IConsumableStockWarning[]);
          }
          return this.servicesService.checkConsumablesStock(validIds);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((warnings) => {
        this.stockWarnings.set(warnings);
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

    if (this.canUseProducts()) {
      this.productsService
        .getProducts({ departmentId: deptId, status: 'active', limit: 100 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe((res) => {
          const products = res.results || [];
          this.productOptions.set(products.map(p => ({ value: p._id, display: `${p.name} (${p.unit})` })));
          const map = new Map<string, IProduct>();
          products.forEach(p => map.set(p._id, p));
          this.productsMap.set(map);
          this.recalculate();
          this.cdr.markForCheck();
        });
    }

    if (this.canUsePromoCodes()) {
      this.promoCodesService
        .getActiveForDepartment(deptId)
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe((res) => {
          this.promoCodeOptions.set(res.results || []);
          this.recalculate(); // пересчитываем после загрузки, чтобы применилась скидка
          this.cdr.markForCheck();
        });
    }
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
    let svcPrice = 0;
    let duration = 0;
    for (const id of ids) {
      const svc = allServices.find(s => s._id === id);
      if (svc) {
        svcPrice += svc.price ?? 0;
        duration += svc.duration ?? 0;
      }
    }
    this.servicesPrice.set(svcPrice);
    this.totalDuration.set(duration);

    // Products price
    let prodPrice = 0;
    const consumables: { product: string; quantity: number }[] =
      this.consumableProductsArray?.value ?? [];
    const pMap = this.productsMap();
    for (const cp of consumables) {
      const product = cp.product ? pMap.get(cp.product) : null;
      if (product) {
        prodPrice += product.salePrice * (+cp.quantity || 0);
      }
    }
    this.productsPrice.set(prodPrice);

    // Promo code discount
    let discount = 0;
    const selectedPromoId: string | null = this.form?.get('promoCode')?.value ?? null;
    if (selectedPromoId) {
      const promoCode = this.promoCodeOptions().find(pc => pc._id === selectedPromoId);
      if (promoCode?.services?.length) {
        for (const pcSvc of promoCode.services) {
          const pcSvcId = typeof pcSvc.service === 'string' ? pcSvc.service : (pcSvc.service as any)._id;
          if (!ids.includes(pcSvcId)) continue;
          const svc = allServices.find(s => s._id === pcSvcId);
          const svcPrice = svc?.price ?? 0;
          if (pcSvc.discountType === 'percentage') {
            discount += (svcPrice * pcSvc.discountValue) / 100;
          } else {
            discount += Math.min(pcSvc.discountValue, svcPrice);
          }
        }
      }
    }
    this.discountAmount.set(Math.round(discount * 100) / 100);
    this.totalPrice.set(Math.max(svcPrice + prodPrice - discount, 0));
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

    // Строим ISO через явное задание компонентов, чтобы избежать
    // нестабильного поведения new Date('YYYY-MM-DDTHH:mm') в старых WebView
    const buildISO = (dateStr: string, timeStr: string): string => {
      const [y, mo, day] = dateStr.split('-').map(Number);
      const [h, m] = timeStr.split(':').map(Number);
      return new Date(y, mo - 1, day, h, m, 0, 0).toISOString();
    };

    const startISO = buildISO(v.startDate, v.fromTime);
    const endISO   = buildISO(v.startDate, v.toTime);
    const durationMin = this.calcTotalDuration(v.serviceIds) ||
      (() => {
        const [fh, fm] = v.fromTime.split(':').map(Number);
        const [th, tm] = v.toTime.split(':').map(Number);
        return (th * 60 + tm) - (fh * 60 + fm);
      })();

    const consumableProducts = (v.consumableProducts ?? [])
      .filter((cp: { product: string; quantity: number }) => cp.product)
      .map((cp: { product: string; quantity: number }) => ({
        product: cp.product,
        quantity: +cp.quantity,
      }));

    const payload: Record<string, unknown> = {
      client: v.clientId || undefined,
      department: v.departmentId || undefined,
      employee: v.employeeId || undefined,
      services: v.serviceIds,
      startDate: startISO,
      endDate: endISO,
      duration: durationMin,
      comment: v.comment || undefined,
      consumableProducts,
      promoCode: v.promoCode || null,
    };
    if (this.isEditMode) {
      payload['status'] = v.status;
    }
    return payload;
  }
}

