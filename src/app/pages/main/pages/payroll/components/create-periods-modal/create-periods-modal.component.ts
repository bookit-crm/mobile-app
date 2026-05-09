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
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { take } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EUserRole } from '@core/enums/e-user-role';
import { IEmployee } from '@core/models/employee.interface';
import { ISupervisor } from '@core/models/supervisor.interface';
import { EmployeeService } from '@core/services/employee.service';
import { SupervisorService } from '@core/services/supervisor.service';
import { DepartmentService } from '@core/services/department.service';
import { PayrollService } from '@core/services/payroll.service';
import { SubscriptionService } from '@core/services/subscription.service';

interface IStaffOption {
  _id: string;
  fullName: string;
  avatar?: { url: string } | null;
  checked: boolean;
}

const PAGE_SIZE = 30;

@Component({
  selector: 'app-create-periods-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, TranslateModule],
  templateUrl: './create-periods-modal.component.html',
  styleUrls: ['./create-periods-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePeriodsModalComponent implements OnInit {
  @Input() month!: number;
  @Input() year!: number;

  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly employeeService = inject(EmployeeService);
  private readonly supervisorService = inject(SupervisorService);
  private readonly departmentService = inject(DepartmentService);
  private readonly payrollService = inject(PayrollService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly t = inject(TranslateService);

  public targetMonthLabel = '';
  public isLoading = signal(false);

  // Department selector
  public singleDepartmentMode = this.supervisorService.singleDepartmentMode();
  public isSoloPlan = this.subscriptionService.isSoloPlan();
  public selectedDepartmentId = signal('');
  public departments = signal<{ _id: string; name: string }[]>([]);

  // Employees list
  public employees = signal<IStaffOption[]>([]);
  private empOffset = 0;
  private empHasMore = true;
  private empLoading = false;

  // Managers list
  public managers = signal<IStaffOption[]>([]);
  private mgrOffset = 0;
  private mgrHasMore = true;
  private mgrLoading = false;

  get selectedEmployeeIds(): string[] {
    return this.employees().filter((e) => e.checked).map((e) => e._id);
  }

  get selectedManagerIds(): string[] {
    return this.managers().filter((m) => m.checked).map((m) => m._id);
  }

  get hasSelection(): boolean {
    return this.selectedEmployeeIds.length > 0 || this.selectedManagerIds.length > 0;
  }

  ngOnInit(): void {
    const monthDate = new Date(this.year, this.month, 1);
    this.targetMonthLabel = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    if (!this.singleDepartmentMode) {
      this.loadDepartments();
    }
    this.loadEmployees(true);
    if (!this.isSoloPlan) {
      this.loadManagers(true);
    }
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss(false);
  }

  public onDepartmentChange(deptId: string): void {
    this.selectedDepartmentId.set(deptId);
    this.loadEmployees(true);
    if (!this.isSoloPlan) {
      this.loadManagers(true);
    }
  }

  public toggleEmployee(emp: IStaffOption): void {
    emp.checked = !emp.checked;
    this.employees.update((list) => [...list]);
  }

  public onEmployeeChange(emp: IStaffOption, checked: boolean): void {
    emp.checked = checked;
    this.employees.update((list) => [...list]);
  }

  public toggleManager(mgr: IStaffOption): void {
    mgr.checked = !mgr.checked;
    this.managers.update((list) => [...list]);
  }

  public onManagerChange(mgr: IStaffOption, checked: boolean): void {
    mgr.checked = checked;
    this.managers.update((list) => [...list]);
  }

  public onEmployeesScrollEnd(event: Event): void {
    if (this.empHasMore && !this.empLoading) {
      this.loadEmployees(false, event);
    } else {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
    }
  }

  public onManagersScrollEnd(event: Event): void {
    if (this.mgrHasMore && !this.mgrLoading) {
      this.loadManagers(false, event);
    } else {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
    }
  }

  public submit(): void {
    if (!this.hasSelection) return;
    this.isLoading.set(true);

    this.payrollService
      .createPeriodsForMonth(this.selectedEmployeeIds, this.selectedManagerIds, this.month, this.year)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (res) => {
          this.isLoading.set(false);
          const toast = await this.toastCtrl.create({
            message: this.t.instant('PAY_CREATED_TOAST', { created: res.created, skipped: res.skipped }),
            duration: 2500,
            color: 'success',
          });
          await toast.present();
          void this.modalCtrl.dismiss(true);
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private getEffectiveDeptId(): string | null {
    if (this.singleDepartmentMode) {
      return this.supervisorService.effectiveDepartmentId();
    }
    return this.selectedDepartmentId() || null;
  }

  private loadDepartments(): void {
    this.departmentService
      .getDepartments({ limit: 100 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.departments.set(res.results ?? []);
        this.cdr.markForCheck();
      });
  }

  private loadEmployees(
    reset: boolean,
    scrollEvent?: Event,
  ): void {
    if (reset) {
      this.empOffset = 0;
      this.empHasMore = true;
      this.employees.set([]);
    }
    this.empLoading = true;

    const filters: Record<string, unknown> = { limit: PAGE_SIZE, offset: this.empOffset };
    const deptId = this.getEffectiveDeptId();
    if (deptId) filters['departmentId'] = deptId;

    this.employeeService
      .getEmployees(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        const newItems: IStaffOption[] = (res.results ?? [])
          .filter((e: IEmployee) => !!e.salaryRateType)
          .map((e: IEmployee) => ({
            _id: e._id,
            fullName: `${e.firstName} ${e.lastName}`.trim(),
            avatar: e.avatar,
            checked: false,
          }));

        if (reset) {
          this.employees.set(newItems);
        } else {
          this.employees.update((prev) => [...prev, ...newItems]);
        }

        this.empOffset += PAGE_SIZE;
        this.empHasMore = this.empOffset < (res.count ?? 0);
        this.empLoading = false;
        (scrollEvent as (CustomEvent & { target: { complete: () => void } }) | undefined)?.target.complete();
        this.cdr.markForCheck();
      });
  }

  private loadManagers(reset: boolean, scrollEvent?: Event): void {
    if (reset) {
      this.mgrOffset = 0;
      this.mgrHasMore = true;
      this.managers.set([]);
    }
    this.mgrLoading = true;

    const filters: Record<string, unknown> = {
      limit: PAGE_SIZE,
      offset: this.mgrOffset,
      role: EUserRole.MANAGER,
    };
    const deptId = this.getEffectiveDeptId();
    if (deptId) filters['departmentId'] = deptId;

    this.supervisorService
      .getSupervisors(filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        const newItems: IStaffOption[] = (res.results ?? [])
          .filter((s: ISupervisor) => !!s.salaryRateType)
          .map((s: ISupervisor) => ({
            _id: s._id,
            fullName: `${s.firstName} ${s.lastName}`.trim(),
            avatar: s.avatar,
            checked: false,
          }));

        if (reset) {
          this.managers.set(newItems);
        } else {
          this.managers.update((prev) => [...prev, ...newItems]);
        }

        this.mgrOffset += PAGE_SIZE;
        this.mgrHasMore = this.mgrOffset < (res.count ?? 0);
        this.mgrLoading = false;
        (scrollEvent as (CustomEvent & { target: { complete: () => void } }) | undefined)?.target.complete();
        this.cdr.markForCheck();
      });
  }
}

