import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  public intercept<T>(req: HttpRequest<T>, next: HttpHandler): Observable<HttpEvent<T>> {
    const url = req.url.startsWith('api/')
      ? req.url.replace('api', environment.be_url)
      : req.url;

    return next.handle(req.clone({ url }));
  }
}
