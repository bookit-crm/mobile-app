import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertController, IonicModule, ModalController, ToastController } from '@ionic/angular';
import { forkJoin, switchMap, take } from 'rxjs';
import { EPaymentMethod, EPayrollLineItemStatus, EPayrollPeriodStatus } from '@core/enums/e-payroll';
import { IPayrollLineItem, IPayrollPeriod, IPayrollPeriodSummary, IPayoutPayload } from '@core/models/payroll.interface';
import { PayrollService, IPaginatedPayrollLineItems } from '@core/services/payroll.service';

@Component({
  selector: 'app-payroll-detail',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './payroll-detail.component.html',
  styleUrls: ['./payroll-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayrollDetailComponent implements OnInit {
  @Input() periodId!: string;

  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly payrollService = inject(PayrollService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  public readonly EPayrollPeriodStatus = EPayrollPeriodStatus;
  public readonly EPayrollLineItemStatus = EPayrollLineItemStatus;

  public period = signal<IPayrollPeriod | null>(null);
  public summary = signal<IPayrollPeriodSummary | null>(null);
  public lineItems = signal<IPayrollLineItem[]>([]);
  public lineItemsTotal = signal(0);
  public lineItemsOffset = signal(0);
  public lineItemsHasMore = signal(true);
  public isLoading = signal(true);
  public isLoadingItems = signal(false);

  public activeSegment = signal<'overview' | 'items'>('overview');

  // Line items filters
  public filterItemStatus = signal<EPayrollLineItemStatus | ''>('');
  public filterItemDateFrom = signal('');
  public filterItemDateTo = signal('');

  public readonly isSupervisorPeriod = computed(() => !!this.period()?.supervisor);

  public readonly statusOptions: { value: EPayrollLineItemStatus | ''; label: string }[] = [
    { value: '', label: 'All statuses' },
    { value: EPayrollLineItemStatus.Pending, label: 'Pending' },
    { value: EPayrollLineItemStatus.Paid, label: 'Paid' },
    { value: EPayrollLineItemStatus.Reversed, label: 'Reversed' },
  ];

  public readonly paymentMethodOptions: { value: EPaymentMethod; label: string }[] = [
    { value: EPaymentMethod.Cash, label: 'Cash' },
    { value: EPaymentMethod.BankTransfer, label: 'Bank Transfer' },
    { value: EPaymentMethod.Card, label: 'Card' },
  ];

  private readonly LIMIT = 25;

  public payoutForm = new FormGroup({
    paymentMethod: new FormControl<EPaymentMethod | null>(null, Validators.required),
    paymentDate: new FormControl<string>(new Date().toISOString().split('T')[0], Validators.required),
    paymentNote: new FormControl<string>(''),
  });

  ngOnInit(): void {
    this.loadPeriodData();
  }

  public dismiss(): void {
    void this.modalCtrl.dismiss(false);
  }

  public onSegmentChange(value: 'overview' | 'items'): void {
    this.activeSegment.set(value);
    if (value === 'items' && this.lineItems().length === 0) {
      this.loadLineItems(true);
    }
  }

  public onLineItemsInfiniteScroll(event: Event): void {
    if (!this.lineItemsHasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    this.lineItemsOffset.update((o) => o + this.LIMIT);
    this.loadLineItems(false, event as CustomEvent & { target: { complete: () => void } });
  }

  public applyItemFilters(): void {
    this.lineItemsOffset.set(0);
    this.lineItems.set([]);
    this.loadLineItems(true);
  }

  public syncLineItems(): void {
    this.payrollService
      .syncLineItems(this.periodId)
      .pipe(
        take(1),
        switchMap(() => {
          this.lineItemsOffset.set(0);
          this.lineItems.set([]);
          return this.payrollService.getLineItems(this.periodId, this.buildItemFilters(0));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.lineItems.set(res.results ?? []);
          this.lineItemsTotal.set(res.count ?? 0);
          this.lineItemsHasMore.set(this.lineItems().length < (res.count ?? 0));
          this.loadPeriodData();
          this.cdr.markForCheck();
        },
      });
  }

  public async confirmPayout(): Promise<void> {
    if (this.payoutForm.invalid) return;

    const period = this.period();
    const summary = this.summary();
    const staff = period?.employee || period?.supervisor;
    const employeeName = `${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim();

    const alert = await this.alertCtrl.create({
      header: 'Confirm Payout',
      message: `Pay ${employeeName} — $${summary?.totalPayout?.toFixed(2) ?? '0.00'}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm Payout',
          handler: () => {
            const fv = this.payoutForm.getRawValue();
            const payload: IPayoutPayload = {
              paymentMethod: fv.paymentMethod as EPaymentMethod,
              paymentDate: fv.paymentDate as string,
              paymentNote: fv.paymentNote || undefined,
            };
            this.payrollService
              .payoutPeriod(this.periodId, payload)
              .pipe(take(1), takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: async () => {
                  const toast = await this.toastCtrl.create({
                    message: 'Payout recorded successfully',
                    duration: 2000,
                    color: 'success',
                  });
                  await toast.present();
                  this.loadPeriodData();
                },
              });
          },
        },
      ],
    });
    await alert.present();
  }

  public downloadPdf(): void {
    this.payrollService
      .downloadPdf(this.periodId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((blob) => this.triggerDownload(blob, 'pdf'));
  }

  public downloadCsv(): void {
    this.payrollService
      .downloadCsv(this.periodId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((blob) => this.triggerDownload(blob, 'csv'));
  }

  public getStaffName(): string {
    const p = this.period();
    const staff = p?.employee || p?.supervisor;
    if (!staff) return '—';
    return `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim();
  }

  public getDeptName(): string {
    const p = this.period();
    const staff = p?.employee || p?.supervisor;
    if (!staff) return '—';
    const dept = (staff as { department?: { name: string } | string | null }).department;
    if (!dept) return '—';
    return typeof dept === 'string' ? dept : dept.name;
  }

  public periodStatusColor(status: EPayrollPeriodStatus): string {
    if (status === EPayrollPeriodStatus.Paid) return 'success';
    if (status === EPayrollPeriodStatus.Reversed) return 'medium';
    return 'warning';
  }

  public lineItemStatusColor(status: EPayrollLineItemStatus): string {
    if (status === EPayrollLineItemStatus.Paid) return 'success';
    if (status === EPayrollLineItemStatus.Reversed) return 'medium';
    return 'warning';
  }

  // ── Private ────────────────────────────────────────────────────────────────
  private loadPeriodData(): void {
    this.isLoading.set(true);
    forkJoin([
      this.payrollService.getPeriodById(this.periodId),
      this.payrollService.getPeriodSummary(this.periodId),
    ])
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([period, summary]) => {
          this.period.set(period);
          this.summary.set(summary);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private loadLineItems(
    reset: boolean,
    scrollEvent?: CustomEvent & { target: { complete: () => void } },
  ): void {
    this.isLoadingItems.set(true);
    const offset = this.lineItemsOffset();
    const filters = this.buildItemFilters(offset);

    this.payrollService
      .getLineItems(this.periodId, filters)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: IPaginatedPayrollLineItems) => {
          const incoming = res.results ?? [];
          this.lineItems.update((cur) => (reset ? incoming : [...cur, ...incoming]));
          this.lineItemsTotal.set(res.count ?? 0);
          this.lineItemsHasMore.set(this.lineItems().length < (res.count ?? 0));
          this.isLoadingItems.set(false);
          scrollEvent?.target.complete();
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingItems.set(false);
          scrollEvent?.target.complete();
          this.cdr.markForCheck();
        },
      });
  }

  private buildItemFilters(offset: number): Record<string, unknown> {
    const filters: Record<string, unknown> = { limit: this.LIMIT, offset };
    if (this.filterItemStatus()) filters['status'] = this.filterItemStatus();
    if (this.filterItemDateFrom()) filters['dateFrom'] = this.filterItemDateFrom();
    if (this.filterItemDateTo()) filters['dateTo'] = this.filterItemDateTo();
    return filters;
  }

  private triggerDownload(blob: Blob, ext: string): void {
    const period = this.period();
    const staff = period?.employee || period?.supervisor;
    const name = `${staff?.firstName ?? ''}_${staff?.lastName ?? ''}`.trim();
    const date = new Date().toISOString().split('T')[0];
    const filename = `Payroll_${name}_${date}.${ext}`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

