import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertController, IonItemSliding, ModalController, ToastController } from '@ionic/angular';
import { debounceTime, Subject, take } from 'rxjs';

import { IClient } from '@core/models/client.interface';
import { ClientsService } from '@core/services/clients.service';
import { SubscriptionService } from '@core/services/subscription.service';
import { AppointmentModalComponent } from '../calendar/components/appointment-modal/appointment-modal.component';
import { ClientModalComponent } from './components/client-modal/client-modal.component';
import { ClientDetailPage } from './pages/client-detail/client-detail.page';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.page.html',
  styleUrls: ['./clients.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  @ViewChildren(IonItemSliding) private slidingItems!: QueryList<IonItemSliding>;
  private readonly SWIPE_HINT_KEY = 'clients_swipe_hint_v1';

  private readonly clientsService = inject(ClientsService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── List state ────────────────────────────────────────────────────────────
  public clients = signal<IClient[]>([]);
  public totalCount = signal(0);
  public isLoading = signal(false);
  public offset = signal(0);
  public hasMore = signal(true);

  // ── Search & Filter ───────────────────────────────────────────────────────
  public searchQuery = signal('');
  public showFilterModal = signal(false);
  public lastVisitFrom = signal('');
  public lastVisitTo = signal('');
  public tempLastVisitFrom = '';
  public tempLastVisitTo = '';

  // ── Permissions ───────────────────────────────────────────────────────────
  /** Создание/редактирование/удаление — требует активной подписки */
  public readonly canManageClients = computed(() => this.subscriptionService.isActive());
  /** История посещений — требует auditLogs feature (Professional+) */
  public readonly canViewHistory = computed(() => this.subscriptionService.hasFeature('auditLogs'));

  public readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (this.lastVisitFrom() || this.lastVisitTo()) n++;
    return n;
  });

  private readonly search$ = new Subject<string>();

  ionViewWillEnter(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadClients(true);
    this.peekFirstItem();

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.offset.set(0);
        this.hasMore.set(true);
        this.loadClients(true);
      });
  }

  // ── Search ────────────────────────────────────────────────────────────────
  public onSearchChange(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  // ── Filter modal ──────────────────────────────────────────────────────────
  public openFilterModal(): void {
    this.tempLastVisitFrom = this.lastVisitFrom();
    this.tempLastVisitTo = this.lastVisitTo();
    this.showFilterModal.set(true);
  }

  public applyFilters(): void {
    this.lastVisitFrom.set(this.tempLastVisitFrom);
    this.lastVisitTo.set(this.tempLastVisitTo);
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadClients(true);
  }

  public resetFilters(): void {
    this.tempLastVisitFrom = '';
    this.tempLastVisitTo = '';
    this.lastVisitFrom.set('');
    this.lastVisitTo.set('');
    this.showFilterModal.set(false);
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadClients(true);
  }

  // ── Infinite scroll ───────────────────────────────────────────────────────
  public async onInfiniteScroll(event: Event): Promise<void> {
    if (!this.hasMore()) {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
      return;
    }
    await this.loadClientsAsync(false);
    (event as CustomEvent & { target: { complete: () => void } }).target.complete();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  public async openCreateModal(): Promise<void> {
    if (!this.canManageClients()) {
      await this.showSubscriptionAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ClientModalComponent,
      componentProps: { client: null },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) { this.refresh(); }
  }

  public async openEditModal(client: IClient, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canManageClients()) {
      await this.showSubscriptionAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ClientModalComponent,
      componentProps: { client },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) { this.refresh(); }
  }

  public async openNewAppointment(client: IClient, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canManageClients()) {
      await this.showSubscriptionAlert();
      return;
    }
    const modal = await this.modalCtrl.create({
      component: AppointmentModalComponent,
      componentProps: { payload: { clientId: client._id } },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss<{ saved?: boolean }>();
    if (data?.saved) {
      void this.showToast('Appointment created');
    }
  }

  public async viewHistory(client: IClient, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canViewHistory()) {
      const toast = await this.toastCtrl.create({
        message: 'Upgrade your plan to view client visit history.',
        duration: 3000,
        color: 'warning',
        icon: 'lock-closed-outline',
      });
      await toast.present();
      return;
    }
    // Переход на страницу деталей клиента с историей
    const modal = await this.modalCtrl.create({
      component: ClientDetailPage,
      componentProps: { clientId: client._id },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
  }

  public async confirmDelete(client: IClient, event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.canManageClients()) {
      await this.showSubscriptionAlert();
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Delete Client',
      message: `Are you sure you want to delete "${client.fullName}"? This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteClient(client._id),
        },
      ],
    });
    await alert.present();
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  public getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  public formatDate(date: string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────
  private peekFirstItem(): void {
    if (localStorage.getItem(this.SWIPE_HINT_KEY)) return;
    setTimeout(async () => {
      const first = this.slidingItems?.first;
      if (!first) return;
      try {
        await first.open('end');
        setTimeout(async () => {
          await first.close();
          localStorage.setItem(this.SWIPE_HINT_KEY, '1');
        }, 900);
      } catch {
        // ignore
      }
    }, 900);
  }

  private refresh(): void {
    this.offset.set(0);
    this.hasMore.set(true);
    this.loadClients(true);
  }

  private buildFilters(): Record<string, unknown> {
    const filters: Record<string, unknown> = {
      limit: 25,
      offset: this.offset(),
    };
    if (this.searchQuery())      filters['search']        = this.searchQuery();
    if (this.lastVisitFrom())    filters['lastVisitFrom'] = this.lastVisitFrom();
    if (this.lastVisitTo())      filters['lastVisitTo']   = this.lastVisitTo();
    return filters;
  }

  private loadClients(reset: boolean): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);

    this.clientsService
      .getClients(this.buildFilters())
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const list = reset ? res.results : [...this.clients(), ...res.results];
          this.clients.set(list);
          this.totalCount.set(res.count);
          this.offset.set(list.length);
          this.hasMore.set(list.length < res.count);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private async loadClientsAsync(reset: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (!this.hasMore()) { resolve(); return; }
      this.clientsService
        .getClients(this.buildFilters())
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            const list = reset ? res.results : [...this.clients(), ...res.results];
            this.clients.set(list);
            this.totalCount.set(res.count);
            this.offset.set(list.length);
            this.hasMore.set(list.length < res.count);
            this.cdr.markForCheck();
            resolve();
          },
          error: () => resolve(),
        });
    });
  }

  private deleteClient(id: string): void {
    this.clientsService
      .deleteClient(id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.refresh();
          void this.showToast('Client deleted');
        },
      });
  }

  private async showSubscriptionAlert(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Subscription Required',
      message: 'Your subscription is not active. Please renew your plan to manage clients.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async showToast(message: string, color = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }
}
