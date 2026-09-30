import { Injectable, computed, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { ApiService } from '../http/api.service';
import type { Account, LoginPayload, LoginResult } from '../models/api.models';
import { SessionStore } from '../auth/session.store';

/**
 * Authentication against `POST /auth/login`, `GET /access-token`,
 * `GET /auth/me` and `POST /auth/logout`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);

  readonly account = this.session.account;
  readonly isAuthenticated = this.session.isAuthenticated;
  readonly isAdmin = this.session.isAdmin;

  /** Two-letter initials used by the avatar placeholder. */
  readonly initials = computed(() => initialsOf(this.session.account()?.full_name));

  /** Signs in and stores the issued access token. */
  login(payload: LoginPayload): Observable<LoginResult> {
    return this.api
      .post<LoginResult>('/auth/login', payload)
      .pipe(
        tap((result) =>
          this.session.setSession(result.access_token, result.account, result.expires_at),
        ),
      );
  }

  /**
   * Revalidates the stored token against `GET /auth/me`, refreshing the cached
   * profile. Resolves to `false` instead of throwing when the token is rejected,
   * so the app initializer can simply drop the session.
   */
  restoreSession(): Observable<boolean> {
    if (!this.session.isAuthenticated()) {
      return of(false);
    }

    return this.api.getOne<Account>('/auth/me').pipe(
      tap((account) => this.session.setAccount(account)),
      map(() => true),
      catchError(() => {
        this.session.clear();
        return of(false);
      }),
    );
  }

  /** Issues a fresh access token for the current session. */
  refreshToken(): Observable<LoginResult> {
    return this.api
      .getOne<LoginResult>('/access-token')
      .pipe(
        tap((result) =>
          this.session.setSession(result.access_token, result.account, result.expires_at),
        ),
      );
  }

  /** Reloads the signed-in profile. */
  loadProfile(): Observable<Account> {
    return this.api
      .getOne<Account>('/auth/me')
      .pipe(tap((account) => this.session.setAccount(account)));
  }

  /**
   * Clears the server cookie and the local session.
   *
   * The token stays valid until it expires (stateless JWT), which is why the
   * local copy is dropped even when the API call fails.
   */
  logout(): Observable<void> {
    return this.api.post<null>('/auth/logout').pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      tap(() => this.session.clear()),
    );
  }

  /** Local-only teardown used when the API rejects the token. */
  clearSession(): void {
    this.session.clear();
  }
}

function initialsOf(fullName: string | undefined): string {
  if (!fullName) {
    return '?';
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts.at(0)?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';

  return (first + last).toUpperCase() || '?';
}
