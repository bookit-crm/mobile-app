import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { SubscriptionService } from '@core/services/subscription.service';
import { EFeatureLevel } from '@core/models/subscription.interface';
import { IDepartment } from '@core/models/department.interface';
import { IEmployee } from '@core/models/employee.interface';

import { DashboardStateService } from './services/dashboard-state.service';

interface IDashboardTab {
  value: string;
  display: string;
  icon: string;
  feature?: string;
  minLevel?: EFeatureLevel;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DashboardStateService],
})
export class DashboardPage implements OnInit {
  public state = inject(DashboardStateService);
  private subscriptionService = inject(SubscriptionService);
  private cdr = inject(ChangeDetectorRef);

  public activeTab = signal<string>('revenue');
  public showFilterModal = signal(false);

  /** Количество активных фильтров (dept + employee). 0 = всё выбрано */
  public activeFiltersCount = computed(() =>
    this.state.selectedDepartments().length + this.state.selectedEmployees().length,
  );

  private allTabs: IDashboardTab[] = [
    { value: 'revenue',     display: 'Revenue',     icon: 'trending-up-outline' },
    { value: 'clients',     display: 'Clients',     icon: 'people-outline',       feature: 'analytics',       minLevel: EFeatureLevel.BASIC },
    { value: 'employees',   display: 'Employees',   icon: 'trophy-outline',       feature: 'analytics',       minLevel: EFeatureLevel.BASIC },
    { value: 'schedule',    display: 'Schedule',    icon: 'calendar-outline',     feature: 'analytics',       minLevel: EFeatureLevel.BASIC },
    { value: 'inventory',   display: 'Inventory',   icon: 'cube-outline',         feature: 'warehouse',       minLevel: EFeatureLevel.BASIC },
    { value: 'expenses',    display: 'Expenses',    icon: 'cash-outline',         feature: 'expensesPayroll', minLevel: EFeatureLevel.BASIC },
    { value: 'promo-codes', display: 'Promos',      icon: 'pricetag-outline',     feature: 'promoCodes' },
  ];

  public availableTabs = computed<IDashboardTab[]>(() => {
    // Re-read subscription signal to make this reactive
    this.subscriptionService.features();
    return this.allTabs.filter((tab) => {
      if (!tab.feature) return true;
      return this.subscriptionService.hasFeature(tab.feature as any, tab.minLevel);
    });
  });

  public ngOnInit(): void {
    this.state.init();
  }

  public onTabChange(value: string): void {
    this.activeTab.set(value);
  }

  public onDatePresetChange(preset: string): void {
    this.state.setDatePreset(preset);
    this.cdr.markForCheck();
  }

  public openFilterModal(): void {
    this.showFilterModal.set(true);
  }

  public closeFilterModal(): void {
    this.showFilterModal.set(false);
  }

  public onDepartmentChange(depts: IDepartment[]): void {
    this.state.setDepartments(depts);
  }

  public onEmployeeChange(emps: IEmployee[]): void {
    this.state.setEmployees(emps);
  }

  public onCustomRangeApply(from: string, to: string): void {
    this.state.setCustomRange(from, to);
    this.closeFilterModal();
  }

  public trackByValue(_: number, tab: IDashboardTab): string {
    return tab.value;
  }

  // Modal helpers

  private _pendingCustomFrom: string | null = null;
  private _pendingCustomTo: string | null = null;

  public isDeptSelected(deptId: string): boolean {
    return this.state.selectedDepartments().some((d) => d._id === deptId);
  }

  public isEmpSelected(empId: string): boolean {
    return this.state.selectedEmployees().some((e) => e._id === empId);
  }

  public toggleDepartment(dept: IDepartment, event: CustomEvent): void {
    const checked = (event as CustomEvent<{ checked: boolean }>).detail?.checked;
    const current = [...this.state.selectedDepartments()];
    if (checked) {
      if (!current.find((d) => d._id === dept._id)) {
        const next = [...current, dept];
        this.state.setDepartments(next);
      }
    } else {
      this.state.setDepartments(current.filter((d) => d._id !== dept._id));
    }
  }

  /** Сброс выбора департаментов → "All Departments" */
  public selectAllDepartments(): void {
    this.state.setDepartments([]);
  }

  public toggleEmployee(emp: IEmployee, event: CustomEvent): void {
    const checked = (event as CustomEvent<{ checked: boolean }>).detail?.checked;
    const current = [...this.state.selectedEmployees()];
    if (checked) {
      if (!current.find((e) => e._id === emp._id)) {
        this.state.setEmployees([...current, emp]);
      }
    } else {
      this.state.setEmployees(current.filter((e) => e._id !== emp._id));
    }
  }

  /** Сброс выбора сотрудников → "All Employees" */
  public selectAllEmployees(): void {
    this.state.setEmployees([]);
  }

  public onCustomFromChange(event: CustomEvent): void {
    this._pendingCustomFrom = (event as CustomEvent<{ value: string }>).detail?.value ?? null;
  }

  public onCustomToChange(event: CustomEvent): void {
    this._pendingCustomTo = (event as CustomEvent<{ value: string }>).detail?.value ?? null;
  }

  public applyCustomRange(): void {
    if (this._pendingCustomFrom && this._pendingCustomTo) {
      this.onCustomRangeApply(this._pendingCustomFrom, this._pendingCustomTo);
    }
  }
}
