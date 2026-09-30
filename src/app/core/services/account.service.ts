import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../http/api.service';
import type { Account, AccountPayload, AccountQuery, PagedResult } from '../models/api.models';

/**
 * Admin-only account management: `/accounts` list, detail, insert, update and
 * delete.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly api = inject(ApiService);

  list(query: AccountQuery = {}): Observable<PagedResult<Account>> {
    return this.api.getPage<Account>('/accounts', { ...query });
  }

  detail(id: string): Observable<Account> {
    return this.api.getOne<Account>(`/accounts/detail/${encodeURIComponent(id)}`);
  }

  create(payload: AccountPayload): Observable<Account> {
    return this.api.post<Account>('/accounts/insert', payload);
  }

  update(id: string, payload: AccountPayload): Observable<Account> {
    return this.api.put<Account>(`/accounts/update/${encodeURIComponent(id)}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete(`/accounts/delete/${encodeURIComponent(id)}`);
  }
}
