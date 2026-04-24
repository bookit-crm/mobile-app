import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN);
  if (token) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
