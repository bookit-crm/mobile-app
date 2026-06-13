import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

interface ILangOption {
  code: string;
  label: string;
}

/**
 * App settings for the employee role. Today it only hosts the UI-language
 * switch — employees have no `lang` field on the backend (their model
 * carries `languages: string[]` for booking, not a UI preference), so the
 * choice is persisted client-side in `localStorage 'app_lang'`, which is
 * exactly the key `AppComponent` reads on launch. Structured as a generic
 * settings page so more toggles can be added later.
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ion-page' },
})
export class SettingsPage {
  private readonly translate = inject(TranslateService);
  private readonly toastCtrl = inject(ToastController);

  public readonly languages: ILangOption[] = [
    { code: 'en', label: 'English' },
    { code: 'ua', label: 'Українська' },
  ];

  /** Active UI language — drives the checkmark in the list. */
  public readonly currentLang = signal<string>(
    localStorage.getItem('app_lang') ?? this.translate.currentLang ?? 'en',
  );

  public selectLanguage(code: string): void {
    if (code === this.currentLang()) return;
    this.currentLang.set(code);
    // Apply immediately (ngx-translate is reactive, the page re-renders in
    // the new language) and persist so it survives an app restart.
    this.translate.use(code);
    localStorage.setItem('app_lang', code);
    void this.presentSavedToast();
  }

  private async presentSavedToast(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant('SETTINGS_LANGUAGE_SAVED'),
      duration: 1800,
      position: 'bottom',
      color: 'success',
    });
    await toast.present();
  }
}
