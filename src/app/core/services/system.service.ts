import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../http/api.service';
import type { AppInfo, HealthInfo } from '../models/api.models';

/**
 * Public diagnostics endpoints: `GET /` (application info) and `GET /health`
 * (database + broker status).
 */
@Injectable({ providedIn: 'root' })
export class SystemService {
  private readonly api = inject(ApiService);

  appInfo(): Observable<AppInfo> {
    return this.api.getOne<AppInfo>('/');
  }

  health(): Observable<HealthInfo> {
    return this.api.getOne<HealthInfo>('/health');
  }
}
