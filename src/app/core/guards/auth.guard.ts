import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import type { AccountRole } from '../models/api.models';

/**
 * Blocks anonymous access and remembers where the user was heading, so login can
 * bounce them back with `?redirect=…`.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: state.url === '/' ? undefined : { redirect: state.url },
  });
};

/** Keeps a signed-in user away from the login screen. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

/**
 * Restricts a route to the given roles.
 *
 * The backend enforces the same rules (403), so this guard exists to keep the UI
 * honest rather than to be the security boundary.
 */
export function roleGuard(...roles: AccountRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.account()?.role;

    if (role && roles.includes(role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}
