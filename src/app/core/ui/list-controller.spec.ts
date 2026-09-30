import {
  DestroyRef,
  Injector,
  computed,
  runInInjectionContext,
  signal,
  type Signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../http/api-error';
import type { ListQuery, PagedResult } from '../models/api.models';
import { ListController } from './list-controller';

interface Row {
  id: string;
}

interface RowQuery extends ListQuery {
  status?: string;
}

function makePage(items: Row[], page = 1, limit = 10, total = items.length): PagedResult<Row> {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    },
  };
}

describe('ListController', () => {
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
  });

  /** Creates a connected controller inside an injection context. */
  function create(
    load: (query: RowQuery) => Observable<PagedResult<Row>>,
    filters?: Signal<Partial<RowQuery>>,
  ): ListController<Row, RowQuery> {
    return runInInjectionContext(injector, () => {
      const controller = new ListController<Row, RowQuery>(
        { load, ...(filters ? { filters } : {}) },
        TestBed.inject(DestroyRef),
      );
      controller.connect();
      return controller;
    });
  }

  /** `of()` resolves synchronously, so the first request has already happened. */
  const loadOnce = () =>
    vi.fn((query: RowQuery) =>
      of(makePage([{ id: 'a' }, { id: 'b' }], query.page ?? 1, query.limit ?? 10, 42)),
    );

  it('exposes items, meta and the row range of the current page', () => {
    const controller = create(loadOnce());

    expect(controller.items()).toHaveLength(2);
    expect(controller.total()).toBe(42);
    expect(controller.totalPages()).toBe(5);
    expect(controller.firstRow()).toBe(1);
    expect(controller.lastRow()).toBe(10);
    expect(controller.isEmpty()).toBe(false);
    expect(controller.loading()).toBe(false);
  });

  it('trims the search term, resets to page 1 and re-queries', () => {
    const load = loadOnce();
    const controller = create(load);

    controller.setPage(3);
    expect(load.mock.calls.at(-1)?.[0].page).toBe(3);

    controller.setSearch('  gemini  ');

    expect(controller.search()).toBe('gemini');
    expect(controller.page()).toBe(1);
    expect(load.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, search: 'gemini' });
  });

  it('ignores a repeated search term', () => {
    const load = loadOnce();
    const controller = create(load);

    controller.setSearch('same');
    const callsAfterFirst = load.mock.calls.length;
    controller.setSearch('same');

    expect(load.mock.calls.length).toBe(callsAfterFirst);
  });

  it('clamps page navigation to the available range', () => {
    const controller = create((query) => of(makePage([{ id: 'a' }], query.page ?? 1, 10, 25)));

    controller.setPage(99);
    expect(controller.page()).toBe(3);

    controller.setPage(-5);
    expect(controller.page()).toBe(1);
  });

  it('changes the page size and returns to the first page', () => {
    const load = loadOnce();
    const controller = create(load);

    controller.setPage(4);
    controller.setLimit(25);

    expect(controller.limit()).toBe(25);
    expect(controller.page()).toBe(1);
    expect(load.mock.calls.at(-1)?.[0].limit).toBe(25);
  });

  it('changes the sort order and returns to the first page', () => {
    const load = loadOnce();
    const controller = create(load);

    expect(controller.order()).toBe('desc');

    controller.setPage(2);
    controller.setOrder('asc');

    expect(controller.order()).toBe('asc');
    expect(controller.page()).toBe(1);
  });

  it('reports a failure through the error signal and clears the rows', () => {
    const controller = create(() => throwError(() => new ApiError('Driver not found', 404)));

    expect(controller.error()).toBe('Driver not found');
    expect(controller.items()).toEqual([]);
    expect(controller.loading()).toBe(false);
    expect(controller.isEmpty()).toBe(true);
  });

  it('merges the filters into every request and resets the page when they change', () => {
    const status = signal<string | undefined>('active');
    const load = loadOnce();

    const controller = create(
      load,
      computed(() => ({ status: status() })),
    );

    expect(load.mock.calls).toHaveLength(1);
    expect(load.mock.calls[0]?.[0].status).toBe('active');

    controller.setPage(2);
    status.set('inactive');
    controller.applyFilters();

    expect(load.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'inactive', page: 1 });
  });

  it('keeps the page offset when the filters are unchanged', () => {
    const status = signal<string | undefined>('active');
    const load = loadOnce();

    const controller = create(
      load,
      computed(() => ({ status: status() })),
    );

    controller.setPage(2);
    controller.applyFilters();

    expect(load.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'active', page: 2 });
  });

  it('builds an elided page window', () => {
    const controller = create((query) => of(makePage([{ id: 'a' }], query.page ?? 1, 10, 200)));

    controller.setPage(10);

    expect(controller.pageWindow()).toEqual([1, 'gap', 8, 9, 10, 11, 12, 'gap', 20]);
  });

  it('renders a single page number when everything fits on one page', () => {
    const controller = create(() => of(makePage([{ id: 'a' }], 1, 10, 3)));
    expect(controller.pageWindow()).toEqual([1]);
  });
});
