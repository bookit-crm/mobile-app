import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Minimal structural shape the picker needs. Kept local so any "service-like"
 * object (the full service IService, or the lean appointment IService) can be
 * passed in without type-coupling to a specific model.
 */
export interface IServicePickerItem {
  _id: string;
  name: string;
  duration: number;
  price: number;
}

/**
 * Reusable service picker — bottom-sheet modal with search.
 * Mirrors the country-picker pattern used in PhoneInputComponent.
 *
 * Usage (single):
 *   <app-service-picker
 *     [services]="availableServices"
 *     [selected]="[selectedService]"
 *     (selectionChange)="onServiceSelected($event)"
 *   ></app-service-picker>
 *
 * Usage (multi):
 *   <app-service-picker
 *     [services]="availableServices"
 *     [selected]="selectedServices"
 *     [multiple]="true"
 *     (selectionChange)="onServicesChanged($event)"
 *   ></app-service-picker>
 */
@Component({
  selector: 'app-service-picker',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, TranslateModule],
  templateUrl: './service-picker.component.html',
  styleUrls: ['./service-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicePickerComponent implements OnChanges {
  /** Full list of available services */
  @Input() services: IServicePickerItem[] = [];

  /** Currently selected service(s) */
  @Input() selected: IServicePickerItem[] = [];

  /** Allow selecting multiple services */
  @Input() multiple = false;

  /** Placeholder text when nothing is selected */
  @Input() placeholder = 'SVC_PICKER_PLACEHOLDER';

  /** Whether the picker trigger button is disabled */
  @Input() disabled = false;

  /**
   * Show the "Assign all / Clear all" toolbar inside the bottom of the
   * picker header. Defaults to true to keep the existing
   * employee → assign-services flow unchanged. The new-appointment flow
   * passes false because picking every service for a single booking
   * makes no sense — and the toolbar took up vertical space that pushed
   * the actual list down.
   */
  @Input() showBulkActions = true;

  /** Emits the new selection after user confirms */
  @Output() selectionChange = new EventEmitter<IServicePickerItem[]>();

  // ── Internal state ────────────────────────────────────────────────────────
  isOpen = signal(false);
  searchQuery = '';
  protected draft: IServicePickerItem[] = [];

  get filteredServices(): IServicePickerItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.services;
    return this.services.filter(s => s.name.toLowerCase().includes(q));
  }

  get displayLabel(): string {
    if (!this.selected.length) return '';
    if (!this.multiple) return this.selected[0]?.name ?? '';
    return this.selected.map(s => s.name).join(', ');
  }

  get allSelected(): boolean {
    return this.services.length > 0 &&
      this.services.every(s => this.draft.some(d => d._id === s._id));
  }

  ngOnChanges(): void {
    this.draft = [...this.selected];
  }

  openPicker(): void {
    if (this.disabled) return;
    this.draft = [...this.selected];
    this.searchQuery = '';
    this.isOpen.set(true);
  }

  closePicker(): void {
    this.isOpen.set(false);
    this.searchQuery = '';
  }

  isSelected(svc: IServicePickerItem): boolean {
    return this.draft.some(d => d._id === svc._id);
  }

  toggleService(svc: IServicePickerItem): void {
    if (!this.multiple) {
      this.draft = [svc];
      this.confirm();
      return;
    }
    if (this.isSelected(svc)) {
      this.draft = this.draft.filter(d => d._id !== svc._id);
    } else {
      this.draft = [...this.draft, svc];
    }
  }

  selectAll(): void {
    this.draft = [...this.services];
  }

  clearAll(): void {
    this.draft = [];
  }

  confirm(): void {
    this.selectionChange.emit([...this.draft]);
    this.closePicker();
  }
}
