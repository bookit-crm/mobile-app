import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { take, catchError, throwError, switchMap } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SupervisorService } from '@services/supervisor.service';
import { AuthService } from '@services/auth.service';
import { FilesService } from '@services/files.service';
import { ISupervisor } from '@models/supervisor.interface';
import { ValidatorsHelper } from '@core/helpers/validators.helper';
import { Router } from '@angular/router';

type SettingsTab = 'profile' | 'security';

enum EChangePasswordStep {
  Email = 'email',
  Otp = 'otp',
  Password = 'password',
}

@Component({
  selector: 'app-account-settings-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './account-settings-modal.component.html',
  styleUrls: ['./account-settings-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsModalComponent implements OnInit {
  private readonly modalCtrl    = inject(ModalController);
  private readonly toastCtrl    = inject(ToastController);
  private readonly supervisorSvc = inject(SupervisorService);
  private readonly authService  = inject(AuthService);
  private readonly filesSvc     = inject(FilesService);
  private readonly fb           = inject(FormBuilder);
  private readonly cdr          = inject(ChangeDetectorRef);
  private readonly router       = inject(Router);
  private readonly translate    = inject(TranslateService);

  public readonly authUser     = this.supervisorSvc.authUserSignal;
  public readonly isManager    = this.supervisorSvc.isManager;

  /** Показываем таб Security только для admin/owner */
  public readonly showSecurity = computed(() => !this.isManager());

  public readonly EChangePasswordStep = EChangePasswordStep;

  // ── Tabs ──
  public activeTab = signal<SettingsTab>('profile');

  // ── Profile form ──
  public profileForm!: FormGroup;
  public isSavingProfile = signal(false);
  public isUploadingAvatar = signal(false);

  // ── Security form ──
  public securityForm!: FormGroup;
  public changePasswordStep = signal<EChangePasswordStep>(EChangePasswordStep.Email);
  public isSavingSecurity = signal(false);

  /** Инициалы для mock-аватарки */
  public readonly initials = computed(() => {
    const u = this.authUser();
    if (!u) return '?';
    return ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase() || '?';
  });

  public readonly currentLang = signal<string>(localStorage.getItem('app_lang') ?? 'en');

  public readonly languages = [
    { code: 'en', labelKey: 'LANG_EN' },
    { code: 'ua', labelKey: 'LANG_UA' },
  ];

  constructor() {
    effect(() => {
      const u = this.authUser();
      if (u && this.profileForm) {
        this.profileForm.patchValue({
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: u.phone ?? '',
        });
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    const u = this.authUser();
    this.profileForm = this.fb.group({
      firstName: [u?.firstName ?? '', Validators.required],
      lastName:  [u?.lastName ?? ''],
      email:     [u?.email ?? '', [Validators.required, Validators.pattern(ValidatorsHelper.userEmailReg)]],
      phone:     [u?.phone ?? '', Validators.pattern(ValidatorsHelper.phoneRegExp)],
    });

    this.securityForm = this.fb.group({
      email:           ['', Validators.required],
      otpCode:         ['', [Validators.required, Validators.minLength(4)]],
      password:        ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    });
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  // ──────────────────────────────────────────────────────
  //  PROFILE
  // ──────────────────────────────────────────────────────

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    this.isSavingProfile.set(true);
    const payload = this.profileForm.getRawValue() as Partial<ISupervisor>;

    this.patchProfile(payload).pipe(take(1)).subscribe({
      next: () => {
        this.isSavingProfile.set(false);
        this.showToast('Profile updated successfully', 'success');
      },
      error: () => {
        this.isSavingProfile.set(false);
        this.showToast('Failed to update profile', 'danger');
      },
    });
  }

  uploadAvatar(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.isUploadingAvatar.set(true);
      const formData = new FormData();
      formData.append('file', file);
      this.filesSvc.uploadFile(formData).pipe(
        take(1),
        switchMap((fileDto) => this.patchProfile({ avatar: fileDto._id } as unknown as Partial<ISupervisor>)),
      ).subscribe({
        next: () => {
          this.isUploadingAvatar.set(false);
          this.showToast('Avatar updated', 'success');
        },
        error: () => {
          this.isUploadingAvatar.set(false);
          this.showToast('Failed to upload avatar', 'danger');
        },
      });
    };
    input.click();
  }

  removeAvatar(): void {
    this.patchProfile({ avatar: null }).pipe(take(1)).subscribe({
      next: () => this.showToast('Avatar removed', 'success'),
      error: () => this.showToast('Failed to remove avatar', 'danger'),
    });
  }

  private patchProfile(payload: Partial<ISupervisor>) {
    if (this.isManager()) {
      const id = this.authUser()?._id ?? '';
      return this.supervisorSvc.editSupervisorManagerBySelf(id, payload).pipe(
        switchMap(() => this.supervisorSvc.getSelf()),
      );
    }
    return this.supervisorSvc.patchSelf(payload);
  }

  // ──────────────────────────────────────────────────────
  //  SECURITY – change password flow
  // ──────────────────────────────────────────────────────

  sendVerificationCode(): void {
    const email = this.securityForm.get('email')?.value?.trim();
    if (!email) return;

    this.isSavingSecurity.set(true);
    this.authService.confirmChangePasswordEmail(email).pipe(
      take(1),
      catchError((err) => { this.isSavingSecurity.set(false); return throwError(() => err); }),
    ).subscribe(() => {
      this.isSavingSecurity.set(false);
      this.changePasswordStep.set(EChangePasswordStep.Otp);
      this.showToast('Verification code sent', 'success');
    });
  }

  confirmOtp(): void {
    const { email, otpCode } = this.securityForm.getRawValue() as { email: string; otpCode: string };
    this.isSavingSecurity.set(true);
    this.authService.confirmChangePasswordCode({ email, otpCode }).pipe(
      take(1),
      catchError((err) => { this.isSavingSecurity.set(false); return throwError(() => err); }),
    ).subscribe(() => {
      this.isSavingSecurity.set(false);
      this.changePasswordStep.set(EChangePasswordStep.Password);
    });
  }

  confirmNewPassword(): void {
    const v = this.securityForm.getRawValue() as {
      email: string; otpCode: string; password: string; confirmPassword: string;
    };
    if (v.password !== v.confirmPassword) {
      this.showToast('Passwords do not match', 'danger');
      return;
    }
    this.isSavingSecurity.set(true);
    this.authService.confirmChangePassword(v).pipe(
      take(1),
      catchError((err) => { this.isSavingSecurity.set(false); return throwError(() => err); }),
    ).subscribe(() => {
      this.isSavingSecurity.set(false);
      this.changePasswordStep.set(EChangePasswordStep.Email);
      this.securityForm.reset();
      this.showToast('Password changed successfully', 'success');
    });
  }

  // ──────────────────────────────────────────────────────
  //  LOGOUT
  // ──────────────────────────────────────────────────────

  logout(): void {
    this.authService.logout().pipe(take(1)).subscribe({
      complete: () => this.doLogout(),
      error: () => this.doLogout(),
    });
  }

  private doLogout(): void {
    localStorage.clear();
    this.modalCtrl.dismiss();
    this.router.navigate(['/login']);
  }

  // ──────────────────────────────────────────────────────

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  switchLanguage(code: string): void {
    this.currentLang.set(code);
    localStorage.setItem('app_lang', code);
    this.translate.use(code);
  }
}

