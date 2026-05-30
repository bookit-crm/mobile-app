import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, finalize } from 'rxjs';
import { LoaderService } from '@core/services/loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  private readonly loaderService = inject(LoaderService);

  intercept<T>(req: HttpRequest<T>, next: HttpHandler): Observable<HttpEvent<T>> {
    if (req.headers.get('X-Skip-Loader')) {
      return next.handle(req);
    }

    this.loaderService.show();

    return next.handle(req).pipe(finalize(() => this.loaderService.hide()));
  }
}
