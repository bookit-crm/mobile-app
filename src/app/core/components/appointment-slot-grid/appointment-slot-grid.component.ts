import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonicModule } from '@ionic/angular';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

import { IDailyEmployeeSchedule } from '@core/models/schedule.interface';
import { SchedulesService } from '@core/services/schedules.service';
import { SlotsService, ISlotItem } from '@core/services/slots.service';

const SLOT_STEP_MINUTES = 15;

export interface ISlotSelection {
  employeeId: string;
  employee: IDailyEmployeeSchedule['employee'];
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

interface IEmployeeSlotRow {
  info: IDailyEmployeeSchedule;
  freeSlots: string[];
  isDayOff: boolean;
}

@Component({
  selector: 'app-appointment-slot-grid',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './appointment-slot-grid.component.html',
  styleUrls: ['./appointment-slot-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentSlotGridComponent implements OnChanges {
  readonly departmentId = input<string | null>(null);
  /** YYYY-MM-DD */
  readonly date = input<string | null>(null);
  /** Required duration in minutes */
  readonly slotDuration = input<number>(30);
  readonly selectedSlot = input<ISlotSelection | null>(null);

  readonly slotSelected = output<ISlotSelection>();

  private readonly schedulesService = inject(SchedulesService);
  private readonly slotsService = inject(SlotsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly rows = signal<IEmployeeSlotRow[]>([]);
  readonly isLoading = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['departmentId'] || changes['date'] || changes['slotDuration']) {
      this.reload();
    }
  }

  selectSlot(row: IEmployeeSlotRow, slotTime: string): void {
    const endTime = this.addMinutes(slotTime, this.slotDuration());
    this.slotSelected.emit({
      employeeId: row.info.employee._id,
      employee: row.info.employee,
      startTime: slotTime,
      endTime,
    });
  }

  isSelected(row: IEmployeeSlotRow, slotTime: string): boolean {
    const s = this.selectedSlot();
    return s?.employeeId === row.info.employee._id && s?.startTime === slotTime;
  }

  private reload(): void {
    const deptId = this.departmentId();
    const date = this.date();
    if (!deptId || !date) {
      this.rows.set([]);
      return;
    }

    this.isLoading.set(true);

    combineLatest([
      this.schedulesService.getDailySchedule(deptId, date),
      this.slotsService.getSlots({ departmentId: deptId, startDate: date, duration: SLOT_STEP_MINUTES }),
    ])
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([daily, slotsResponse]) => {
          const allStaff = [...(daily.employees ?? [])];
          const requiredMinutes = this.slotDuration();
          const slotsMap = slotsResponse?.slots ?? {};

          const computed = allStaff.map<IEmployeeSlotRow>((emp) => {
            const isDayOff = emp.status === 'dayOff';
            const rawSlots: ISlotItem[] = slotsMap[emp.employee._id] ?? [];
            const freeSlots = isDayOff
              ? []
              : rawSlots
                  .filter((s) => s.maxAvailableMinutes >= requiredMinutes)
                  .map((s) => this.isoToHHmm(s.time));
            return { info: emp, freeSlots, isDayOff };
          });

          this.rows.set(computed);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private isoToHHmm(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  }
}

