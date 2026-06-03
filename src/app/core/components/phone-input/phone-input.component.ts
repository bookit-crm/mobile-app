import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  inject,
  Input,
  signal,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import {
  applyMask,
  DEFAULT_COUNTRY,
  detectCountry,
  digitsOnly,
  maskLength,
  maskPlaceholder,
  PHONE_COUNTRIES,
  PhoneCountry,
} from './phone-countries';

@Component({
  selector: 'app-phone-input',
  templateUrl: './phone-input.component.html',
  styleUrls: ['./phone-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
  ],
})
export class PhoneInputComponent implements ControlValueAccessor, Validator {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() label = '';
  @Input() placeholder = '';
  @Input() errorMessage = '';
  @Input() required = false;

  // ── State ─────────────────────────────────────────────────────────────────
  selectedCountry: PhoneCountry = DEFAULT_COUNTRY;
  maskedValue = '';
  private localDigits = '';

  isDropdownOpen = signal(false);
  searchQuery = '';
  disabled = false;

  readonly allCountries = PHONE_COUNTRIES;

  @ViewChild('phoneInput') phoneInputRef!: ElementRef<HTMLInputElement>;

  private onValidatorChange: () => void = () => {};

  // ── Computed ──────────────────────────────────────────────────────────────
  get phonePlaceholder(): string {
    return this.placeholder || maskPlaceholder(this.selectedCountry.mask);
  }

  get filteredCountries(): PhoneCountry[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.allCountries;
    return this.allCountries.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }

  flagClass(country: PhoneCountry): Record<string, boolean> {
    return { 'fi': true, [`fi-${country.code.toLowerCase()}`]: true };
  }

  // ── Validator ─────────────────────────────────────────────────────────────
  validate(_control: AbstractControl): ValidationErrors | null {
    if (!this.localDigits) return null;
    const expected = maskLength(this.selectedCountry.mask);
    if (this.localDigits.length < expected) {
      return {
        phoneMask: {
          requiredLength: expected,
          actualLength: this.localDigits.length,
          country: this.selectedCountry.code,
        },
      };
    }
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  // ── ControlValueAccessor ──────────────────────────────────────────────────
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    if (!value) {
      this.localDigits = '';
      this.maskedValue = '';
      this.cdr.markForCheck();
      return;
    }
    const country = detectCountry(value);
    if (country) {
      this.selectedCountry = country;
      const afterDial = value.startsWith('+')
        ? value.slice(country.dialCode.length)
        : value.slice(country.dialCode.length - 1);
      this.localDigits = digitsOnly(afterDial);
    } else {
      this.localDigits = digitsOnly(value);
    }
    this.maskedValue = applyMask(this.localDigits, this.selectedCountry.mask);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  // ── UI Handlers ───────────────────────────────────────────────────────────
  onPhoneInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const digits = digitsOnly(raw).slice(0, maskLength(this.selectedCountry.mask));
    this.localDigits = digits;
    this.maskedValue = applyMask(digits, this.selectedCountry.mask);

    const el = event.target as HTMLInputElement;
    el.value = this.maskedValue;
    el.setSelectionRange(this.maskedValue.length, this.maskedValue.length);

    this.emitValue();
    this.cdr.markForCheck();
  }

  onBlur(): void { this.onTouched(); }

  openCountryPicker(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.searchQuery = '';
    this.isDropdownOpen.set(true);
    this.cdr.markForCheck();
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
    this.searchQuery = '';
    this.cdr.markForCheck();
  }

  selectCountry(country: PhoneCountry): void {
    this.selectedCountry = country;
    this.isDropdownOpen.set(false);
    this.searchQuery = '';
    this.localDigits = this.localDigits.slice(0, maskLength(country.mask));
    this.maskedValue = applyMask(this.localDigits, country.mask);
    this.emitValue();
    this.onValidatorChange();
    this.cdr.markForCheck();
    setTimeout(() => this.phoneInputRef?.nativeElement.focus(), 0);
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private emitValue(): void {
    this.onChange(this.localDigits ? this.selectedCountry.dialCode + this.localDigits : '');
  }
}
