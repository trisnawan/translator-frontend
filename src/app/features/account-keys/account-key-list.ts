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
import { AccountKeyService } from '../../core/services/account-key.service';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/lookup.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ListController } from '../../core/ui/list-controller';
import { ToastService } from '../../core/ui/toast.service';
import type { AccountKey, AccountKeyCreated, AccountKeyQuery } from '../../core/models/api.models';
import { formatDateTime } from '../../core/utils/format';
import { CopyField } from '../../shared/ui/copy-field/copy-field';
import { Modal } from '../../shared/ui/modal/modal';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { TableState } from '../../shared/ui/table-state/table-state';

interface AccountKeyFilters {
  account_id?: string;
}

/**
 * `/account-keys` — API credentials used by `POST /translate`.
 *
 * The plaintext `secret_key` is only ever returned by the insert endpoint, so
 * creating a key opens a one-time reveal dialog with a copy button. Rotation
 * sends a new value through the update endpoint; the stored key is never read
 * back, only its masked form.
 */
@Component({
  selector: 'app-account-key-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, Pagination, TableState, Modal, CopyField],
  template: `
    <app-page-header
      title="API Keys"
      subtitle="Credentials for POST /translate and for verifying callbacks."
      [crumbs]="crumbs"
    >
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="ph ph-plus me-1" aria-hidden="true"></i> New API key
      </button>
    </app-page-header>

    <div class="alert alert-info mt-4 d-flex align-items-start gap-2" role="alert">
      <i class="ph ph-shield-check mt-1" aria-hidden="true"></i>
      <span class="small">
        A signature token is built with the <code>secret_key</code> and sent together with
        <code>key_id</code>. The key itself is stored encrypted and shown
        <strong>only once</strong> — keep it in a secret manager.
      </span>
    </div>

    <div class="card mt-4">
      <div class="card-toolbar">
        <div class="filter-field">
          <label class="visually-hidden" for="key-search">Search API keys</label>
          <input
            id="key-search"
            type="search"
            class="form-control form-control-sm"
            placeholder="Search account or callback URL…"
            [value]="list.search()"
            (input)="onSearch($event)"
          />
        </div>

        @if (isAdmin()) {
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
        }

        <span class="toolbar-spacer"></span>
        <span class="text-muted small">{{ list.total() }} key(s)</span>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Key id</th>
              @if (isAdmin()) {
                <th scope="col">Account</th>
              }
              <th scope="col">Secret</th>
              <th scope="col">Callback URL</th>
              <th scope="col">Created</th>
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
                message="No API keys yet."
                hint="Create one to start sending translation requests."
              ></tr>
            } @else {
              @for (key of list.items(); track key.id) {
                <tr>
                  <td class="cell-mono">{{ key.id }}</td>
                  @if (isAdmin()) {
                    <td>
                      @if (key.account; as account) {
                        <span class="d-block fw-medium">{{ account.full_name }}</span>
                        <span class="text-muted small">{{ account.email }}</span>
                      } @else {
                        <span class="text-muted small">—</span>
                      }
                    </td>
                  }
                  <td>
                    @if (key.has_secret_key) {
                      <span class="badge badge-soft-success cell-mono">{{
                        key.secret_key_masked
                      }}</span>
                    } @else {
                      <span class="badge badge-soft-warning">not set</span>
                    }
                  </td>
                  <td class="small">
                    @if (key.callback_url) {
                      <a
                        [href]="key.callback_url"
                        target="_blank"
                        rel="noopener"
                        class="cell-truncate"
                      >
                        {{ key.callback_url }}
                      </a>
                    } @else {
                      <span class="text-muted">Polling only</span>
                    }
                  </td>
                  <td class="small text-muted text-nowrap">{{ created(key.created_at) }}</td>
                  <td class="text-end text-nowrap">
                    <button
                      type="button"
                      class="btn btn-sm btn-light"
                      (click)="openEdit(key)"
                      title="Edit"
                    >
                      <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                      <span class="visually-hidden">Edit key</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-light"
                      (click)="openDetail(key)"
                      title="Detail"
                    >
                      <i class="ph ph-eye" aria-hidden="true"></i>
                      <span class="visually-hidden">View key detail</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-light text-danger"
                      (click)="remove(key)"
                      title="Delete"
                    >
                      <i class="ph ph-trash" aria-hidden="true"></i>
                      <span class="visually-hidden">Delete key</span>
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

    <!-- Create -->
    <app-modal [(open)]="createOpen" title="New API key">
      <form [formGroup]="createForm" (ngSubmit)="create()" novalidate>
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

        @if (isAdmin()) {
          <div class="mb-3">
            <label class="form-label" for="key-account">Account</label>
            <select id="key-account" class="form-select" formControlName="account_id">
              <option value="">My own account</option>
              @for (account of lookups.sortedAccounts(); track account.id) {
                <option [value]="account.id">{{ account.full_name }} — {{ account.email }}</option>
              }
            </select>
            <div class="form-text">Admins may issue a key on behalf of another account.</div>
          </div>
        }

        <div class="mb-3">
          <label class="form-label" for="key-secret">Secret key</label>
          <input
            id="key-secret"
            type="password"
            class="form-control"
            formControlName="secret_key"
            autocomplete="new-password"
            placeholder="Leave blank to let the server generate one"
            [class.is-invalid]="showCreateError('secret_key')"
          />
          <div class="form-text">
            16–255 characters. Blank generates <code>sk_translator_&lt;64 hex&gt;</code>.
          </div>
          @if (showCreateError('secret_key')) {
            <div class="invalid-feedback d-block">
              Use at least 16 characters, or leave the field empty.
            </div>
          }
        </div>

        <div>
          <label class="form-label" for="key-callback">Callback URL</label>
          <input
            id="key-callback"
            type="url"
            class="form-control"
            formControlName="callback_url"
            placeholder="https://client.example.com/translator/callback"
          />
          <div class="form-text">
            Optional. Without it the API answers <code>callback_enabled: false</code> and you poll
            <code>GET /histories</code> instead.
          </div>
        </div>
      </form>

      <ng-container modalFooter>
        <button type="button" class="btn btn-light" (click)="createOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="create()">
          @if (saving()) {
            <span
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
          }
          Create key
        </button>
      </ng-container>
    </app-modal>

    <!-- Reveal once -->
    <app-modal [(open)]="revealOpen" title="Copy your secret key now" [staticBackdrop]="true">
      @if (createdKey(); as key) {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <i class="ph ph-warning mt-1" aria-hidden="true"></i>
          <span class="small">
            This value is shown once and stored encrypted. Store it in a password manager before
            closing this dialog.
          </span>
        </div>

        <label class="form-label small text-muted">key_id</label>
        <app-copy-field [value]="key.id" label="key id" />

        <label class="form-label small text-muted mt-3" for="revealed-secret">secret_key</label>
        <div id="revealed-secret">
          <app-copy-field [value]="key.secret_key" label="secret key" />
        </div>
      }

      <ng-container modalFooter>
        <button type="button" class="btn btn-primary" (click)="revealOpen.set(false)">
          I stored the key
        </button>
      </ng-container>
    </app-modal>

    <!-- Edit / rotate -->
    <app-modal [(open)]="editOpen" title="Edit API key">
      <form [formGroup]="editForm" (ngSubmit)="saveEdit()" novalidate>
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

        <label class="form-label small text-muted">key_id</label>
        <app-copy-field [value]="editing()?.id ?? ''" label="key id" />

        <div class="mt-3">
          <label class="form-label" for="edit-callback">Callback URL</label>
          <input
            id="edit-callback"
            type="url"
            class="form-control"
            formControlName="callback_url"
            placeholder="https://client.example.com/translator/callback"
          />
          <div class="form-text">Clear the field to switch this key to polling.</div>
        </div>

        <div class="form-check mt-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="edit-rotate"
            formControlName="rotate"
          />
          <label class="form-check-label" for="edit-rotate">Rotate the secret key</label>
        </div>

        @if (editForm.controls.rotate.value) {
          <div class="mt-2">
            <label class="form-label" for="edit-secret">New secret key</label>
            <input
              id="edit-secret"
              type="password"
              class="form-control"
              formControlName="secret_key"
              autocomplete="new-password"
              placeholder="At least 16 characters"
            />
            <div class="form-text">Existing integrations must be updated with the new value.</div>
          </div>
        }
      </form>

      <ng-container modalFooter>
        <button type="button" class="btn btn-light" (click)="editOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="saveEdit()">
          @if (saving()) {
            <span
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
          }
          Save changes
        </button>
      </ng-container>
    </app-modal>

    <!-- Detail -->
    <app-modal [(open)]="detailOpen" title="API key detail">
      @if (detailLoading()) {
        <p class="text-muted mb-0">
          <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          Loading…
        </p>
      } @else if (detail(); as key) {
        <dl class="row mb-3">
          <dt class="col-4 text-muted fw-normal">Account</dt>
          <dd class="col-8">
            @if (key.account; as account) {
              {{ account.full_name }}
              <span class="text-muted small">({{ account.email }})</span>
            } @else {
              <span class="text-muted">—</span>
            }
          </dd>

          <dt class="col-4 text-muted fw-normal">Secret</dt>
          <dd class="col-8">
            <span class="badge badge-soft-secondary cell-mono">{{ key.secret_key_masked }}</span>
          </dd>

          <dt class="col-4 text-muted fw-normal">Callback</dt>
          <dd class="col-8">{{ key.callback_url ?? 'Polling only' }}</dd>

          <dt class="col-4 text-muted fw-normal">Created</dt>
          <dd class="col-8 mb-0">{{ created(key.created_at) }}</dd>
        </dl>

        <label class="form-label small text-muted">key_id</label>
        <app-copy-field [value]="key.id" label="key id" />
      }
    </app-modal>
  `,
})
export class AccountKeyList {
  private readonly service = inject(AccountKeyService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly lookups = inject(LookupService);
  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'API Keys' }];
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly accountFilter = signal('');

  private readonly filters = computed<AccountKeyFilters>(() => {
    const account = this.accountFilter();
    return account ? { account_id: account } : {};
  });

  protected readonly list = new ListController<AccountKey, AccountKeyQuery>(
    {
      load: (query) => this.service.list(query),
      filters: this.filters,
    },
    inject(DestroyRef),
  );

  protected readonly columnCount = computed(() => (this.isAdmin() ? 6 : 5));
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorDetails = signal<string[]>([]);

  protected readonly createOpen = signal(false);
  protected readonly revealOpen = signal(false);
  protected readonly createdKey = signal<AccountKeyCreated | null>(null);

  protected readonly editOpen = signal(false);
  protected readonly editing = signal<AccountKey | null>(null);

  protected readonly detailOpen = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly detail = signal<AccountKey | null>(null);

  private readonly submitted = signal(false);

  protected readonly createForm = this.formBuilder.nonNullable.group({
    account_id: [''],
    secret_key: ['', [Validators.minLength(16)]],
    callback_url: [''],
  });

  protected readonly editForm = this.formBuilder.nonNullable.group({
    callback_url: [''],
    rotate: [false],
    secret_key: [''],
  });

  constructor() {
    this.list.connect();

    if (this.isAdmin()) {
      this.lookups.ensureLoaded({ accounts: true }).subscribe();
    }
  }

  protected created(value: string): string {
    return formatDateTime(value);
  }

  protected showCreateError(control: 'secret_key'): boolean {
    const field = this.createForm.controls[control];
    return field.invalid && (field.touched || this.submitted());
  }

  protected onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  protected onAccountChange(event: Event): void {
    this.accountFilter.set((event.target as HTMLSelectElement).value);
    this.list.applyFilters();
  }

  protected openCreate(): void {
    this.formError.set(null);
    this.formErrorDetails.set([]);
    this.submitted.set(false);
    this.createForm.reset({ account_id: '', secret_key: '', callback_url: '' });
    this.createOpen.set(true);
  }

  protected create(): void {
    this.submitted.set(true);

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const value = this.createForm.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.formErrorDetails.set([]);

    this.service
      .create({
        ...(value.account_id ? { account_id: value.account_id } : {}),
        ...(value.secret_key ? { secret_key: value.secret_key } : {}),
        ...(value.callback_url ? { callback_url: value.callback_url } : {}),
      })
      .subscribe({
        next: (key) => {
          this.saving.set(false);
          this.createOpen.set(false);
          this.createdKey.set(key);
          this.revealOpen.set(true);
          this.list.reload();
        },
        error: (error: unknown) => {
          const apiError = ApiError.from(error);
          this.saving.set(false);
          this.formError.set(apiError.message);
          this.formErrorDetails.set(apiError.fieldMessages);
        },
      });
  }

  protected openEdit(key: AccountKey): void {
    this.editing.set(key);
    this.formError.set(null);
    this.formErrorDetails.set([]);
    this.submitted.set(false);
    this.editForm.reset({ callback_url: key.callback_url ?? '', rotate: false, secret_key: '' });
    this.editOpen.set(true);
  }

  protected saveEdit(): void {
    const key = this.editing();
    if (!key) {
      return;
    }

    const value = this.editForm.getRawValue();

    if (value.rotate && value.secret_key.length < 16) {
      this.formError.set('New secret key is too short');
      this.formErrorDetails.set(['Use at least 16 characters, or untick the rotation box.']);
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.formErrorDetails.set([]);

    const payload = {
      // `null` clears the URL, which switches the key to polling.
      callback_url: value.callback_url.trim() ? value.callback_url.trim() : null,
      ...(value.rotate && value.secret_key ? { secret_key: value.secret_key } : {}),
    };

    this.service.update(key.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.toast.success(
          value.rotate ? 'Key rotated' : 'Key updated',
          value.rotate
            ? 'Update your integrations with the new secret key.'
            : 'The callback URL was saved.',
        );
        this.list.reload();
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.saving.set(false);
        this.formError.set(apiError.message);
        this.formErrorDetails.set(apiError.fieldMessages);
      },
    });
  }

  protected openDetail(key: AccountKey): void {
    this.detail.set(null);
    this.detailLoading.set(true);
    this.detailOpen.set(true);

    this.service.detail(key.id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.detailLoading.set(false);
        this.detailOpen.set(false);
        this.toast.error('Could not load the key', ApiError.from(error).message);
      },
    });
  }

  protected async remove(key: AccountKey): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete API key',
      message: `Delete key ${key.id}?`,
      details: ['Any integration still signing with this key starts failing immediately with 401.'],
      confirmLabel: 'Delete key',
    });

    if (!confirmed) {
      return;
    }

    this.service.remove(key.id).subscribe({
      next: () => {
        this.toast.success('Key deleted', 'The API key was removed.');
        this.list.reload();
      },
      error: (error: unknown) => {
        this.toast.error('Delete failed', ApiError.from(error).message);
      },
    });
  }
}
