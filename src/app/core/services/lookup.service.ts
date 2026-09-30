import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, of, tap } from 'rxjs';

import { AccountService } from './account.service';
import { DriverService } from './driver.service';
import { LanguageService } from './language.service';
import type { Account, Driver, Language } from '../models/api.models';

/** The API caps `limit` at 100, which is plenty for a filter dropdown. */
const LOOKUP_LIMIT = 100;

/**
 * Cached reference data for `<select>` filters and pickers.
 *
 * Several screens need the same option lists (languages, drivers, accounts).
 * Loading them once and sharing the result avoids repeating the request every
 * time a filter panel opens. `refresh()` is available for explicit invalidation,
 * e.g. after a driver is renamed.
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly languagesApi = inject(LanguageService);
  private readonly driversApi = inject(DriverService);
  private readonly accountsApi = inject(AccountService);

  private readonly languagesSignal = signal<Language[]>([]);
  private readonly driversSignal = signal<Driver[]>([]);
  private readonly accountsSignal = signal<Account[]>([]);
  private readonly loadedSignal = signal(false);

  readonly languages = this.languagesSignal.asReadonly();
  readonly drivers = this.driversSignal.asReadonly();
  readonly accounts = this.accountsSignal.asReadonly();

  /** Languages offered by a picker: active codes only, sorted by name. */
  readonly activeLanguages = computed(() =>
    this.languagesSignal()
      .filter((language) => language.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly activeDrivers = computed(() =>
    this.driversSignal()
      .filter((driver) => driver.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly sortedAccounts = computed(() =>
    [...this.accountsSignal()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
  );

  /** Loads every list once per session; subsequent calls are no-ops. */
  ensureLoaded(options: { accounts?: boolean } = {}): Observable<unknown> {
    if (this.loadedSignal()) {
      return of(null);
    }

    return this.fetch(options.accounts === true);
  }

  /** Drops the cache and re-queries the API on the next call. */
  refresh(): Observable<unknown> {
    this.loadedSignal.set(false);
    return this.fetch(true);
  }

  private fetch(includeAccounts: boolean): Observable<unknown> {
    return forkJoin({
      languages: this.languagesApi.list({ limit: LOOKUP_LIMIT, order: 'asc' }),
      drivers: this.driversApi.list({ limit: LOOKUP_LIMIT, order: 'asc' }),
      accounts: includeAccounts
        ? this.accountsApi.list({ limit: LOOKUP_LIMIT, order: 'asc' })
        : of(null),
    }).pipe(
      tap(({ languages, drivers, accounts }) => {
        this.languagesSignal.set(languages.items);
        this.driversSignal.set(drivers.items);

        if (accounts) {
          this.accountsSignal.set(accounts.items);
        }

        this.loadedSignal.set(true);
      }),
    );
  }
}
