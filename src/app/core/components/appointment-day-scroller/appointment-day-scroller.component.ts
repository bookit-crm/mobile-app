import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  OnChanges,
  output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { add, format } from 'date-fns';

export interface IDayItem {
  date: string;     // YYYY-MM-DD
  dayName: string;  // Mon, Tue…
  dayNum: number;
  isToday: boolean;
}

@Component({
  selector: 'app-appointment-day-scroller',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './appointment-day-scroller.component.html',
  styleUrls: ['./appointment-day-scroller.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentDayScrollerComponent implements OnChanges {
  /** YYYY-MM-DD */
  readonly selectedDate = input.required<string>();
  readonly dateChange = output<string>();

  @ViewChild('track') trackRef!: ElementRef<HTMLElement>;

  readonly days = computed<IDayItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: IDayItem[] = [];
    for (let i = -1; i <= 27; i++) {
      const d = add(today, { days: i });
      result.push({
        date: format(d, 'yyyy-MM-dd'),
        dayName: format(d, 'EEE'),
        dayNum: d.getDate(),
        isToday: i === 0,
      });
    }
    return result;
  });

  ngOnChanges(): void {
    // Scroll selected day into view after change detection
    setTimeout(() => this.scrollSelectedIntoView(), 50);
  }

  selectDay(date: string): void {
    this.dateChange.emit(date);
  }

  onNativeDateChange(ev: Event): void {
    const val = (ev.target as HTMLInputElement).value;
    if (val) {
      this.dateChange.emit(val);
    }
  }

  private scrollSelectedIntoView(): void {
    if (!this.trackRef?.nativeElement) return;
    const track = this.trackRef.nativeElement;
    const btn = track.querySelector('.day-chip--selected') as HTMLElement | null;
    if (btn) {
      track.scrollTo({ left: btn.offsetLeft - track.offsetWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
    }
  }
}

