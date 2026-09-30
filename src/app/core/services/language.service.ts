import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../http/api.service';
import type { Language, LanguagePayload, LanguageQuery, PagedResult } from '../models/api.models';

/**
 * `GET /languages` for both roles plus the admin-only
 * `POST /languages/insert` and `PUT /languages/update/{ID}`.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly api = inject(ApiService);

  list(query: LanguageQuery = {}): Observable<PagedResult<Language>> {
    return this.api.getPage<Language>('/languages', { ...query });
  }

  create(payload: LanguagePayload): Observable<Language> {
    return this.api.post<Language>('/languages/insert', payload);
  }

  update(id: string, payload: LanguagePayload): Observable<Language> {
    return this.api.put<Language>(`/languages/update/${encodeURIComponent(id)}`, payload);
  }
}
