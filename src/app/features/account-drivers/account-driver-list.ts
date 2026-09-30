import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiError } from '../../core/http/api-error';
import { AccountDriverService } from '../../core/services/account-driver.service';
import { LookupService } from '../../core/services/lookup.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ListController } from '../../core/ui/list-controller';
import { ToastService } from '../../core/ui/toast.service';
import type { AccountDriver, AccountDriverQuery } from '../../core/models/api.models';
import { formatDateTime, initialsOf } from '../../core/utils/format';
import { Modal } from '../../shared/ui/modal/modal';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { TableState } from '../../shared/ui/table-state/table-state';

interface AccountDriverFilters {
  account_id?: string;
  driver_id?: string;
}

/**
 * `/account-drivers` — admin-only driver grants.
 *
 * A client may only use a driver listed here; without the row `POST /translate`
 * answers `403`. The same screen therefore doubles as the "why is this driver
 * missing for my account" answer.
 */
@Component({
  selector: 'app-account-driver-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, Pagination, StatusBadge, TableState, Modal],
  template: `
    <app-page-header
      title="Driver Access"
      subtitle="Which account may use which translation driver."
      [crumbs]="crumbs"
    >
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="ph ph-plus me-1" aria-hidden="true"></i> Grant access
      </button>
    </app-page-header>

    <div class="card mt-4">
      <div class="card-toolbar">
        <div class="filter-field">
          <label class="visually-hidden" for="grant-search">Search grants</label>
          <input
            id="grant-search"
            type="search"
            class="form-control form-control-sm"
            placeholder="Search account or driver…"
            [value]="list.search()"
            (input)="onSearch($event)"
          />
        </div>

        <label class="d-flex align-items-center gap-2 small text-muted mb-0">
          Account
          <select
            class="form-select form-select-sm filter-field"
            [value]="accountFilter()"
            (change)="onAccountChange($event)"
          >
            <option value="">All accounts</option>
            @for (account of lookups.sortedAccounts(); track account.id) {
              <option [value]="account.id">{{ account.full_name }}</option>
            }
          </select>
        </label>

        <label class="d-flex align-items-center gap-2 small text-muted mb-0">
          Driver
          <select
            class="form-select form-select-sm filter-field"
            [value]="driverFilter()"
            (change)="onDriverChange($event)"
          >
            <option value="">All drivers</option>
            @for (driver of lookups.drivers(); track driver.id) {
              <option [value]="driver.id">{{ driver.name }}</option>
            }
          </select>
        </label>

        <span class="toolbar-spacer"></span>
        <span class="text-muted small">{{ list.total() }} grant(s)</span>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Driver</th>
              <th scope="col">Driver status</th>
              <th scope="col">Granted</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (list.loading()) {
              <tr app-table-state mode="loading" [colspan]="5"></tr>
            } @else if (list.error(); as message) {
              <tr app-table-state mode="error" [colspan]="5" [message]="message"></tr>
            } @else if (list.isEmpty()) {
              <tr
                app-table-state
                mode="empty"
                [colspan]="5"
                message="No driver grants found."
                hint="Change the filters, or grant a driver to an account."
              ></tr>
            } @else {
              @for (grant of list.items(); track grant.id) {
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <span class="grant-avatar">{{ initials(grant.account.full_name) }}</span>
                      <span>
                        <span class="d-block fw-medium">{{ grant.account.full_name }}</span>
                        <span class="text-muted small">{{ grant.account.email }}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class="d-block fw-medium">{{ grant.driver.name }}</span>
                    <span class="text-muted cell-mono">{{ grant.driver.id }}</span>
                  </td>
                  <td>
                    <app-status-badge [value]="grant.driver.status" />
                    @if (grant.driver.status === 'inactive') {
                      <span class="d-block text-muted small mt-1">
                        Grant exists but the driver is disabled for new jobs.
                      </span>
                    }
                  </td>
                  <td class="small text-muted text-nowrap">{{ granted(grant.created_at) }}</td>
                  <td class="text-end text-nowrap">
                    <button type="button" class="btn btn-sm btn-light" (click)="openEdit(grant)">
                      <i class="ph ph-arrows-left-right" aria-hidden="true"></i>
                      <span class="visually-hidden">Change grant</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-light text-danger"
                      (click)="remove(grant)"
                    >
                      <i class="ph ph-trash" aria-hidden="true"></i>
                      <span class="visually-hidden">Revoke grant</span>
                    </button>
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

    <app-modal [(open)]="formOpen" [title]="editing() ? 'Change grant' : 'Grant driver access'">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        @if (formError(); as message) {
          <div class="alert alert-danger" role="alert">
            <span class="d-block fw-semibold">{{ message }}</span>
            @if (formErrorDetails().length) {
              <ul class="mb-0 mt-1 ps-3 small">
                @for (detail of formErrorDetails(); track detail) {
                  <li>{{ detail }}</li>
                }
              </ul>
            }
          </div>
        }

        <div class="mb-3">
          <label class="form-label" for="grant-account">Account</label>
          <select
            id="grant-account"
            class="form-select"
            formControlName="account_id"
            [class.is-invalid]="showError('account_id')"
          >
            <option value="" disabled>Select an account…</option>
            @for (account of lookups.sortedAccounts(); track account.id) {
              <option [value]="account.id">{{ account.full_name }} — {{ account.email }}</option>
            }
          </select>
          @if (showError('account_id')) {
            <div class="invalid-feedback d-block">Choose the account receiving the grant.</div>
          }
        </div>

        <div>
          <label class="form-label" for="grant-driver">Driver</label>
          <select
            id="grant-driver"
            class="form-select"
            formControlName="driver_id"
            [class.is-invalid]="showError('driver_id')"
          >
            <option value="" disabled>Select a driver…</option>
            @for (driver of lookups.drivers(); track driver.id) {
              <option [value]="driver.id">{{ driver.name }} ({{ driver.id }})</option>
            }
          </select>
          @if (showError('driver_id')) {
            <div class="invalid-feedback d-block">Choose the driver to grant.</div>
          }
        </div>

        <p class="form-text mb-0">
          An account + driver pair must be unique; duplicates return <code>409</code>.
        </p>
      </form>

      <ng-container modalFooter>
        <button type="button" class="btn btn-light" (click)="formOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">
          @if (saving()) {
            <span
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
          }
          {{ editing() ? 'Save changes' : 'Grant access' }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .grant-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: var(--radius-full);
      background-color: var(--accent-color);
      color: var(--contrast-color);
      font-size: 0.8125rem;
      font-weight: 600;
      flex: 0 0 auto;
    }
  `,
})
export class AccountDriverList {
  private readonly service = inject(AccountDriverService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly lookups = inject(LookupService);
  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'Driver Access' }];
  protected readonly accountFilter = signal('');
  protected readonly driverFilter = signal('');

  private readonly filters = computed<AccountDriverFilters>(() => {
    const account = this.accountFilter();
    const driver = this.driverFilter();
    return {
      ...(account ? { account_id: account } : {}),
      ...(driver ? { driver_id: driver } : {}),
    };
  });

  protected readonly list = new ListController<AccountDriver, AccountDriverQuery>(
    {
      load: (query) => this.service.list(query),
      filters: this.filters,
    },
    inject(DestroyRef),
  );

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<AccountDriver | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorDetails = signal<string[]>([]);
  private readonly submitted = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    account_id: ['', [Validators.required]],
    driver_id: ['', [Validators.required]],
  });

  constructor() {
    this.list.connect();
    this.lookups.ensureLoaded({ accounts: true }).subscribe();
  }

  protected initials(name: string): string {
    return initialsOf(name);
  }

  protected granted(value: string): string {
    return formatDateTime(value);
  }

  protected onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  protected onAccountChange(event: Event): void {
    this.accountFilter.set((event.target as HTMLSelectElement).value);
    this.list.applyFilters();
  }

  protected onDriverChange(event: Event): void {
    this.driverFilter.set((event.target as HTMLSelectElement).value);
    this.list.applyFilters();
  }

  protected showError(control: 'account_id' | 'driver_id'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || this.submitted());
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.resetForm({ account_id: '', driver_id: '' });
  }

  protected openEdit(grant: AccountDriver): void {
    this.editing.set(grant);
    this.resetForm({ account_id: grant.account_id, driver_id: grant.driver_id });
  }

  protected save(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const editing = this.editing();

    this.saving.set(true);
    this.formError.set(null);
    this.formErrorDetails.set([]);

    const request = editing ? this.service.update(editing.id, value) : this.service.create(value);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(
          editing ? 'Grant updated' : 'Access granted',
          'The account can now use this driver.',
        );
        this.list.reload();
        this.lookups.refresh().subscribe();
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.saving.set(false);
        this.formError.set(apiError.message);
        this.formErrorDetails.set(apiError.fieldMessages);
      },
    });
  }

  protected async remove(grant: AccountDriver): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Revoke driver access',
      message: `Revoke “${grant.driver.name}” from ${grant.account.full_name}?`,
      details: ['The account will receive 403 on POST /translate for this driver.'],
      confirmLabel: 'Revoke',
    });

    if (!confirmed) {
      return;
    }

    this.service.remove(grant.id).subscribe({
      next: () => {
        this.toast.success(
          'Access revoked',
          `${grant.account.full_name} lost access to ${grant.driver.id}.`,
        );
        this.list.reload();
      },
      error: (error: unknown) => {
        this.toast.error('Revoke failed', ApiError.from(error).message);
      },
    });
  }

  private resetForm(value: { account_id: string; driver_id: string }): void {
    this.formError.set(null);
    this.formErrorDetails.set([]);
    this.submitted.set(false);
    this.form.reset(value);
    this.formOpen.set(true);
  }
}
