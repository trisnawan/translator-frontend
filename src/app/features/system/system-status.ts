import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type { AppInfo, HealthInfo } from '../../core/models/api.models';
import { ApiError } from '../../core/http/api-error';
import { SystemService } from '../../core/services/system.service';
import { formatDateTime, formatDuration } from '../../core/utils/format';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

/**
 * `GET /` and `GET /health` — application metadata and dependency status.
 *
 * Both endpoints are public, but the screen only makes sense inside the panel so
 * it sits behind `authGuard` with the rest of the layout.
 */
@Component({
  selector: 'app-system-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, StatusBadge, RouterLink],
  template: `
    <app-page-header
      title="System Status"
      subtitle="Backend metadata and live dependency checks."
      [crumbs]="crumbs"
    />

    <div class="d-flex justify-content-end mb-3">
      <button type="button" class="btn btn-light" [disabled]="loading()" (click)="reload()">
        @if (loading()) {
          <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
        } @else {
          <i class="ph ph-arrow-clockwise me-1" aria-hidden="true"></i>
        }
        Refresh
      </button>
    </div>

    @if (error(); as message) {
      <div class="alert alert-danger d-flex align-items-start gap-2" role="alert">
        <i class="ph ph-warning-circle mt-1" aria-hidden="true"></i>
        <span>{{ message }}</span>
      </div>
    }

    <div class="row g-4">
      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header">
            <h5 class="card-title mb-0">Application</h5>
          </div>
          <div class="card-body">
            @if (info(); as app) {
              <dl class="row mb-0">
                <dt class="col-5 text-muted fw-normal">Name</dt>
                <dd class="col-7">{{ app.name }}</dd>

                <dt class="col-5 text-muted fw-normal">Description</dt>
                <dd class="col-7">{{ app.description }}</dd>

                <dt class="col-5 text-muted fw-normal">Version</dt>
                <dd class="col-7">
                  <span class="badge badge-soft-secondary">{{ app.version }}</span>
                </dd>

                <dt class="col-5 text-muted fw-normal">Environment</dt>
                <dd class="col-7">
                  <span class="badge badge-soft-info">{{ app.environment }}</span>
                </dd>

                <dt class="col-5 text-muted fw-normal">Timezone</dt>
                <dd class="col-7">{{ app.timezone }}</dd>

                <dt class="col-5 text-muted fw-normal">Server time</dt>
                <dd class="col-7 mb-0">{{ format(app.time) }}</dd>
              </dl>
            } @else {
              <p class="text-muted mb-0">
                <span
                  class="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Loading application info…
              </p>
            }
          </div>
        </div>
      </div>

      <div class="col-lg-6">
        <div class="card h-100">
          <div class="card-header">
            <h5 class="card-title mb-0">Health</h5>
          </div>
          <div class="card-body">
            @if (health(); as status) {
              <dl class="row mb-0">
                <dt class="col-5 text-muted fw-normal">Overall status</dt>
                <dd class="col-7">
                  <span
                    class="badge"
                    [class]="status.status === 'ok' ? 'badge-soft-success' : 'badge-soft-warning'"
                  >
                    {{ status.status }}
                  </span>
                </dd>

                <dt class="col-5 text-muted fw-normal">Database</dt>
                <dd class="col-7"><app-status-badge [value]="status.dependencies.database" /></dd>

                <dt class="col-5 text-muted fw-normal">Broker</dt>
                <dd class="col-7"><app-status-badge [value]="status.dependencies.broker" /></dd>

                <dt class="col-5 text-muted fw-normal">Uptime</dt>
                <dd class="col-7">{{ uptime() }}</dd>

                <dt class="col-5 text-muted fw-normal">Checked at</dt>
                <dd class="col-7 mb-0">{{ format(status.timestamp) }}</dd>
              </dl>

              @if (status.dependencies.broker === 'down') {
                <div class="alert alert-warning mt-3 mb-0 small" role="alert">
                  The broker is down: translation and callback jobs stay queued until it recovers.
                </div>
              }
            } @else {
              <p class="text-muted mb-0">
                <span
                  class="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Running health check…
              </p>
            }
          </div>
        </div>
      </div>
    </div>

    <p class="text-muted small mt-4 mb-0">
      Need credentials? Head over to <a routerLink="/account-keys">API Keys</a>.
    </p>
  `,
})
export class SystemStatus {
  private readonly system = inject(SystemService);

  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'System Status' }];
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<AppInfo | null>(null);
  protected readonly health = signal<HealthInfo | null>(null);
  protected readonly uptime = computed(() => {
    const health = this.health();
    return health ? formatDuration(health.uptime) : '—';
  });

  constructor() {
    this.reload();
  }

  protected format(value: string): string {
    return formatDateTime(value);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      info: this.system.appInfo(),
      health: this.system.health(),
    }).subscribe({
      next: ({ info, health }) => {
        this.info.set(info);
        this.health.set(health);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(ApiError.from(error).message);
        this.loading.set(false);
      },
    });
  }
}
