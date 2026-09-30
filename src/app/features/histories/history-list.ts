import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../core/http/api-error';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { LookupService } from '../../core/services/lookup.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ListController } from '../../core/ui/list-controller';
import { ToastService } from '../../core/ui/toast.service';
import type {
  CallbackStatus,
  History,
  HistoryQuery,
  HistoryStatus,
} from '../../core/models/api.models';
import { formatDateTime, truncate } from '../../core/utils/format';
import { DatePicker, endOfDay, startOfDay } from '../../shared/ui/date-picker/date-picker';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { TableState } from '../../shared/ui/table-state/table-state';

interface HistoryFilters {
  status?: HistoryStatus;
  callback_status?: CallbackStatus;
  driver_id?: string;
  translate_from?: string;
  translate_to?: string;
  date_from?: string;
  date_to?: string;
  account_id?: string;
}

/**
 * `/histories` — every translation job the signed-in user may see.
 *
 * Admins get the full list plus an account filter and the destructive actions
 * (`retranslate`, `delete`); clients are scoped to their own rows by the backend
 * and can only re-queue a callback.
 */
@Component({
  selector: 'app-history-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, Pagination, StatusBadge, TableState, DatePicker],
  template: `
    <app-page-header
      title="Histories"
      subtitle="Every translation request with its job and callback status."
      [crumbs]="crumbs"
    >
      <a routerLink="/account-keys" class="btn btn-light">
        <i class="ph ph-key me-1" aria-hidden="true"></i> API keys
      </a>
    </app-page-header>

    <div class="card mt-4">
      <div class="card-toolbar">
        <div class="filter-field" style="min-width: 16rem">
          <label class="visually-hidden" for="history-search">Search histories</label>
          <input
            id="history-search"
            type="search"
            class="form-control form-control-sm"
            placeholder="Search reference id or content…"
            [value]="list.search()"
            (input)="onSearch($event)"
          />
        </div>

        <select
          class="form-select form-select-sm filter-field"
          aria-label="Job status"
          [value]="statusFilter()"
          (change)="onStatusChange($event)"
        >
          <option value="">Any status</option>
          <option value="requested">Requested</option>
          <option value="translated">Translated</option>
          <option value="failed">Failed</option>
        </select>

        <select
          class="form-select form-select-sm filter-field"
          aria-label="Callback status"
          [value]="callbackFilter()"
          (change)="onCallbackChange($event)"
        >
          <option value="">Any callback</option>
          <option value="open">Callback open</option>
          <option value="close">Callback closed</option>
        </select>

        <select
          class="form-select form-select-sm filter-field"
          aria-label="Source language"
          [value]="fromFilter()"
          (change)="onFromChange($event)"
        >
          <option value="">From: any</option>
          @for (language of lookups.activeLanguages(); track language.id) {
            <option [value]="language.id">{{ language.id }} — {{ language.name }}</option>
          }
        </select>

        <select
          class="form-select form-select-sm filter-field"
          aria-label="Target language"
          [value]="toFilter()"
          (change)="onToChange($event)"
        >
          <option value="">To: any</option>
          @for (language of lookups.activeLanguages(); track language.id) {
            <option [value]="language.id">{{ language.id }} — {{ language.name }}</option>
          }
        </select>

        <select
          class="form-select form-select-sm filter-field"
          aria-label="Driver"
          [value]="driverFilter()"
          (change)="onDriverChange($event)"
        >
          <option value="">Any driver</option>
          @for (driver of lookups.drivers(); track driver.id) {
            <option [value]="driver.id">{{ driver.name }}</option>
          }
        </select>

        @if (isAdmin()) {
          <select
            class="form-select form-select-sm filter-field"
            aria-label="Account"
            [value]="accountFilter()"
            (change)="onAccountChange($event)"
          >
            <option value="">Any account</option>
            @for (account of lookups.sortedAccounts(); track account.id) {
              <option [value]="account.id">{{ account.full_name }}</option>
            }
          </select>
        }

        <input
          class="form-control form-control-sm filter-field"
          appDatePicker
          placeholder="From date"
          aria-label="Requested from"
          (dateChange)="onFromDate($event)"
        />

        <input
          class="form-control form-control-sm filter-field"
          appDatePicker
          placeholder="To date"
          aria-label="Requested to"
          (dateChange)="onToDate($event)"
        />

        <button type="button" class="btn btn-sm btn-light" (click)="resetFilters()">
          <i class="ph ph-x me-1" aria-hidden="true"></i> Clear
        </button>

        <span class="toolbar-spacer"></span>

        <button
          type="button"
          class="btn btn-sm btn-light"
          [disabled]="list.loading()"
          (click)="list.reload()"
          title="Refresh"
        >
          <i class="ph ph-arrow-clockwise" aria-hidden="true"></i>
          <span class="visually-hidden">Refresh</span>
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              @if (isAdmin()) {
                <th scope="col">Account</th>
              }
              <th scope="col">Languages</th>
              <th scope="col">Driver</th>
              <th scope="col">Status</th>
              <th scope="col">Callback</th>
              <th scope="col">Requested</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (list.loading()) {
              <tr app-table-state mode="loading" [colspan]="columnCount()"></tr>
            } @else if (list.error(); as message) {
              <tr app-table-state mode="error" [colspan]="columnCount()" [message]="message"></tr>
            } @else if (list.isEmpty()) {
              <tr
                app-table-state
                mode="empty"
                [colspan]="columnCount()"
                message="No translation jobs found."
                hint="Adjust the filters, or send a request through POST /translate."
              ></tr>
            } @else {
              @for (history of list.items(); track history.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/histories', history.id]" class="fw-medium cell-mono">
                      {{ history.reference_id }}
                    </a>
                    <span
                      class="d-block text-muted small cell-truncate"
                      [title]="history.reference_content"
                    >
                      {{ preview(history.reference_content) }}
                    </span>
                  </td>
                  @if (isAdmin()) {
                    <td class="small">
                      @if (history.account; as account) {
                        <span class="d-block">{{ account.full_name }}</span>
                        <span class="text-muted">{{ account.email }}</span>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                  }
                  <td class="text-nowrap">
                    <span class="badge badge-soft-secondary cell-mono">{{
                      history.translate_from
                    }}</span>
                    <i class="ph ph-arrow-right mx-1 text-muted" aria-hidden="true"></i>
                    <span class="badge badge-soft-primary cell-mono">{{
                      history.translate_to
                    }}</span>
                  </td>
                  <td class="small">
                    @if (history.driver; as driver) {
                      <span class="d-block">{{ driver.name }}</span>
                    }
                    <span class="text-muted cell-mono">{{ history.driver_id }}</span>
                  </td>
                  <td><app-status-badge [value]="history.status" /></td>
                  <td>
                    <app-status-badge [value]="history.callback_status" />
                    @if (history.callback_retry > 0) {
                      <span class="d-block text-muted small mt-1"
                        >{{ history.callback_retry }} retry(ies)</span
                      >
                    }
                  </td>
                  <td class="small text-muted text-nowrap">
                    {{ requested(history.requested_at) }}
                  </td>
                  <td class="text-end text-nowrap">
                    <a
                      class="btn btn-sm btn-light"
                      [routerLink]="['/histories', history.id]"
                      title="View detail"
                    >
                      <i class="ph ph-eye" aria-hidden="true"></i>
                      <span class="visually-hidden">View {{ history.reference_id }}</span>
                    </a>
                    <button
                      type="button"
                      class="btn btn-sm btn-light"
                      title="Resend callback"
                      (click)="resend(history)"
                    >
                      <i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>
                      <span class="visually-hidden">Resend callback</span>
                    </button>
                    @if (isAdmin()) {
                      <button
                        type="button"
                        class="btn btn-sm btn-light"
                        title="Retranslate"
                        (click)="retranslate(history)"
                      >
                        <i class="ph ph-arrows-clockwise" aria-hidden="true"></i>
                        <span class="visually-hidden">Retranslate</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-light text-danger"
                        title="Delete"
                        (click)="remove(history)"
                      >
                        <i class="ph ph-trash" aria-hidden="true"></i>
                        <span class="visually-hidden">Delete</span>
                      </button>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <app-pagination
        [page]="list.page()"
        [limit]="list.limit()"
        [total]="list.total()"
        [totalPages]="list.totalPages()"
        [firstRow]="list.firstRow()"
        [lastRow]="list.lastRow()"
        [window]="list.pageWindow()"
        [sizeOptions]="list.pageSizeOptions"
        (pageChange)="list.setPage($event)"
        (limitChange)="list.setLimit($event)"
      />
    </div>
  `,
})
export class HistoryList {
  private readonly service = inject(HistoryService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly lookups = inject(LookupService);
  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'Histories' }];
  protected readonly isAdmin = this.auth.isAdmin;

  protected readonly statusFilter = signal<HistoryStatus | ''>('');
  protected readonly callbackFilter = signal<CallbackStatus | ''>('');
  protected readonly fromFilter = signal('');
  protected readonly toFilter = signal('');
  protected readonly driverFilter = signal('');
  protected readonly accountFilter = signal('');
  private readonly fromDate = signal('');
  private readonly toDate = signal('');

  private readonly filters = computed<HistoryFilters>(() => ({
    ...(this.statusFilter() ? { status: this.statusFilter() as HistoryStatus } : {}),
    ...(this.callbackFilter() ? { callback_status: this.callbackFilter() as CallbackStatus } : {}),
    ...(this.fromFilter() ? { translate_from: this.fromFilter() } : {}),
    ...(this.toFilter() ? { translate_to: this.toFilter() } : {}),
    ...(this.driverFilter() ? { driver_id: this.driverFilter() } : {}),
    ...(this.accountFilter() ? { account_id: this.accountFilter() } : {}),
    ...(startOfDay(this.fromDate()) ? { date_from: startOfDay(this.fromDate()) } : {}),
    ...(endOfDay(this.toDate()) ? { date_to: endOfDay(this.toDate()) } : {}),
  }));

  protected readonly list = new ListController<History, HistoryQuery>(
    {
      load: (query) => this.service.list(query),
      filters: this.filters,
    },
    inject(DestroyRef),
  );

  protected readonly columnCount = computed(() => (this.isAdmin() ? 8 : 7));

  constructor() {
    this.list.connect();
    this.lookups.ensureLoaded({ accounts: this.isAdmin() }).subscribe();
  }

  protected requested(value: string): string {
    return formatDateTime(value);
  }

  protected preview(content: string): string {
    return truncate(content, 70);
  }

  protected onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as HistoryStatus | '');
    this.list.applyFilters();
  }

  protected onCallbackChange(event: Event): void {
    this.callbackFilter.set((event.target as HTMLSelectElement).value as CallbackStatus | '');
    this.list.applyFilters();
  }

  protected onFromChange(event: Event): void {
    this.fromFilter.set((event.target as HTMLSelectElement).value);
    this.list.applyFilters();
  }

  protected onToChange(event: Event): void {
    this.toFilter.set((event.target as HTMLSelectElement).value);
    this.list.applyFilters();
  }

  protected onDriverChange(event: Event): void {
    this.driverFilter.set((event.target as HTMLSelectElement).value);
    this.list.applyFilters();
  }

  protected onAccountChange(event: Event): void {
    this.accountFilter.set((event.target as HTMLSelectElement).value);
    this.list.applyFilters();
  }

  protected onFromDate(value: string): void {
    this.fromDate.set(value);
    this.list.applyFilters();
  }

  protected onToDate(value: string): void {
    this.toDate.set(value);
    this.list.applyFilters();
  }

  protected resetFilters(): void {
    this.statusFilter.set('');
    this.callbackFilter.set('');
    this.fromFilter.set('');
    this.toFilter.set('');
    this.driverFilter.set('');
    this.accountFilter.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.list.setSearch('');
    this.list.applyFilters();
  }

  protected resend(history: History): void {
    this.service.resendCallback(history.id).subscribe({
      next: () => {
        this.toast.success(
          'Callback re-queued',
          `Reference ${history.reference_id} was queued again.`,
        );
        this.list.reload();
      },
      error: (error: unknown) => {
        this.toast.error('Could not resend the callback', ApiError.from(error).message);
      },
    });
  }

  protected async retranslate(history: History): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Retranslate',
      message: `Queue “${history.reference_id}” for translation again?`,
      details: ['The previous result stays available until the new one arrives.'],
      confirmLabel: 'Retranslate',
      variant: 'primary',
    });

    if (!confirmed) {
      return;
    }

    this.service.retranslate(history.id).subscribe({
      next: () => {
        this.toast.success(
          'Translation re-queued',
          `Reference ${history.reference_id} is requested again.`,
        );
        this.list.reload();
      },
      error: (error: unknown) => {
        this.toast.error('Could not retranslate', ApiError.from(error).message);
      },
    });
  }

  protected async remove(history: History): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete history',
      message: `Permanently delete “${history.reference_id}”?`,
      details: ['This removes the job and its stored content. It cannot be undone.'],
      confirmLabel: 'Delete',
    });

    if (!confirmed) {
      return;
    }

    this.service.remove(history.id).subscribe({
      next: () => {
        this.toast.success('History deleted', `${history.reference_id} was removed.`);
        this.list.reload();
      },
      error: (error: unknown) => {
        this.toast.error('Delete failed', ApiError.from(error).message);
      },
    });
  }
}
