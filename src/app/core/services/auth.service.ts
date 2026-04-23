import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';
import { IAuthTokens } from '@core/models/auth.interface';
import { LoginPayloadModel } from '@core/models/login-payload.model';

@Injectable({ providedIn: 'root' })
export class AuthService extends HttpHelper {
  public login(payload: LoginPayloadModel): Observable<IAuthTokens> {
    return this.httpPostRequest('api/auth/login/', payload);
  }

  public logout(): Observable<void> {
    return this.httpPostRequest('api/auth/logout/', null);
  }

  public refreshToken(refreshToken: string): Observable<IAuthTokens> {
    return this.httpPostRequest('api/auth/refresh-token/', {
      refresh_token: refreshToken,
    });
  }
}
