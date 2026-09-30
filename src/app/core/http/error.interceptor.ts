import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { SessionStore } from '../auth/session.store';
import { ApiError } from './api-error';

/**
 * Converts every HTTP failure into an {@link ApiError} and reacts to expired
 * sessions.
 *
 * A `401` means the access token is missing, malformed or expired (see the
 * status-code table in `API_DOC.md`). When the panel holds a token but the API
 * rejects it, the session is discarded and the user is sent back to the login
 * screen with a `sessionExpired` flag so the form can explain what happened.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return next(request).pipe(
    catchError((response: unknown) => {
      const error = ApiError.from(response);

      if (
        error.isUnauthorized &&
        !request.url.endsWith('/auth/login') &&
        !request.url.endsWith('/auth/logout')
      ) {
        const hadSession = session.isAuthenticated();
        session.clear();

        if (hadSession) {
          void router.navigate(['/login'], {
            queryParams: { reason: 'session-expired' },
            replaceUrl: true,
          });
        }
      }

      return throwError(() => error);
    }),
  );
};

/** Narrow helper for tests and call sites holding an `unknown`. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Kept for exhaustiveness checks in components handling raw `HttpErrorResponse`. */
export type { HttpErrorResponse };
