import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { IEmployee } from '@core/models/employee.interface';
import { IDepartment } from '@core/models/department.interface';
import { AppointmentStatus } from '@core/models/appointment.interface';

export interface ICalendarFilterResult {
  selectedEmployeeIds: string[];
  selectedDepartmentId: string;
  selectedStatuses: AppointmentStatus[];
}

@Component({
  selector: 'app-calendar-filters-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, TranslateModule],
  templateUrl: './calendar-filters-modal.component.html',
  styleUrls: ['./calendar-filters-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarFiltersModalComponent implements OnInit {
  @Input() employees: IEmployee[] = [];
  @Input() departments: IDepartment[] = [];
  @Input() isManager: boolean = false;
  @Input() selectedEmployeeIds: string[] = [];
  @Input() selectedDepartmentId: string = '';
  @Input() selectedStatuses: AppointmentStatus[] = [];

  private readonly ctrl = inject(ModalController);

  public readonly AppointmentStatus = AppointmentStatus;

  public currentEmployeeIds = signal<string[]>([]);
  public currentDepartmentId = signal<string>('');
  public currentStatuses = signal<Set<AppointmentStatus>>(new Set());

  public readonly statusList: { value: AppointmentStatus; label: string }[] = [
    { value: AppointmentStatus.New,       label: 'STATUS_NEW' },
    { value: AppointmentStatus.Completed, label: 'STATUS_COMPLETED' },
    { value: AppointmentStatus.Canceled,  label: 'STATUS_CANCELED' },
  ];

  ngOnInit(): void {
    this.currentEmployeeIds.set([...(this.selectedEmployeeIds ?? [])]);
    this.currentDepartmentId.set(this.selectedDepartmentId ?? '');
    this.currentStatuses.set(new Set(this.selectedStatuses ?? []));
  }

  public toggleEmployee(id: string): void {
    const ids = [...this.currentEmployeeIds()];
    const idx = ids.indexOf(id);
    if (idx >= 0) {
      ids.splice(idx, 1);
    } else {
      ids.push(id);
    }
    this.currentEmployeeIds.set(ids);
  }

  public isEmployeeSelected(id: string): boolean {
    return this.currentEmployeeIds().includes(id);
  }

  public selectDepartment(id: string): void {
    const prev = this.currentDepartmentId();
    const newId = prev === id ? '' : id;
    this.currentDepartmentId.set(newId);
    if (prev !== newId) {
      this.currentEmployeeIds.set([]);
    }
  }

  public isDepartmentSelected(id: string): boolean {
    return this.currentDepartmentId() === id;
  }

  public clearAllEmployees(): void {
    this.currentEmployeeIds.set([]);
  }

  public toggleStatus(status: AppointmentStatus): void {
    const set = new Set(this.currentStatuses());
    if (set.has(status)) {
      set.delete(status);
    } else {
      set.add(status);
    }
    this.currentStatuses.set(set);
  }

  public isStatusSelected(status: AppointmentStatus): boolean {
    return this.currentStatuses().has(status);
  }

  public get activeFiltersCount(): number {
    return this.currentEmployeeIds().length +
      (this.currentDepartmentId() ? 1 : 0) +
      this.currentStatuses().size;
  }

  public apply(): void {
    const result: ICalendarFilterResult = {
      selectedEmployeeIds: this.currentEmployeeIds(),
      selectedDepartmentId: this.currentDepartmentId(),
      selectedStatuses: Array.from(this.currentStatuses()),
    };
    this.ctrl.dismiss(result);
  }

  public reset(): void {
    this.currentEmployeeIds.set([]);
    this.currentDepartmentId.set('');
    this.currentStatuses.set(new Set());
  }

  public close(): void {
    this.ctrl.dismiss(null);
  }
}
