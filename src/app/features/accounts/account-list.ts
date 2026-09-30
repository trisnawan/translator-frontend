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
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ListController } from '../../core/ui/list-controller';
import { ToastService } from '../../core/ui/toast.service';
import type {
  Account,
  AccountQuery,
  AccountRole,
  ActiveStatus,
} from '../../core/models/api.models';
import { accentFor, formatDateTime, formatQuota, initialsOf } from '../../core/utils/format';
import { CopyField } from '../../shared/ui/copy-field/copy-field';
import { Modal } from '../../shared/ui/modal/modal';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { TableState } from '../../shared/ui/table-state/table-state';

interface AccountFilters {
  role?: AccountRole;
  status?: ActiveStatus;
}

/**
 * `/accounts` — admin-only account management.
 *
 * Covers the whole contract: list with `role`/`status` filters, detail, insert,
 * update (including password reset) and delete. The backend refuses to delete the
 * signed-in admin, which surfaces as a `409` toast.
 */
@Component({
  selector: 'app-account-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, Pagination, StatusBadge, TableState, Modal, CopyField],
  template: `
    <app-page-header
      title="Accounts"
      subtitle="Admins and clients that can call the translation API."
      [crumbs]="crumbs"
    >
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="ph ph-user-plus me-1" aria-hidden="true"></i> New account
      </button>
    </app-page-header>

    <div class="card mt-4">
      <div class="card-toolbar">
        <div class="filter-field">
          <label class="visually-hidden" for="account-search">Search accounts</label>
          <input
            id="account-search"
            type="search"
            class="form-control form-control-sm"
            placeholder="Search name or email…"
            [value]="list.search()"
            (input)="onSearch($event)"
          />
        </div>

        <label class="d-flex align-items-center gap-2 small text-muted mb-0">
          Role
          <select
            class="form-select form-select-sm filter-field"
            [value]="roleFilter()"
            (change)="onRoleChange($event)"
          >
            <option value="">All</option>
            <option value="admin">Admin</option>
            <option value="client">Client</option>
          </select>
        </label>

        <label class="d-flex align-items-center gap-2 small text-muted mb-0">
          Status
          <select
            class="form-select form-select-sm filter-field"
            [value]="statusFilter()"
            (change)="onStatusChange($event)"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <span class="toolbar-spacer"></span>
        <span class="text-muted small">{{ list.total() }} account(s)</span>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Quota (rpm / rpd)</th>
              <th scope="col">Created</th>
              <th scope="col" class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (list.loading()) {
              <tr app-table-state mode="loading" [colspan]="6"></tr>
            } @else if (list.error(); as message) {
              <tr app-table-state mode="error" [colspan]="6" [message]="message"></tr>
            } @else if (list.isEmpty()) {
              <tr
                app-table-state
                mode="empty"
                [colspan]="6"
                message="No accounts found."
                hint="Adjust the filters, or create the first account."
              ></tr>
            } @else {
              @for (account of list.items(); track account.id) {
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <span
                        class="badge rounded-circle p-2"
                        [class]="'text-bg-' + accent(account.id)"
                      >
                        {{ initials(account.full_name) }}
                      </span>
                      <span>
                        <span class="d-block fw-medium">{{ account.full_name }}</span>
                        <span class="text-muted small">{{ account.email }}</span>
                      </span>
                    </div>
                  </td>
                  <td><app-status-badge [value]="account.role" /></td>
                  <td><app-status-badge [value]="account.status" /></td>
                  <td class="small text-nowrap">
                    {{ quota(account.max_rpm) }} <span class="text-muted">/</span>
                    {{ quota(account.max_rpd) }}
                  </td>
                  <td class="small text-muted text-nowrap">{{ created(account.created_at) }}</td>
                  <td class="text-end text-nowrap">
                    <button
                      type="button"
                      class="btn btn-sm btn-light"
                      (click)="openDetail(account)"
                    >
                      <i class="ph ph-eye" aria-hidden="true"></i>
                      <span class="visually-hidden">View {{ account.full_name }}</span>
                    </button>
                    <button type="button" class="btn btn-sm btn-light" (click)="openEdit(account)">
                      <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                      <span class="visually-hidden">Edit {{ account.full_name }}</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-light text-danger"
                      (click)="remove(account)"
                    >
                      <i class="ph ph-trash" aria-hidden="true"></i>
                      <span class="visually-hidden">Delete {{ account.full_name }}</span>
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

    <!-- Create / edit -->
    <app-modal [(open)]="formOpen" [title]="editing() ? 'Edit account' : 'New account'" size="lg">
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

        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" for="account-name">Full name</label>
            <input
              id="account-name"
              class="form-control"
              formControlName="full_name"
              maxlength="100"
              placeholder="PT Contoh Digital"
              [class.is-invalid]="showError('full_name')"
            />
            @if (showError('full_name')) {
              <div class="invalid-feedback d-block">Full name is required.</div>
            }
          </div>

          <div class="col-md-6">
            <label class="form-label" for="account-email">Email</label>
            <input
              id="account-email"
              type="email"
              class="form-control"
              formControlName="email"
              maxlength="150"
              placeholder="integrasi@contoh.co.id"
              autocomplete="off"
              [class.is-invalid]="showError('email')"
            />
            @if (showError('email')) {
              <div class="invalid-feedback d-block">A valid, unique email address is required.</div>
            }
          </div>

          <div class="col-md-6">
            <label class="form-label" for="account-password">Password</label>
            <input
              id="account-password"
              type="password"
              class="form-control"
              formControlName="password"
              autocomplete="new-password"
              [placeholder]="
                editing() ? 'Leave blank to keep the current password' : 'At least 6 characters'
              "
              [class.is-invalid]="showError('password')"
            />
            @if (showError('password')) {
              <div class="invalid-feedback d-block">Use at least 6 characters.</div>
            }
          </div>

          <div class="col-md-3">
            <label class="form-label" for="account-role">Role</label>
            <select id="account-role" class="form-select" formControlName="role">
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div class="col-md-3">
            <label class="form-label" for="account-status">Status</label>
            <select id="account-status" class="form-select" formControlName="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label" for="account-rpm">Max requests / minute</label>
            <input
              id="account-rpm"
              type="number"
              min="0"
              class="form-control"
              formControlName="max_rpm"
            />
            <div class="form-text"><code>0</code> means unlimited.</div>
          </div>

          <div class="col-md-6">
            <label class="form-label" for="account-rpd">Max requests / day</label>
            <input
              id="account-rpd"
              type="number"
              min="0"
              class="form-control"
              formControlName="max_rpd"
            />
            <div class="form-text"><code>0</code> means unlimited.</div>
          </div>
        </div>
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
          {{ editing() ? 'Save changes' : 'Create account' }}
        </button>
      </ng-container>
    </app-modal>

    <!-- Detail (GET /accounts/detail/{ID}) -->
    <app-modal [(open)]="detailOpen" title="Account detail">
      @if (detailLoading()) {
        <p class="text-muted mb-0">
          <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          Loading…
        </p>
      } @else if (detail(); as account) {
        <dl class="row mb-0">
          <dt class="col-4 text-muted fw-normal">Name</dt>
          <dd class="col-8">{{ account.full_name }}</dd>

          <dt class="col-4 text-muted fw-normal">Email</dt>
          <dd class="col-8">{{ account.email }}</dd>

          <dt class="col-4 text-muted fw-normal">Role</dt>
          <dd class="col-8"><app-status-badge [value]="account.role" /></dd>

          <dt class="col-4 text-muted fw-normal">Status</dt>
          <dd class="col-8"><app-status-badge [value]="account.status" /></dd>

          <dt class="col-4 text-muted fw-normal">Quota</dt>
          <dd class="col-8">{{ quota(account.max_rpm) }} rpm / {{ quota(account.max_rpd) }} rpd</dd>

          <dt class="col-4 text-muted fw-normal">Created</dt>
          <dd class="col-8">{{ created(account.created_at) }}</dd>

          <dt class="col-4 text-muted fw-normal">Updated</dt>
          <dd class="col-8 mb-3">{{ created(account.updated_at) }}</dd>
        </dl>

        <label class="form-label small text-muted">Account id</label>
        <app-copy-field [value]="account.id" label="account id" />
      }
    </app-modal>
  `,
})
export class AccountList {
  private readonly service = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'Accounts' }];
  protected readonly roleFilter = signal<AccountRole | ''>('');
  protected readonly statusFilter = signal<ActiveStatus | ''>('');

  private readonly filters = computed<AccountFilters>(() => {
    const role = this.roleFilter();
    const status = this.statusFilter();
    return { ...(role ? { role } : {}), ...(status ? { status } : {}) };
  });

  protected readonly list = new ListController<Account, AccountQuery>(
    {
      load: (query) => this.service.list(query),
      filters: this.filters,
    },
    inject(DestroyRef),
  );

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Account | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorDetails = signal<string[]>([]);

  protected readonly detailOpen = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly detail = signal<Account | null>(null);

  private readonly submitted = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    full_name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: [''],
    role: ['client' as AccountRole, [Validators.required]],
    status: ['active' as ActiveStatus, [Validators.required]],
    max_rpm: [0, [Validators.min(0)]],
    max_rpd: [0, [Validators.min(0)]],
  });

  constructor() {
    this.list.connect();
  }

  protected quota(value: number): string {
    return formatQuota(value);
  }

  protected created(value: string): string {
    return formatDateTime(value);
  }

  protected initials(name: string): string {
    return initialsOf(name);
  }

  protected accent(value: string): string {
    return accentFor(value);
  }

  protected onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  protected onRoleChange(event: Event): void {
    this.roleFilter.set((event.target as HTMLSelectElement).value as AccountRole | '');
    this.list.applyFilters();
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as ActiveStatus | '');
    this.list.applyFilters();
  }

  protected showError(control: 'full_name' | 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || this.submitted());
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.resetForm({
      full_name: '',
      email: '',
      password: '',
      role: 'client',
      status: 'active',
      max_rpm: 0,
      max_rpd: 0,
    });
  }

  protected openEdit(account: Account): void {
    this.editing.set(account);
    this.resetForm({
      full_name: account.full_name,
      email: account.email,
      password: '',
      role: account.role,
      status: account.status,
      max_rpm: account.max_rpm,
      max_rpd: account.max_rpd,
    });
  }

  protected openDetail(account: Account): void {
    this.detail.set(null);
    this.detailLoading.set(true);
    this.detailOpen.set(true);

    this.service.detail(account.id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.detailLoading.set(false);
        this.detailOpen.set(false);
        this.toast.error('Could not load the account', ApiError.from(error).message);
      },
    });
  }

  protected save(): void {
    this.submitted.set(true);
    const editing = this.editing();

    // Password is optional on update but required on insert.
    const password = this.form.controls.password;
    password.setValidators(
      editing ? [Validators.minLength(6)] : [Validators.required, Validators.minLength(6)],
    );
    password.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.formErrorDetails.set([]);

    const payload = {
      full_name: value.full_name,
      email: value.email.trim().toLowerCase(),
      role: value.role,
      status: value.status,
      max_rpm: Number(value.max_rpm) || 0,
      max_rpd: Number(value.max_rpd) || 0,
      ...(value.password ? { password: value.password } : {}),
    };

    const request = editing
      ? this.service.update(editing.id, payload)
      : this.service.create(payload);

    request.subscribe({
      next: (account) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(
          editing ? 'Account updated' : 'Account created',
          `${account.full_name} — ${account.email}`,
        );
        this.list.reload();

        // Keep the header in sync when an admin edits their own profile.
        if (this.auth.account()?.id === account.id) {
          this.auth.loadProfile().subscribe();
        }
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.saving.set(false);
        this.formError.set(apiError.message);
        this.formErrorDetails.set(apiError.fieldMessages);
      },
    });
  }

  protected async remove(account: Account): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete account',
      message: `Delete “${account.full_name}” (${account.email})?`,
      details: [
        'Its API keys and driver grants are removed as well (cascade).',
        'Translation histories that reference the account are kept for auditing.',
      ],
      confirmLabel: 'Delete account',
    });

    if (!confirmed) {
      return;
    }

    this.service.remove(account.id).subscribe({
      next: () => {
        this.toast.success('Account deleted', `${account.email} was removed.`);
        this.list.reload();
      },
      error: (error: unknown) => {
        this.toast.error('Delete failed', ApiError.from(error).message);
      },
    });
  }

  private resetForm(value: {
    full_name: string;
    email: string;
    password: string;
    role: AccountRole;
    status: ActiveStatus;
    max_rpm: number;
    max_rpd: number;
  }): void {
    this.formError.set(null);
    this.formErrorDetails.set([]);
    this.submitted.set(false);
    this.form.reset(value);
    this.formOpen.set(true);
  }
}
