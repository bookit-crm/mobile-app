import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';

type ModalCreateOptions = Parameters<ModalController['create']>[0];

/**
 * Opens Ionic modals with a guard against duplicates.
 *
 * Rapidly tapping an entity card used to fire the open handler several times,
 * stacking two (or more) identical modals on top of each other. This wraps
 * `create + present + onWillDismiss` and ignores any request while a modal is
 * already opening or already on screen, so a single user intent = a single
 * modal — no matter how many times they tap.
 */
@Injectable({ providedIn: 'root' })
export class ModalGuardService {
  private readonly modalCtrl = inject(ModalController);
  private opening = false;

  /**
   * Create + present a modal, then resolve with its dismiss result.
   * Returns `null` if the request was ignored because a modal is already
   * opening / open.
   */
  async open<TData = unknown>(
    options: ModalCreateOptions,
  ): Promise<{ data?: TData; role?: string } | null> {
    if (this.opening) {
      return null;
    }
    // A modal is already on screen (this one or another) — ignore the tap.
    if (await this.modalCtrl.getTop()) {
      return null;
    }

    this.opening = true;
    let modal: HTMLIonModalElement;
    try {
      modal = await this.modalCtrl.create(options);
      await modal.present();
    } finally {
      // Once presented, getTop() guards further taps; clear the sync flag.
      this.opening = false;
    }

    return modal.onWillDismiss<TData>();
  }
}
