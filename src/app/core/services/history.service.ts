import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../http/api.service';
import type { History, HistoryQuery, PagedResult } from '../models/api.models';

/**
 * Translation history (`/histories`).
 *
 * Admin-only operations (`retranslate`, `delete`) live here as well so the
 * feature module only depends on a single service.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly api = inject(ApiService);

  list(query: HistoryQuery = {}): Observable<PagedResult<History>> {
    return this.api.getPage<History>('/histories', { ...query });
  }

  detail(id: string): Observable<History> {
    return this.api.getOne<History>(`/histories/detail/${encodeURIComponent(id)}`);
  }

  /** Re-opens the callback and re-queues it — available to admins and owners. */
  resendCallback(id: string): Observable<History> {
    return this.api.post<History>(`/histories/resend-callback/${encodeURIComponent(id)}`);
  }

  /** Admin only: resets the job to `requested` and queues a new translation. */
  retranslate(id: string): Observable<History> {
    return this.api.post<History>(`/histories/retranslate/${encodeURIComponent(id)}`);
  }

  /** Admin only: deletes the job permanently. */
  remove(id: string): Observable<void> {
    return this.api.delete(`/histories/delete/${encodeURIComponent(id)}`);
  }
}
