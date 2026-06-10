import { effect, inject, Injectable } from '@angular/core';
import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

import { environment } from 'src/environments/environment';

import { SupervisorService } from './supervisor.service';

const DISMISS_KEY = 'subscription_warning_dismissed_day';

/**
 * Shows a one-toast-per-day "subscription is expiring" nag.
 *
 *  - Backend sets `expiresSoon` + `subscriptionRenewalDate` on the supervisor
 *    profile via Stripe's `invoice.upcoming` webhook (~7 days before the next
 *    charge). When the user actually pays, `invoice.paid` clears both flags
 *    and the toast stops showing on its own.
 *  - When the toast fires the user can either tap "Renew" (opens the landing
 *    site profile/subscription page in their default browser) or close it.
 *    Either action persists "dismissed today" so we don't pop the toast again
 *    if they switch back from the browser or background the app.
 *  - Next local day → toast fires again. Daily nag until they renew.
 *  - To handle users who keep the app open across midnight we also reset the
 *    in-session flag at the next local 00:00:05 boundary.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionWarningService {
  private readonly supervisorService = inject(SupervisorService);
  private readonly toastCtrl = inject(ToastController);
  private readonly t = inject(TranslateService);

  private shownThisSession = false;
  private midnightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Show on profile load / re-login.
    effect(() => {
      const user = this.supervisorService.authUserSignal();
      if (user) void this.maybeShow();
    });

    // Show on background → foreground resume (typical mobile case).
    void App.addListener('appStateChange', (state: AppState) => {
      if (state.isActive) void this.maybeShow();
    });

    // Web/PWA fallback when running in a browser (no Capacitor lifecycle).
    if (!Capacitor.isNativePlatform()) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.maybeShow();
      });
    }

    this.scheduleMidnightReset();
  }

  private async maybeShow(): Promise<void> {
    if (this.shownThisSession) return;
    const user = this.supervisorService.authUserSignal();
    if (!user?.expiresSoon || !user.subscriptionRenewalDate) return;
    if (localStorage.getItem(DISMISS_KEY) === this.todayKey()) return;

    this.shownThisSession = true;
    await this.presentToast(user.subscriptionRenewalDate);
  }

  private async presentToast(renewalDate: string): Promise<void> {
    const formatted = this.formatDate(renewalDate);
    const message =
      `${this.t.instant('SUBSCRIPTION_WARNING_MESSAGE')} ` +
      this.t.instant('SUBSCRIPTION_WARNING_NEXT_PAYMENT', { value: formatted });

    const toast = await this.toastCtrl.create({
      header: this.t.instant('SUBSCRIPTION_WARNING_TITLE'),
      message,
      position: 'top',
      color: 'warning',
      icon: 'alert-circle-outline',
      duration: 0, // sticky — only the user can dismiss
      cssClass: 'subscription-warning-toast',
      buttons: [
        {
          text: this.t.instant('SUBSCRIPTION_WARNING_CTA'),
          side: 'end',
          handler: () => {
            this.persistDismissedToday();
            this.openRenewPage();
          },
        },
        {
          icon: 'close',
          role: 'cancel',
          side: 'end',
          handler: () => this.persistDismissedToday(),
        },
      ],
    });
    await toast.present();
  }

  private openRenewPage(): void {
    const url = `${environment.landing_url}/profile/subscription`;
    // `target="_blank"` in a Capacitor WebView opens the system browser on
    // iOS/Android and a new tab on web — matches what the login page already
    // does for the "no-sub" CTA.
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private persistDismissedToday(): void {
    localStorage.setItem(DISMISS_KEY, this.todayKey());
  }

  /** Local calendar day key (YYYY-MM-DD in the user's timezone). */
  private todayKey(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Localised "dd MMM yyyy HH:mm"-ish format; tolerant to bad input. */
  private formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const lang = this.t.currentLang || 'en';
    return date.toLocaleString(lang, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private scheduleMidnightReset(): void {
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
    const now = new Date();
    const nextMidnight = new Date(now);
    // 00:00:05 of the next day — small buffer past the local midnight boundary
    nextMidnight.setHours(24, 0, 5, 0);
    const ms = nextMidnight.getTime() - now.getTime();
    this.midnightTimer = setTimeout(() => {
      this.shownThisSession = false;
      void this.maybeShow();
      this.scheduleMidnightReset();
    }, ms);
  }
}
