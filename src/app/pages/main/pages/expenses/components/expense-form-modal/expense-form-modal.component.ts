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
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter, take } from 'rxjs';

import { IExpense } from '@core/models/expense.interface';
import { IEmployee } from '@core/models/employee.interface';
import { IProduct } from '@core/models/product.interface';
import { EExpenseCategory, EExpenseRecurrence, EExpenseStatus } from '@core/enums/e-expense';
import { IKeyValuePair } from '@core/models/application.interface';
import { ExpensesService } from '@core/services/expenses.service';
import { EmployeeService } from '@core/services/employee.service';
import { ProductsService } from '@core/services/products.service';
import { DepartmentService } from '@core/services/department.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { PaginatedResponseModel } from '@core/models/paginated-response.model';

@Component({
  selector: 'app-expense-form-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './expense-form-modal.component.html',
  styleUrls: ['./expense-form-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseFormModalComponent implements OnInit {
  @Input() expense: IExpense | null = null;

  private readonly expensesService = inject(ExpensesService);
  private readonly employeeService = inject(EmployeeService);
  private readonly productsService = inject(ProductsService);
  private readonly departmentService = inject(DepartmentService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  public isEditMode = false;
  public isSubmitting = false;

  public readonly singleDepartmentMode = this.supervisorService.singleDepartmentMode;

  public departments = this.departmentService.departmentsSignal;

  public employees = signal<(IEmployee & { fullName: string })[]>([]);
  public products = signal<IProduct[]>([]);

  private employeePage = 0;
  public employeeHasMore = true;
  private employeeLoading = false;
  private employeeDeptId: string | null = null;

  private productPage = 0;
  public productHasMore = true;
  private productLoading = false;
  private productDeptId: string | null = null;

  // ── Label options (getters for live translation) ──────────────────────────
  get categoryOptions(): IKeyValuePair[] {
    return Object.values(EExpenseCategory).map((v) => ({ value: v, display: this.categoryLabel(v) }));
  }
  get statusOptions(): IKeyValuePair[] {
    return Object.values(EExpenseStatus).map((v) => ({ value: v, display: this.statusLabel(v) }));
  }
  get recurrenceOptions(): IKeyValuePair[] {
    return Object.values(EExpenseRecurrence).map((v) => ({ value: v, display: this.recurrenceLabel(v) }));
  }

  public form!: FormGroup;

  get selectedCategory(): string | null {
    return this.form.get('category')?.value ?? null;
  }

  get hasDepartment(): boolean {
    if (this.singleDepartmentMode()) {
      return !!this.supervisorService.effectiveDepartmentId();
    }
    return !!this.form.get('department')?.value;
  }

  get showEmployeeField(): boolean {
    if (!this.hasDepartment) return false;
    const cat = this.form.get('category')?.value;
    return [EExpenseCategory.Salary, EExpenseCategory.Commission, EExpenseCategory.Training].includes(cat);
  }

  get showProductField(): boolean {
    if (!this.hasDepartment) return false;
    return this.form.get('category')?.value === EExpenseCategory.Inventory;
  }

  ngOnInit(): void {
    this.isEditMode = !!this.expense?._id;
    this.buildForm();

    // Load departments for non-single-dept mode
    if (!this.singleDepartmentMode() && !this.departments()) {
      this.departmentService.getDepartments({ limit: 100 }).pipe(take(1)).subscribe();
    }

    // Subscribe to department ctrl changes
    if (!this.singleDepartmentMode()) {
      this.form.get('department')!.valueChanges.pipe(
        distinctUntilChanged(),
        filter(Boolean),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((deptId: string) => {
        this.form.get('employee')?.reset();
        this.form.get('product')?.reset();
        this.loadEmployees(deptId, true);
        this.loadProducts(deptId, true);
      });
    }

    // Load employees/products for editing or single-dept
    const editDeptId = this.getEditDeptId();
    if (editDeptId) {
      this.loadEmployees(editDeptId, true);
      this.loadProducts(editDeptId, true);
    } else if (this.singleDepartmentMode()) {
      const deptId = this.supervisorService.effectiveDepartmentId();
      if (deptId) {
        this.loadEmployees(deptId, true);
        this.loadProducts(deptId, true);
      }
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

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const v = this.form.getRawValue() as Record<string, unknown>;

    // Normalize date → noon UTC
    const rawDate = v['date'] as string | null;
    let normalizedDate: string | null = null;
    if (rawDate) {
      const d = new Date(rawDate);
      normalizedDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)).toISOString();
    }

    const payload: Record<string, unknown> = {
      title: v['title'],
      amount: Number(v['amount']),
      category: v['category'],
      date: normalizedDate,
      status: v['status'] ?? EExpenseStatus.Approved,
      recurrence: v['recurrence'] ?? EExpenseRecurrence.OneTime,
      description: v['description'] || null,
    };

    // Department
    if (this.singleDepartmentMode()) {
      payload['department'] = this.supervisorService.effectiveDepartmentId();
    } else {
      payload['department'] = v['department'];
    }

    // Optional employee
    if (this.showEmployeeField && v['employee']) {
      payload['employee'] = v['employee'];
    }

    // Optional product
    if (this.showProductField && v['product']) {
      payload['product'] = v['product'];
    }

    const call$ = this.isEditMode && this.expense?._id
      ? this.expensesService.updateExpense(this.expense._id, payload)
      : this.expensesService.createExpense(payload);

    call$.pipe(take(1)).subscribe({
      next: async () => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
        const toast = await this.toastCtrl.create({
          message: this.t.instant(this.isEditMode ? 'EXP_UPDATED' : 'EXP_CREATED_OK'),
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
          message: this.t.instant('ERROR_OCCURRED'),
          duration: 3000,
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  public onCategoryChange(): void {
    // Reset employee/product when category changes
    this.form.get('employee')?.reset();
    this.form.get('product')?.reset();
    this.cdr.markForCheck();
  }

  public loadMoreEmployees(): void {
    if (this.employeeDeptId) {
      this.loadEmployees(this.employeeDeptId, false);
    }
  }

  public loadMoreProducts(): void {
    if (this.productDeptId) {
      this.loadProducts(this.productDeptId, false);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildForm(): void {
    const exp = this.expense;

    const deptId = exp?.department
      ? (typeof exp.department === 'object' ? exp.department._id : exp.department)
      : null;

    const empId = exp?.employee
      ? (typeof exp.employee === 'object' ? exp.employee._id : exp.employee)
      : null;

    const prodId = exp?.product
      ? (typeof exp.product === 'object' ? exp.product._id : exp.product)
      : null;

    // Simple date string for ion-input[type=date]: "YYYY-MM-DD"
    const dateStr = exp?.date ? exp.date.substring(0, 10) : null;

    this.form = new FormGroup({
      title:      new FormControl(exp?.title ?? '',          [Validators.required]),
      amount:     new FormControl<number | null>(exp?.amount ?? null, [Validators.required, Validators.min(0)]),
      category:   new FormControl(exp?.category ?? null,     [Validators.required]),
      date:       new FormControl(dateStr,                    [Validators.required]),
      status:     new FormControl(exp?.status ?? EExpenseStatus.Approved),
      recurrence: new FormControl(exp?.recurrence ?? EExpenseRecurrence.OneTime),
      description: new FormControl(exp?.description ?? ''),
      department: new FormControl(deptId, this.singleDepartmentMode() ? [] : [Validators.required]),
      employee:   new FormControl(empId),
      product:    new FormControl(prodId),
    });
  }

  private getEditDeptId(): string | null {
    if (!this.isEditMode || !this.expense?.department) return null;
    const dept = this.expense.department;
    return typeof dept === 'object' ? dept._id : dept;
  }

  private loadEmployees(departmentId: string, reset: boolean): void {
    if (this.employeeLoading) return;
    if (!reset && !this.employeeHasMore) return;

    if (reset) {
      this.employeeDeptId = departmentId;
      this.employeePage = 0;
      this.employeeHasMore = true;
      this.employees.set([]);
    }

    this.employeeLoading = true;
    const limit = 25;
    const offset = this.employeePage * limit;

    this.employeeService
      .getEmployees({ departmentId, limit, offset })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp: PaginatedResponseModel<IEmployee>) => {
          const list = (resp?.results ?? []).map((e) => ({
            ...e,
            fullName: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
          }));
          this.employees.update((cur) => reset ? list : [...cur, ...list]);
          this.employeePage++;
          this.employeeHasMore = offset + limit < resp.count;
          this.employeeLoading = false;
          this.cdr.markForCheck();
        },
        error: () => { this.employeeLoading = false; },
      });
  }

  private loadProducts(departmentId: string, reset: boolean): void {
    if (this.productLoading) return;
    if (!reset && !this.productHasMore) return;

    if (reset) {
      this.productDeptId = departmentId;
      this.productPage = 0;
      this.productHasMore = true;
      this.products.set([]);
    }

    this.productLoading = true;
    const limit = 25;
    const offset = this.productPage * limit;

    this.productsService
      .getProducts({ departmentId, limit, offset })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.products.update((cur) => reset ? (resp?.results ?? []) : [...cur, ...(resp?.results ?? [])]);
          this.productPage++;
          this.productHasMore = offset + limit < resp.count;
          this.productLoading = false;
          this.cdr.markForCheck();
        },
        error: () => { this.productLoading = false; },
      });
  }

  // ── Label helpers ──────────────────────────────────────────────────────────

  public categoryLabel(val: EExpenseCategory | string): string {
    const map: Record<string, string> = {
      [EExpenseCategory.Rent]:        'EXP_CAT_RENT',
      [EExpenseCategory.Salary]:      'EXP_CAT_SALARY',
      [EExpenseCategory.Commission]:  'EXP_CAT_COMMISSION',
      [EExpenseCategory.Utilities]:   'EXP_CAT_UTILITIES',
      [EExpenseCategory.Inventory]:   'EXP_CAT_INVENTORY',
      [EExpenseCategory.Equipment]:   'EXP_CAT_EQUIPMENT',
      [EExpenseCategory.Marketing]:   'EXP_CAT_MARKETING',
      [EExpenseCategory.Software]:    'EXP_CAT_SOFTWARE',
      [EExpenseCategory.Maintenance]: 'EXP_CAT_MAINTENANCE',
      [EExpenseCategory.Tax]:         'EXP_CAT_TAX',
      [EExpenseCategory.Insurance]:   'EXP_CAT_INSURANCE',
      [EExpenseCategory.Training]:    'EXP_CAT_TRAINING',
      [EExpenseCategory.Other]:       'EXP_CAT_OTHER',
    };
    return map[val] ? this.t.instant(map[val]) : String(val);
  }

  public statusLabel(val: EExpenseStatus | string): string {
    const map: Record<string, string> = {
      [EExpenseStatus.Pending]:  'EXP_STATUS_PENDING',
      [EExpenseStatus.Approved]: 'EXP_STATUS_APPROVED',
      [EExpenseStatus.Rejected]: 'EXP_STATUS_REJECTED',
    };
    return map[val] ? this.t.instant(map[val]) : String(val);
  }

  public recurrenceLabel(val: EExpenseRecurrence | string): string {
    const map: Record<string, string> = {
      [EExpenseRecurrence.OneTime]: 'EXP_REC_ONE_TIME',
      [EExpenseRecurrence.Daily]:   'EXP_REC_DAILY',
      [EExpenseRecurrence.Weekly]:  'EXP_REC_WEEKLY',
      [EExpenseRecurrence.Monthly]: 'EXP_REC_MONTHLY',
      [EExpenseRecurrence.Yearly]:  'EXP_REC_YEARLY',
    };
    return map[val] ? this.t.instant(map[val]) : String(val);
  }

  public statusColor(status: EExpenseStatus): string {
    if (status === EExpenseStatus.Approved) return 'success';
    if (status === EExpenseStatus.Rejected) return 'danger';
    return 'warning';
  }
}


