import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { switchMap, take } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
import { ValidatorsHelper } from '@core/helpers/validators.helper';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
})
export class LoginPage implements OnInit, ViewWillEnter {
  public loginForm!: FormGroup;
  public showPassword = false;
  public isLoading = false;
  public errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  public ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.pattern(ValidatorsHelper.userEmailReg)]],
      password: ['', [Validators.required]],
      remember_me: [false],
    });
  }

  public ionViewWillEnter(): void {
    this.isLoading = false;
    this.errorMessage = '';
  }

  public get emailControl() {
    return this.loginForm.get('email');
  }

  public get passwordControl() {
    return this.loginForm.get('password');
  }

  public get emailHasError(): boolean {
    const c = this.emailControl;
    return !!(c && c.invalid && c.touched);
  }

  public get passwordHasError(): boolean {
    const c = this.passwordControl;
    return !!(c && c.invalid && c.touched);
  }

  public togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  public handleLogin(): void {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.getRawValue();

    this.authService
      .activate({ email, password })
      .pipe(
        switchMap((config) =>
          this.authService.login({
            email,
            password,
            dataBaseId: config.database_id,
          }),
        ),
        take(1),
      )
      .subscribe({
        next: (res) => {
          localStorage.setItem(ELocalStorageKeys.AUTH_TOKEN, res.auth_token);
          localStorage.setItem(ELocalStorageKeys.REFRESH_TOKEN, res.refresh_token);
          this.router.navigate(['/main']);
        },
        error: (err) => {
          this.isLoading = false;
          console.error('[Login error]', err);
          const status = err?.status;
          const msg = err?.error?.message;
          this.errorMessage = msg
            ? `${status}: ${msg}`
            : `Error ${status ?? '—'}: ${err?.message ?? 'Unknown error'}`;
        },
      });
  }
}
