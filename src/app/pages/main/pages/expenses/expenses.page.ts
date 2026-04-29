import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { debounceTime, Subject, take } from 'rxjs';

import { IExpense } from '@core/models/expense.interface';
import { EExpenseCategory, EExpenseRecurrence, EExpenseStatus } from '@core/enums/e-expense';
import { IKeyValuePair } from '@core/models/application.interface';
import { ExpensesService } from '@core/services/expenses.service';
import { DepartmentService } from '@core/services/department.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { ExpenseFormModalComponent } from './components/expense-form-modal/expense-form-modal.component';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.page.html',
  styleUrls: ['./expenses.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesPage implements OnInit {
  private readonly expensesService = inject(ExpensesService);
  private readonly departmentService = inject(DepartmentService);
  private readonly supervisorService = inject(SupervisorService);
  public readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── Feature gate ─────────────────────────────────────────────────────────
  public readonly hasExpensesFeature = computed(() =>
    this.subscriptionService.hasFeature('expensesPayroll'),
  );

  // ── Permissions ──────────────────────────────────────────────────────────
  public readonly singleDepartmentMode = computed(() => this.supervisorService.singleDepartmentMode());
  public readonly departments = computed(() => this.departmentService.departmentsSignal()?.results ?? []);

  // ── List state ───────────────────────────────────────────────────────────
  public expenses = signal<IExpense[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public offset = signal(0);
  public hasMore = signal(true);

  private readonly LIMIT = 25;

  // ── Filters ──────────────────────────────────────────────────────────────
  public searchQuery = signal('');
  public showFilterSheet = signal(false);

  // temp filter state (sheet)
  public tempCategory = signal<EExpenseCategory | ''>('');
  public tempStatus = signal<EExpenseStatus | ''>('');
  public tempRecurrence = signal<EExpenseRecurrence | ''>('');
  public tempDepartmentId = signal('');
  public tempDateFrom = signal('');
  public tempDateTo = signal('');

  // applied filter state
  public filterCategory = signal<EExpenseCategory | ''>('');
  public filterStatus = signal<EExpenseStatus | ''>('');
  public filterRecurrence = signal<EExpenseRecurrence | ''>('');
  public filterDepartmentId = signal('');
  public filterDateFrom = signal('');
  public filterDateTo = signal('');

  public readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (this.filterCategory()) n++;
    if (this.filterStatus()) n++;
    if (this.filterRecurrence()) n++;
    if (this.filterDepartmentId()) n++;
    if (this.filterDateFrom() || this.filterDateTo()) n++;
    return n;
  });

  private readonly search$ = new Subject<string>();

  // ── Label options ─────────────────────────────────────────────────────────
  public readonly categoryOptions: IKeyValuePair[] = Object.values(EExpenseCategory).map((v) => ({
    value: v, display: this.categoryLabel(v),
  }));
  public readonly statusOptions: IKeyValuePair[] = Object.values(EExpenseStatus).map((v) => ({
    value: v, display: this.statusLabel(v),
  }));
  public readonly recurrenceOptions: IKeyValuePair[] = Object.values(EExpenseRecurrence).map((v) => ({
    value: v, display: this.recurrenceLabel(v),
  }));

  ngOnInit(): void {
    if (!this.singleDepartmentMode()) {
      this.loadDepartmentsIfNeeded();
    }

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetAndLoad());
  }

  ionViewWillEnter(): void {
    this.resetAndLoad();
  }

  // ── Search ────────────────────────────────────────────────────────────────
  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  // ── Filter sheet ──────────────────────────────────────────────────────────
  public openFilterSheet(): void {
    this.tempCategory.set(this.filterCategory());
    this.tempStatus.set(this.filterStatus());
    this.tempRecurrence.set(this.filterRecurrence());
    this.tempDepartmentId.set(this.filterDepartmentId());
    this.tempDateFrom.set(this.filterDateFrom());
    this.tempDateTo.set(this.filterDateTo());
    this.showFilterSheet.set(true);
  }

  public applyFilters(): void {
    this.filterCategory.set(this.tempCategory());
    this.filterStatus.set(this.tempStatus());
    this.filterRecurrence.set(this.tempRecurrence());
    this.filterDepartmentId.set(this.tempDepartmentId());
    this.filterDateFrom.set(this.tempDateFrom());
    this.filterDateTo.set(this.tempDateTo());
    this.showFilterSheet.set(false);
    this.resetAndLoad();
  }

  public resetFilters(): void {
    this.tempCategory.set('');
    this.tempStatus.set('');
    this.tempRecurrence.set('');
    this.tempDepartmentId.set('');
    this.tempDateFrom.set('');
    this.tempDateTo.set('');
    this.filterCategory.set('');
    this.filterStatus.set('');
    this.filterRecurrence.set('');
    this.filterDepartmentId.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.showFilterSheet.set(false);
    this.resetAndLoad();
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  public async openAddExpense(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ExpenseFormModalComponent,
      componentProps: { expense: null },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<boolean>();
    if (data) this.resetAndLoad();
  }

  public async openEditExpense(expense: IExpense, event: Event): Promise<void> {
    event.stopPropagation();
    this.expensesService.getExpenseById(expense._id).pipe(take(1)).subscribe(async (full) => {
      const modal = await this.modalCtrl.create({
        component: ExpenseFormModalComponent,
        componentProps: { expense: full },
      });
      await modal.present();
      const { data } = await modal.onWillDismiss<boolean>();
      if (data) this.resetAndLoad();
    });
  }

  public async confirmDeleteExpense(expense: IExpense, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete Expense',
      message: `Delete "${expense.title}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => this.deleteExpense(expense._id) },
      ],
    });
    await alert.present();
  }

  // ── Infinite scroll ───────────────────────────────────────────────────────
  public onInfiniteScroll(event: Event): void {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    this.offset.update((o) => o + this.LIMIT);
    this.loadExpenses(false, event as CustomEvent & { target: { complete: () => void } });
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  public getDeptName(exp: IExpense): string {
    const dept = exp.department;
    if (!dept) return '—';
    return typeof dept === 'string' ? dept : dept.name;
  }

  public statusColor(status: EExpenseStatus): string {
    if (status === EExpenseStatus.Approved) return 'success';
    if (status === EExpenseStatus.Rejected) return 'danger';
    return 'warning';
  }

  public categoryLabel(val: EExpenseCategory | string): string {
    const labels: Record<string, string> = {
      rent: 'Rent', salary: 'Salary', commission: 'Commission', utilities: 'Utilities',
      inventory: 'Inventory', equipment: 'Equipment', marketing: 'Marketing',
      software: 'Software', maintenance: 'Maintenance', tax: 'Tax',
      insurance: 'Insurance', training: 'Training', other: 'Other',
    };
    return labels[val] ?? val;
  }

  public statusLabel(val: EExpenseStatus | string): string {
    const labels: Record<string, string> = {
      pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    };
    return labels[val] ?? val;
  }

  public recurrenceLabel(val: EExpenseRecurrence | string): string {
    const labels: Record<string, string> = {
      one_time: 'One time', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
    };
    return labels[val] ?? val;
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private resetAndLoad(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.expenses.set([]);
    this.loadExpenses(true);
  }

  private loadExpenses(
    reset = false,
    scrollEvent?: CustomEvent & { target: { complete: () => void } },
  ): void {
    this.isLoading.set(true);

    const filters: Record<string, unknown> = {
      limit: this.LIMIT,
      offset: this.offset(),
    };
    if (this.searchQuery()) filters['search'] = this.searchQuery();
    if (this.filterCategory()) filters['category'] = this.filterCategory();
    if (this.filterStatus()) filters['status'] = this.filterStatus();
    if (this.filterRecurrence()) filters['recurrence'] = this.filterRecurrence();
    if (this.filterDateFrom()) filters['dateFrom'] = this.filterDateFrom();
    if (this.filterDateTo()) filters['dateTo'] = this.filterDateTo();

    // Department
    if (this.singleDepartmentMode()) {
      const deptId = this.supervisorService.effectiveDepartmentId();
      if (deptId) filters['departmentId'] = deptId;
    } else if (this.filterDepartmentId()) {
      filters['departmentId'] = this.filterDepartmentId();
    }

    this.expensesService
      .getExpenses(filters as Parameters<typeof this.expensesService.getExpenses>[0])
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const incoming = res.results ?? [];
          this.expenses.update((cur) => (reset ? incoming : [...cur, ...incoming]));
          this.totalCount.set(res.count);
          this.hasMore.set(this.expenses().length < res.count);
          this.isLoading.set(false);
          scrollEvent?.target.complete();
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          scrollEvent?.target.complete();
          this.cdr.markForCheck();
        },
      });
  }

  private deleteExpense(id: string): void {
    this.expensesService.deleteExpense(id).pipe(take(1)).subscribe({
      next: async () => {
        this.resetAndLoad();
        const toast = await this.toastCtrl.create({ message: 'Expense deleted', duration: 2000, color: 'success' });
        await toast.present();
      },
    });
  }

  private loadDepartmentsIfNeeded(): void {
    if (!this.departmentService.departmentsSignal()) {
      this.departmentService.getDepartments({ limit: 50 })
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }
}
