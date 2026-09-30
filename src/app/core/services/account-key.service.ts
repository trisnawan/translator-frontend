import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../http/api.service';
import type {
  AccountKey,
  AccountKeyCreated,
  AccountKeyPayload,
  AccountKeyQuery,
  PagedResult,
} from '../models/api.models';

/**
 * API key management (`/account-keys`).
 *
 * Clients are always scoped to their own keys by the backend; admins may pass
 * `account_id` to inspect or create keys for a specific account. The plaintext
 * `secret_key` is only ever returned by {@link create}, which is why the UI
 * shows it exactly once.
 */
@Injectable({ providedIn: 'root' })
export class AccountKeyService {
  private readonly api = inject(ApiService);

  list(query: AccountKeyQuery = {}): Observable<PagedResult<AccountKey>> {
    return this.api.getPage<AccountKey>('/account-keys', { ...query });
  }

  detail(id: string): Observable<AccountKey> {
    return this.api.getOne<AccountKey>(`/account-keys/detail/${encodeURIComponent(id)}`);
  }

  create(payload: AccountKeyPayload): Observable<AccountKeyCreated> {
    return this.api.post<AccountKeyCreated>('/account-keys/insert', payload);
  }

  update(id: string, payload: AccountKeyPayload): Observable<AccountKey> {
    return this.api.put<AccountKey>(`/account-keys/update/${encodeURIComponent(id)}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete(`/account-keys/delete/${encodeURIComponent(id)}`);
  }
}
