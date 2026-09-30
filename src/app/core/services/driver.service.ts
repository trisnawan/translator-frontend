import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../http/api.service';
import type { Driver, DriverPayload, DriverQuery, PagedResult } from '../models/api.models';

/**
 * `GET /drivers` for both roles (clients only see granted drivers) plus the
 * admin-only insert / update / delete endpoints.
 */
@Injectable({ providedIn: 'root' })
export class DriverService {
  private readonly api = inject(ApiService);

  list(query: DriverQuery = {}): Observable<PagedResult<Driver>> {
    return this.api.getPage<Driver>('/drivers', { ...query });
  }

  create(payload: DriverPayload): Observable<Driver> {
    return this.api.post<Driver>('/drivers/insert', payload);
  }

  update(id: string, payload: DriverPayload): Observable<Driver> {
    return this.api.put<Driver>(`/drivers/update/${encodeURIComponent(id)}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete(`/drivers/delete/${encodeURIComponent(id)}`);
  }
}
