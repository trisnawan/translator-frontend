import { Injectable, computed, signal } from '@angular/core';

import type { Account, AccountRole } from '../models/api.models';

const TOKEN_KEY = 'translator.access_token';
const EXPIRES_KEY = 'translator.access_token_expires_at';
const ACCOUNT_KEY = 'translator.account';

/**
 * Holds the signed-in account and access token.
 *
 * Kept deliberately free of HTTP concerns so both `authInterceptor` and
 * `AuthService` can depend on it without creating a DI cycle. The token mirrors
 * to `localStorage` so a page refresh keeps the session alive.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly tokenSignal = signal<string | null>(read(TOKEN_KEY));
  private readonly expiresAtSignal = signal<string | null>(read(EXPIRES_KEY));
  private readonly accountSignal = signal<Account | null>(readJson<Account>(ACCOUNT_KEY));

  readonly token = this.tokenSignal.asReadonly();
  readonly expiresAt = this.expiresAtSignal.asReadonly();
  readonly account = this.accountSignal.asReadonly();

  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly role = computed<AccountRole | null>(() => this.accountSignal()?.role ?? null);
  readonly isAdmin = computed(() => this.accountSignal()?.role === 'admin');

  /** True when a stored token has passed its `expires_at` timestamp. */
  readonly isExpired = computed(() => {
    const expiresAt = this.expiresAtSignal();
    return expiresAt !== null && Date.parse(expiresAt) <= Date.now();
  });

  /** Persists a successful login / access-token refresh. */
  setSession(token: string, account: Account, expiresAt: string): void {
    this.tokenSignal.set(token);
    this.expiresAtSignal.set(expiresAt);
    this.accountSignal.set(account);

    write(TOKEN_KEY, token);
    write(EXPIRES_KEY, expiresAt);
    write(ACCOUNT_KEY, JSON.stringify(account));
  }

  /** Refreshes the cached profile without touching the token. */
  setAccount(account: Account): void {
    this.accountSignal.set(account);
    write(ACCOUNT_KEY, JSON.stringify(account));
  }

  /** Drops every trace of the session (logout, 401, expired token). */
  clear(): void {
    this.tokenSignal.set(null);
    this.expiresAtSignal.set(null);
    this.accountSignal.set(null);

    remove(TOKEN_KEY);
    remove(EXPIRES_KEY);
    remove(ACCOUNT_KEY);
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  const raw = read(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable - session stays in memory only */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}
