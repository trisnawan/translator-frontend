import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('unwraps the data field of a single resource', () => {
    let received: unknown;

    service
      .getOne<{ id: string; name: string }>('/languages/en')
      .subscribe((value) => (received = value));

    const request = http.expectOne(`${environment.apiBaseUrl}/languages/en`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'ok', data: { id: 'en', name: 'English' } });

    expect(received).toEqual({ id: 'en', name: 'English' });
  });

  it('returns items together with the pagination meta', () => {
    let received: { items: unknown[]; meta: { total: number } } | undefined;

    service.getPage<{ id: string }>('/languages').subscribe((value) => (received = value));

    http.expectOne(`${environment.apiBaseUrl}/languages`).flush({
      success: true,
      message: 'ok',
      data: [{ id: 'id' }, { id: 'en' }],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1, hasNext: false, hasPrevious: false },
    });

    expect(received?.items).toHaveLength(2);
    expect(received?.meta.total).toBe(2);
  });

  it('drops empty query values and keeps the remainder', () => {
    service
      .getPage('/histories', {
        page: 2,
        limit: 25,
        search: '',
        status: 'translated',
        driver_id: undefined,
        account_id: null,
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiBaseUrl}/histories` &&
        candidate.params.get('page') === '2' &&
        candidate.params.get('status') === 'translated',
    );

    expect(request.request.params.has('search')).toBe(false);
    expect(request.request.params.has('driver_id')).toBe(false);
    expect(request.request.params.has('account_id')).toBe(false);
    request.flush({ success: true, message: 'ok', data: [] });
  });

  it('falls back to an empty page when a list response has no meta', () => {
    let total: number | undefined;

    service.getPage<{ id: string }>('/languages').subscribe((value) => (total = value.meta.total));

    http.expectOne(`${environment.apiBaseUrl}/languages`).flush({
      success: true,
      message: 'ok',
      data: [{ id: 'id' }],
    });

    expect(total).toBe(1);
  });

  it('emits undefined for DELETE responses that carry data: null', () => {
    let emitted = false;

    service.delete('/languages/delete/en').subscribe((value) => {
      emitted = true;
      expect(value).toBeUndefined();
    });

    http.expectOne(`${environment.apiBaseUrl}/languages/delete/en`).flush({
      success: true,
      message: 'deleted',
      data: null,
    });

    expect(emitted).toBe(true);
  });
});
