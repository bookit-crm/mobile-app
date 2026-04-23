import { Injectable, NgZone } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpHeaders,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, finalize, switchMap, take } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
import { IAuthTokens } from '@core/models/auth.interface';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
  ) {}

  public intercept<T>(req: HttpRequest<T>, next: HttpHandler): Observable<HttpEvent<T>> {
    if (req.url.includes('auth/refresh-token')) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error) => {
        if (error.status !== 401) {
          return throwError(() => error);
        }

        const refreshToken = localStorage.getItem(ELocalStorageKeys.REFRESH_TOKEN);

        if (!refreshToken) {
          this.redirectToLogin();
          return throwError(() => error);
        }

        if (!this.isRefreshing) {
          this.isRefreshing = true;
          this.refreshTokenSubject.next(null);

          return this.authService.refreshToken(refreshToken).pipe(
            switchMap((res: IAuthTokens) => {
              localStorage.setItem(ELocalStorageKeys.AUTH_TOKEN, res.auth_token);
              localStorage.setItem(ELocalStorageKeys.REFRESH_TOKEN, res.refresh_token);
              this.refreshTokenSubject.next(res.auth_token);
              return next.handle(this.attachToken(req, res.auth_token));
            }),
            catchError((refreshError) => {
              if (refreshError.status === 401) {
                localStorage.clear();
                this.redirectToLogin();
              }
              return throwError(() => refreshError);
            }),
            finalize(() => {
              this.isRefreshing = false;
            }),
          );
        }

        return this.refreshTokenSubject.pipe(
          filter((token) => token != null),
          take(1),
          switchMap((token) => next.handle(this.attachToken(req, token!))),
        );
      }),
    );
  }

  private attachToken<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
    return req.clone({
      headers: new HttpHeaders().set('Authorization', `Bearer ${token}`),
    });
  }

  private redirectToLogin(): void {
    this.ngZone.run(() => this.router.navigate(['/login']));
  }
}
