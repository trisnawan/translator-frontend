import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { SessionStore } from '../auth/session.store';

/**
 * Attaches `Authorization: Bearer <access_token>` to every request aimed at the
 * Translator API.
 *
 * The backend also accepts an httpOnly `access_token` cookie, but that only
 * works same-origin while the panel is served from a different port. The bearer
 * header is therefore the primary mechanism; both are documented as equivalent.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore);
  const token = session.token();

  if (!token || !request.url.startsWith(environment.apiBaseUrl)) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
