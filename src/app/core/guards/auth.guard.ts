import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? Date.now() / 1000 > payload.exp : false;
  } catch {
    return true;
  }
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN);

  if (!token || isTokenExpired(token)) {
    localStorage.clear();
    return router.createUrlTree(['/login']);
  }

  return true;
};
