import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../http/api.service';
import type {
  AccountDriver,
  AccountDriverPayload,
  AccountDriverQuery,
  PagedResult,
} from '../models/api.models';

/**
 * Admin-only driver grants (`/account-drivers`). Without a matching row here a
 * client request is refused with `403`.
 */
@Injectable({ providedIn: 'root' })
export class AccountDriverService {
  private readonly api = inject(ApiService);

  list(query: AccountDriverQuery = {}): Observable<PagedResult<AccountDriver>> {
    return this.api.getPage<AccountDriver>('/account-drivers', { ...query });
  }

  create(payload: AccountDriverPayload): Observable<AccountDriver> {
    return this.api.post<AccountDriver>('/account-drivers/insert', payload);
  }

  update(id: string, payload: AccountDriverPayload): Observable<AccountDriver> {
    return this.api.put<AccountDriver>(
      `/account-drivers/update/${encodeURIComponent(id)}`,
      payload,
    );
  }

  remove(id: string): Observable<void> {
    return this.api.delete(`/account-drivers/delete/${encodeURIComponent(id)}`);
  }
}
