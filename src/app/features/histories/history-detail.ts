import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { timer } from 'rxjs';

import { ApiError } from '../../core/http/api-error';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import type { History } from '../../core/models/api.models';
import { formatDateTime } from '../../core/utils/format';
import { CopyField } from '../../shared/ui/copy-field/copy-field';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

/** Poll interval while a job is still `requested` (the API processes async). */
const POLL_INTERVAL_MS = 4000;

/**
 * `/histories/detail/{ID}` — a single job in full.
 *
 * Because `POST /translate` returns before the worker finishes, the screen can
 * poll the detail endpoint while the status is `requested`; that is the polling
 * fallback `API_DOC.md` describes for keys without a `callback_url`.
 */
@Component({
  selector: 'app-history-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, StatusBadge, CopyField],
  template: `
    <app-page-header
      [title]="history()?.reference_id ?? 'History detail'"
      subtitle="Job, content and callback information."
      [crumbs]="crumbs"
    >
      <a routerLink="/histories" class="btn btn-light">
        <i class="ph ph-arrow-left me-1" aria-hidden="true"></i> Back to list
      </a>

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

      @if (isAdmin()) {
        <button type="button" class="btn btn-light" (click)="retranslate()">
          <i class="ph ph-arrows-clockwise me-1" aria-hidden="true"></i> Retranslate
        </button>
      }

      <button type="button" class="btn btn-primary" (click)="resendCallback()">
        <i class="ph ph-paper-plane-tilt me-1" aria-hidden="true"></i> Resend callback
      </button>
    </app-page-header>

    @if (error(); as message) {
      <div class="alert alert-danger mt-4 d-flex align-items-start gap-2" role="alert">
        <i class="ph ph-warning-circle mt-1" aria-hidden="true"></i>
        <span>{{ message }}</span>
      </div>
    }

    @if (history(); as history) {
      @if (history.status === 'requested') {
        <div class="poll-banner mt-4">
          <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          <span class="flex-grow-1 small">
            The worker is still processing this job. The view refreshes every
            {{ pollSeconds }}s while the status stays <code>requested</code>.
          </span>
          <button type="button" class="btn btn-sm btn-light" (click)="togglePolling()">
            {{ polling() ? 'Pause' : 'Resume' }}
          </button>
        </div>
      }

      <div class="row g-4 mt-1">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Job</h5>
            </div>
            <div class="card-body">
              <dl class="row mb-0">
                <dt class="col-5 text-muted fw-normal">Status</dt>
                <dd class="col-7"><app-status-badge [value]="history.status" /></dd>

                <dt class="col-5 text-muted fw-normal">Driver</dt>
                <dd class="col-7">
                  <span class="d-block">{{ history.driver?.name ?? '—' }}</span>
                  <span class="text-muted cell-mono">{{ history.driver_id }}</span>
                </dd>

                <dt class="col-5 text-muted fw-normal">Languages</dt>
                <dd class="col-7">
                  <span class="badge badge-soft-secondary cell-mono">{{
                    history.translate_from
                  }}</span>
                  <i class="ph ph-arrow-right mx-1 text-muted" aria-hidden="true"></i>
                  <span class="badge badge-soft-primary cell-mono">{{ history.translate_to }}</span>
                </dd>

                <dt class="col-5 text-muted fw-normal">Requested</dt>
                <dd class="col-7">{{ format(history.requested_at) }}</dd>

                <dt class="col-5 text-muted fw-normal">Translated</dt>
                <dd class="col-7 mb-0">{{ format(history.translated_at) }}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Callback</h5>
            </div>
            <div class="card-body">
              <dl class="row mb-0">
                <dt class="col-5 text-muted fw-normal">Status</dt>
                <dd class="col-7"><app-status-badge [value]="history.callback_status" /></dd>

                <dt class="col-5 text-muted fw-normal">Retries</dt>
                <dd class="col-7">{{ history.callback_retry }}</dd>

                <dt class="col-5 text-muted fw-normal">Delivered at</dt>
                <dd class="col-7 mb-0">{{ format(history.callback_at) }}</dd>
              </dl>

              @if (history.callback_status === 'open') {
                <div class="alert alert-warning mt-3 mb-0 small" role="alert">
                  The callback has not been confirmed yet. The worker retries it every 5 minutes.
                </div>
              }
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="card-title mb-0">Account &amp; identifiers</h5>
            </div>
            <div class="card-body">
              <dl class="row mb-3">
                <dt class="col-5 text-muted fw-normal">Account</dt>
                <dd class="col-7">
                  @if (history.account; as account) {
                    <span class="d-block">{{ account.full_name }}</span>
                    <span class="text-muted small">{{ account.email }}</span>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </dd>
              </dl>

              <label class="form-label small text-muted">reference_id</label>
              <app-copy-field [value]="history.reference_id" label="reference id" />

              <label class="form-label small text-muted mt-3">history_id</label>
              <app-copy-field [value]="history.id" label="history id" />
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4 mt-1">
        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header d-flex align-items-center justify-content-between">
              <h5 class="card-title mb-0">Original content</h5>
              <span class="badge badge-soft-secondary cell-mono">{{ history.translate_from }}</span>
            </div>
            <div class="card-body">
              <pre class="content-preview">{{ history.reference_content }}</pre>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card h-100">
            <div class="card-header d-flex align-items-center justify-content-between">
              <h5 class="card-title mb-0">Translated content</h5>
              <span class="badge badge-soft-primary cell-mono">{{ history.translate_to }}</span>
            </div>
            <div class="card-body">
              @if (history.translated_content) {
                <pre class="content-preview">{{ history.translated_content }}</pre>
              } @else if (history.status === 'failed') {
                <p class="text-danger mb-0">
                  <i class="ph ph-x-circle me-1" aria-hidden="true"></i>
                  The provider could not translate this content. Retranslate to try again.
                </p>
              } @else {
                <p class="text-muted mb-0">No result yet — the job is still queued.</p>
              }
            </div>
          </div>
        </div>
      </div>
    } @else if (loading()) {
      <div class="card mt-4">
        <div class="card-body text-center py-5">
          <span class="spinner-border text-primary" role="status" aria-hidden="true"></span>
          <p class="text-muted mb-0 mt-3">Loading history…</p>
        </div>
      </div>
    }
  `,
  styles: `
    .poll-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--warning-color);
      border-radius: var(--radius-md);
      background-color: var(--warning-color-light);
      color: var(--warning-color);
    }
  `,
})
export class HistoryDetail {
  private readonly service = inject(HistoryService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the `:id` route segment by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly crumbs = [
    { label: 'Home', link: '/dashboard' },
    { label: 'Histories', link: '/histories' },
  ];
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly history = signal<History | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly polling = signal(true);
  protected readonly pollSeconds = POLL_INTERVAL_MS / 1000;

  /** Id currently loaded, so a route change can clear the previous job. */
  private loadedId: string | null = null;

  constructor() {
    // `id` is bound from the route by `withComponentInputBinding()`, and inputs
    // are assigned *after* construction — reading `id()` synchronously here threw
    // NG0950 and made the router abort the navigation back to the list. The
    // effect waits for the binding and also reloads when the user moves from one
    // job to another (the router reuses this component for `histories/:id`).
    effect(() => {
      const id = this.id();

      if (this.loadedId !== id) {
        this.loadedId = id;
        this.history.set(null);
      }

      this.fetch(id, false);
    });

    const subscription = timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS).subscribe(() => {
      if (this.polling() && this.history()?.status === 'requested') {
        this.fetch(this.id(), true);
      }
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  protected format(value: string | null): string {
    return formatDateTime(value);
  }

  protected togglePolling(): void {
    this.polling.update((enabled) => !enabled);
  }

  protected reload(): void {
    this.fetch(this.id(), false);
  }

  protected resendCallback(): void {
    const history = this.history();
    if (!history) {
      return;
    }

    this.service.resendCallback(history.id).subscribe({
      next: (updated) => {
        this.history.set(updated);
        this.toast.success(
          'Callback re-queued',
          'The callback was opened again and sent to the broker.',
        );
      },
      error: (error: unknown) => {
        this.toast.error('Could not resend the callback', ApiError.from(error).message);
      },
    });
  }

  protected async retranslate(): Promise<void> {
    const history = this.history();
    if (!history) {
      return;
    }

    const confirmed = await this.confirm.ask({
      title: 'Retranslate',
      message: `Queue “${history.reference_id}” for translation again?`,
      details: ['The current result stays stored until the new one arrives.'],
      confirmLabel: 'Retranslate',
      variant: 'primary',
    });

    if (!confirmed) {
      return;
    }

    this.service.retranslate(history.id).subscribe({
      next: (updated) => {
        this.history.set(updated);
        this.polling.set(true);
        this.toast.success('Translation re-queued', 'The job is requested again.');
      },
      error: (error: unknown) => {
        this.toast.error('Could not retranslate', ApiError.from(error).message);
      },
    });
  }

  /** `silent` keeps the polling refresh from flashing the spinner. */
  private fetch(id: string, silent: boolean): void {
    if (!silent) {
      this.loading.set(true);
    }
    this.error.set(null);

    this.service.detail(id).subscribe({
      next: (history) => {
        this.history.set(history);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(ApiError.from(error).message);
      },
    });
  }
}
