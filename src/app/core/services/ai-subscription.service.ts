import { computed, Injectable, signal, Signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import {
  IAiSubscriptionStatus,
  IAiTier,
  TAiTier,
} from '@core/models/ai-subscription.interface';

@Injectable({ providedIn: 'root' })
export class AiSubscriptionService extends HttpHelper {
  public readonly status = signal<IAiSubscriptionStatus | null>(null);
  public readonly tiers = signal<IAiTier[]>([]);

  /** Active access — can send messages / see analytics (sub OR trial left). */
  public readonly aiVisible: Signal<boolean> = computed(
    () => this.status()?.aiVisible ?? false,
  );

  /** Can open the chat to read history (active access OR past usage). */
  public readonly aiAccessible: Signal<boolean> = computed(
    () => this.status()?.aiAccessible ?? false,
  );

  public readonly hasSubscription: Signal<boolean> = computed(
    () => this.status()?.hasSubscription ?? false,
  );

  public load(): Observable<IAiSubscriptionStatus> {
    return this.httpGetRequest<IAiSubscriptionStatus>(
      'api/ai-subscription/',
    ).pipe(tap((res) => this.status.set(res)));
  }

  public loadTiers(): Observable<IAiTier[]> {
    return this.httpGetRequest<IAiTier[]>('api/ai-subscription/tiers/').pipe(
      tap((res) => this.tiers.set(res)),
    );
  }

  public createCheckout(aiTier: TAiTier): Observable<{ url: string }> {
    return this.httpPostRequest<{ aiTier: TAiTier }, { url: string }>(
      'api/ai-subscription/checkout/',
      { aiTier },
    );
  }

  public cancel(): Observable<{ ok: boolean }> {
    return this.httpPostRequest<Record<string, never>, { ok: boolean }>(
      'api/ai-subscription/cancel/',
      {},
    );
  }
}
