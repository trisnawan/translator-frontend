import { DestroyRef, computed, signal, type Signal } from '@angular/core';
import { Observable, Subject, catchError, of, startWith, switchMap, tap } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';
import type { ListQuery, PageMeta, PagedResult, SortOrder } from '../models/api.models';

export interface ListControllerOptions<TItem, TQuery extends ListQuery> {
  /** Calls the matching `GET /…` list endpoint. */
  load: (query: TQuery) => Observable<PagedResult<TItem>>;
  /**
   * Extra filters merged into every request (status, role, driver…). Declared as
   * a signal so the page can rebuild it from several primitives; call
   * {@link ListController.applyFilters} after mutating it.
   */
  filters?: Signal<Partial<TQuery>>;
  /** Initial page size; defaults to `environment.defaultPageSize`. */
  limit?: number;
}

/**
 * Client-side state for a paginated, searchable, server-sorted list screen.
 *
 * Every list page shares the same behaviour — page, page size, search term,
 * sort order, loading/error flags, and "reset to page 1 whenever a filter
 * changes" — so that logic lives here instead of being duplicated eight times.
 * `switchMap` guarantees that only the newest response can mutate the state.
 */
export class ListController<TItem, TQuery extends ListQuery = ListQuery> {
  private readonly refresh$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  private readonly pageSignal = signal(1);
  private readonly limitSignal = signal(environment.defaultPageSize);
  private readonly searchSignal = signal('');
  private readonly orderSignal = signal<SortOrder>('desc');
  private readonly itemsSignal = signal<TItem[]>([]);
  private readonly metaSignal = signal<PageMeta | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly page = this.pageSignal.asReadonly();
  readonly limit = this.limitSignal.asReadonly();
  readonly search = this.searchSignal.asReadonly();
  readonly order = this.orderSignal.asReadonly();
  readonly items = this.itemsSignal.asReadonly();
  readonly meta = this.metaSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly total = computed(() => this.metaSignal()?.total ?? 0);
  readonly totalPages = computed(() => this.metaSignal()?.totalPages ?? 0);
  readonly isEmpty = computed(() => !this.loadingSignal() && this.itemsSignal().length === 0);
  readonly firstRow = computed(() =>
    this.total() === 0 ? 0 : (this.pageSignal() - 1) * this.limitSignal() + 1,
  );
  readonly lastRow = computed(() => Math.min(this.pageSignal() * this.limitSignal(), this.total()));
  readonly pageWindow = computed(() => pageWindow(this.pageSignal(), this.totalPages()));
  readonly pageSizeOptions = environment.pageSizeOptions;

  private readonly options: ListControllerOptions<TItem, TQuery>;
  /** Signature of the filters used by the last request, to detect changes. */
  private appliedFilters = '';

  constructor(options: ListControllerOptions<TItem, TQuery>, destroyRef: DestroyRef) {
    this.options = options;

    if (options.limit) {
      this.limitSignal.set(options.limit);
    }

    destroyRef.onDestroy(() => {
      this.destroy$.next();
      this.destroy$.complete();
      this.refresh$.complete();
    });
  }

  /** Subscribes to the query pipeline. Call once, from the component constructor. */
  connect(): void {
    this.refresh$
      .pipe(
        startWith(undefined),
        switchMap(() => this.request()),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  /** Re-runs the current query. */
  reload(): void {
    this.refresh$.next();
  }

  /**
   * Called by the filter inputs after updating the `filters` signal.
   *
   * The page offset is reset inside {@link buildQuery} only when the filter
   * signature actually changed, so this stays a plain, synchronous call — no
   * change-detection timing involved.
   */
  applyFilters(): void {
    this.reload();
  }

  setSearch(term: string): void {
    const next = term.trim();
    if (next === this.searchSignal()) {
      return;
    }

    this.searchSignal.set(next);
    this.pageSignal.set(1);
    this.reload();
  }

  setOrder(order: SortOrder): void {
    if (order === this.orderSignal()) {
      return;
    }

    this.orderSignal.set(order);
    this.pageSignal.set(1);
    this.reload();
  }

  setPage(page: number): void {
    const target = Math.min(Math.max(page, 1), Math.max(this.totalPages(), 1));
    if (target === this.pageSignal()) {
      return;
    }

    this.pageSignal.set(target);
    this.reload();
  }

  setLimit(limit: number): void {
    if (limit === this.limitSignal()) {
      return;
    }

    this.limitSignal.set(limit);
    this.pageSignal.set(1);
    this.reload();
  }

  /** Resets the page offset and re-queries; used when a filter changes. */
  resetToFirstPage(): void {
    this.pageSignal.set(1);
    this.reload();
  }

  private request(): Observable<PagedResult<TItem> | null> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.options.load(this.buildQuery()).pipe(
      tap((result) => {
        this.itemsSignal.set(result.items);
        this.metaSignal.set(result.meta);
        this.loadingSignal.set(false);
      }),
      catchError((error: unknown) => {
        this.errorSignal.set(ApiError.from(error).message);
        this.itemsSignal.set([]);
        this.metaSignal.set(null);
        this.loadingSignal.set(false);
        return of(null);
      }),
    );
  }

  private buildQuery(): TQuery {
    const filters = this.options.filters?.() ?? {};
    const signature = JSON.stringify(filters);

    // Changing a filter invalidates the current offset; keep the reset here so a
    // page can never forget it.
    if (signature !== this.appliedFilters) {
      this.appliedFilters = signature;
      this.pageSignal.set(1);
    }

    return {
      page: this.pageSignal(),
      limit: this.limitSignal(),
      search: this.searchSignal() || undefined,
      order: this.orderSignal(),
      ...filters,
    } as TQuery;
  }
}

/** Elided pagination run: `1 … 4 5 6 … 20`. */
function pageWindow(current: number, totalPages: number, span = 2): (number | 'gap')[] {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }

  const pages = new Set<number>([1, totalPages]);

  for (let page = current - span; page <= current + span; page++) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) {
      result.push('gap');
    }
    result.push(page);
  });

  return result;
}
