import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../core/http/api-error';
import { SessionStore } from '../../core/auth/session.store';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import type { Account } from '../../core/models/api.models';
import { formatDateTime, formatQuota, initialsOf } from '../../core/utils/format';
import { CopyField } from '../../shared/ui/copy-field/copy-field';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

/**
 * `GET /auth/me` plus `GET /access-token` (token refresh).
 *
 * The screen deliberately avoids any edit form: the API exposes no self-service
 * profile update, so changes go through an admin editing the account.
 */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, StatusBadge, CopyField, RouterLink],
  template: `
    <app-page-header
      title="My Profile"
      subtitle="Details of the account behind this session."
      [crumbs]="crumbs"
    >
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
        Reload
      </button>

      <button
        type="button"
        class="btn btn-primary"
        [disabled]="refreshing()"
        (click)="refreshToken()"
      >
        @if (refreshing()) {
          <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
        } @else {
          <i class="ph ph-arrows-clockwise me-1" aria-hidden="true"></i>
        }
        Refresh access token
      </button>
    </app-page-header>

    @if (error(); as message) {
      <div class="alert alert-danger mt-4 d-flex align-items-start gap-2" role="alert">
        <i class="ph ph-warning-circle mt-1" aria-hidden="true"></i>
        <span>{{ message }}</span>
      </div>
    }

    @if (account(); as profile) {
      <div class="row g-4 mt-1">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-body text-center">
              <span class="profile-avatar">{{ initials(profile.full_name) }}</span>
              <h5 class="mt-3 mb-1">{{ profile.full_name }}</h5>
              <p class="text-muted small mb-3">{{ profile.email }}</p>

              <div class="d-flex justify-content-center gap-2">
                <app-status-badge [value]="profile.role" />
                <app-status-badge [value]="profile.status" />
              </div>

              @if (profile.status === 'inactive') {
                <div class="alert alert-warning mt-3 mb-0 small text-start" role="alert">
                  This account is inactive: every API call is rejected with <code>403</code> until
                  an admin re-enables it.
                </div>
              }
            </div>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Account details</h5>
            </div>
            <div class="card-body">
              <dl class="row mb-4">
                <dt class="col-sm-4 text-muted fw-normal">Full name</dt>
                <dd class="col-sm-8">{{ profile.full_name }}</dd>

                <dt class="col-sm-4 text-muted fw-normal">Email</dt>
                <dd class="col-sm-8">{{ profile.email }}</dd>

                <dt class="col-sm-4 text-muted fw-normal">Role</dt>
                <dd class="col-sm-8">
                  {{ profile.role === 'admin' ? 'Administrator' : 'Client' }}
                </dd>

                <dt class="col-sm-4 text-muted fw-normal">Rate limit</dt>
                <dd class="col-sm-8">
                  {{ quota(profile.max_rpm) }} requests / minute ·
                  {{ quota(profile.max_rpd) }} requests / day
                </dd>

                <dt class="col-sm-4 text-muted fw-normal">Created</dt>
                <dd class="col-sm-8">{{ format(profile.created_at) }}</dd>

                <dt class="col-sm-4 text-muted fw-normal">Last updated</dt>
                <dd class="col-sm-8 mb-0">{{ format(profile.updated_at) }}</dd>
              </dl>

              <label class="form-label small text-muted">Account id</label>
              <app-copy-field [value]="profile.id" label="account id" />

              @if (expiresAt(); as expires) {
                <div
                  class="alert alert-info mt-3 mb-0 small d-flex align-items-start gap-2"
                  role="alert"
                >
                  <i class="ph ph-clock mt-1" aria-hidden="true"></i>
                  <span>
                    Access token valid until <strong>{{ format(expires) }}</strong
                    >. Use <em>Refresh access token</em> to extend the session without signing in
                    again.
                  </span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h6 class="mb-1">Need new credentials?</h6>
            <p class="text-muted small mb-0">
              API keys are what machine-to-machine integrations use to sign
              <code>POST /translate</code> requests.
            </p>
          </div>
          <a routerLink="/account-keys" class="btn btn-light">
            <i class="ph ph-key me-1" aria-hidden="true"></i> Manage API keys
          </a>
        </div>
      </div>
    } @else if (loading()) {
      <div class="card mt-4">
        <div class="card-body text-center py-5">
          <span class="spinner-border text-primary" role="status" aria-hidden="true"></span>
          <p class="text-muted mb-0 mt-3">Loading profile…</p>
        </div>
      </div>
    }
  `,
  styles: `
    .profile-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 88px;
      height: 88px;
      border-radius: var(--radius-full);
      background-color: var(--accent-color);
      color: var(--contrast-color);
      font-family: var(--heading-font);
      font-size: 1.75rem;
      font-weight: 600;
    }
  `,
})
export class Profile {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);

  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'My Profile' }];
  protected readonly account = this.auth.account;
  protected readonly loading = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expiresAt = this.session.expiresAt;

  constructor() {
    this.reload();
  }

  protected format(value: string | null): string {
    return formatDateTime(value);
  }

  protected quota(value: number): string {
    return formatQuota(value);
  }

  protected initials(name: string): string {
    return initialsOf(name);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);

    this.auth.loadProfile().subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(ApiError.from(error).message);
      },
    });
  }

  protected refreshToken(): void {
    this.refreshing.set(true);

    this.auth.refreshToken().subscribe({
      next: (result) => {
        this.refreshing.set(false);
        this.toast.success(
          'Access token refreshed',
          `Valid until ${formatDateTime(result.expires_at)}.`,
        );
      },
      error: (error: unknown) => {
        this.refreshing.set(false);
        this.toast.error('Could not refresh the token', ApiError.from(error).message);
      },
    });
  }
}
