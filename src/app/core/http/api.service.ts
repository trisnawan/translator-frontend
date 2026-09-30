import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiResponse, PageMeta, PagedResult } from '../models/api.models';

/** Values accepted by {@link ApiService} query objects. */
type QueryValue = string | number | boolean | null | undefined;

/** Page result used when a list endpoint returns no `meta` block at all. */
const EMPTY_PAGE: PageMeta = {
  page: 1,
  limit: environment.defaultPageSize,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

/**
 * Single entry point for the Translator REST API.
 *
 * The service owns three concerns so feature services stay thin:
 * - building absolute URLs from `environment.apiBaseUrl`;
 * - dropping empty query parameters (`page`, `limit`, `search`, filters…);
 * - unwrapping the `{ success, message, data, meta }` envelope.
 *
 * Failures are surfaced as `ApiError` instances thanks to `errorInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** `GET` returning one resource. */
  getOne<T>(path: string, query?: QueryValueMap): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), { params: toHttpParams(query) })
      .pipe(map((response) => response.data));
  }

  /** `GET` returning a page of resources together with its pagination meta. */
  getPage<T>(path: string, query?: QueryValueMap): Observable<PagedResult<T>> {
    return this.http.get<ApiResponse<T[]>>(this.url(path), { params: toHttpParams(query) }).pipe(
      map((response) => ({
        items: response.data ?? [],
        meta: response.meta ?? { ...EMPTY_PAGE, total: response.data?.length ?? 0 },
      })),
    );
  }

  /** `POST` returning the created resource. */
  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), body ?? {})
      .pipe(map((response) => response.data));
  }

  /** `PUT` returning the updated resource. */
  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .put<ApiResponse<T>>(this.url(path), body ?? {})
      .pipe(map((response) => response.data));
  }

  /** `DELETE`; the API returns `data: null`. */
  delete(path: string): Observable<void> {
    return this.http.delete<ApiResponse<null>>(this.url(path)).pipe(map(() => undefined));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

/** Object form of a query string; empty entries are stripped before sending. */
export type QueryValueMap = Record<string, QueryValue>;

function toHttpParams(query?: QueryValueMap): HttpParams {
  let params = new HttpParams();

  if (!query) {
    return params;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    params = params.set(key, String(value));
  }

  return params;
}
