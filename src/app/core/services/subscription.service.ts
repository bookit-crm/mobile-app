import { computed, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { finalize, Observable, shareReplay, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { FEATURE_LEVEL_ORDER } from '@core/constants/feature-flags';
import {
  EFeatureLevel,
  ETier,
  IFeatureFlags,
  IStorageUsage,
  ISubscription,
  TFeatureKey,
} from '@core/models/subscription.interface';

const TIER_ORDER: Record<ETier, number> = {
  [ETier.INDIVIDUAL]:   0,
  [ETier.STARTER]:      1,
  [ETier.PROFESSIONAL]: 2,
  [ETier.ENTERPRISE]:   3,
};

/** Fallback-лимиты по тарифам (зеркало бэка FEATURE_FLAGS_BY_TIER). */
const DEFAULT_LIMITS_BY_TIER: Record<ETier, { employees: number; locations: number; storageMb: number }> = {
  [ETier.INDIVIDUAL]:   { employees: 1,  locations: 1, storageMb: 200   },
  [ETier.STARTER]:      { employees: 5,  locations: 1, storageMb: 1024  },
  [ETier.PROFESSIONAL]: { employees: 30, locations: 5, storageMb: 5120  },
  [ETier.ENTERPRISE]:   { employees: -1, locations: -1, storageMb: -1   },
};

export type TLimitKind = 'employees' | 'locations' | 'storage';

@Injectable({ providedIn: 'root' })
export class SubscriptionService extends HttpHelper {

  public readonly currentSubscription: WritableSignal<ISubscription | null> = signal(null);

  public readonly currentTier: Signal<ETier> = computed(
    () => this.currentSubscription()?.tier ?? ETier.INDIVIDUAL,
  );

  public readonly features: Signal<IFeatureFlags | null> = computed(
    () => this.currentSubscription()?.features ?? null,
  );

  public readonly storageUsage: Signal<IStorageUsage | null> = computed(
    () => this.currentSubscription()?.storage ?? null,
  );

  public readonly isTrialing: Signal<boolean> = computed(
    () => this.currentSubscription()?.status === 'trialing',
  );

  public readonly isActive: Signal<boolean> = computed(() => {
    const status = this.currentSubscription()?.status;
    return status === 'active' || status === 'trialing';
  });

  public readonly isSoloPlan: Signal<boolean> = computed(
    () => this.getLimit('employees') === 1,
  );

  public readonly isSingleLocationPlan: Signal<boolean> = computed(
    () => this.getLimit('locations') === 1,
  );

  /**
   * `true` если для тенанта доступны ТОЛЬКО appointment-related нотификации
   * (NewBookings, Cancellations) — тариф Individual.
   * Используется для скрытия категорий/настроек в UI и фильтрации realtime
   * WebSocket-событий (defense-in-depth).
   */
  public readonly isNotificationsAppointmentsOnly: Signal<boolean> = computed(
    () => this.features()?.notificationsScope === 'appointments-only',
  );

  /** Дедупликация параллельных вызовов loadSubscription(). */
  private subscriptionRequest$: Observable<ISubscription> | null = null;

  public loadSubscription(): Observable<ISubscription> {
    if (this.subscriptionRequest$) {
      return this.subscriptionRequest$;
    }
    this.subscriptionRequest$ = this.httpGetRequest<ISubscription>('api/subscription/self/').pipe(
      tap((res) => this.currentSubscription.set(res)),
      finalize(() => { this.subscriptionRequest$ = null; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.subscriptionRequest$;
  }

  public hasFeature(feature: TFeatureKey, minLevel?: EFeatureLevel): boolean {
    const flags = this.features();
    if (!flags) return false;
    const value = flags[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    const currentLevel = FEATURE_LEVEL_ORDER[value as EFeatureLevel] ?? 0;
    const required = minLevel ? FEATURE_LEVEL_ORDER[minLevel] : 1;
    return currentLevel >= required;
  }

  public meetsTier(tier: ETier): boolean {
    return TIER_ORDER[this.currentTier()] >= TIER_ORDER[tier];
  }

  public getLimit(kind: TLimitKind): number {
    const limits = DEFAULT_LIMITS_BY_TIER[this.currentTier()];
    return kind === 'storage' ? limits.storageMb : limits[kind];
  }

  /** true если текущий план позволяет добавить ещё одну локацию/департамент */
  public canAddLocation(currentCount: number): boolean {
    const limit = this.getLimit('locations');
    return limit === -1 || currentCount < limit;
  }
}

