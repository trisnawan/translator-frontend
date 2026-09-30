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
import { AuthService } from '../../core/services/auth.service';
import { DriverService } from '../../core/services/driver.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ListController } from '../../core/ui/list-controller';
import { ToastService } from '../../core/ui/toast.service';
import type { ActiveStatus, Driver, DriverQuery, DriverType } from '../../core/models/api.models';
import { formatQuota } from '../../core/utils/format';
import { Modal } from '../../shared/ui/modal/modal';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { TableState } from '../../shared/ui/table-state/table-state';

interface DriverFilters {
  status?: ActiveStatus;
  type?: DriverType;
}

/**
 * Driver id grammar, mirrored from the backend (`DRIVER_ID_PATTERN` in
 * `translator-backend/src/modules/drivers/dto/create-driver.dto.ts`): 3–20
 * lowercase letters, numbers, dot, dash or underscore. The prefix decides the
 * engine (`gemini*`, `claude*`, `deepseek*`, `google-translate*`).
 */
export const DRIVER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,19}$/;

/**
 * `/drivers` — translation engines.
 *
 * Admins see and manage every driver; clients only see the drivers granted
 * through `/account-drivers`, and the mutation controls are hidden for them.
 */
@Component({
  selector: 'app-driver-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, Pagination, StatusBadge, TableState, Modal],
  template: `
    <app-page-header
      title="Drivers"
      subtitle="Engines that execute translation jobs."
      [crumbs]="crumbs"
    >
      @if (isAdmin()) {
        <button type="button" class="btn btn-primary" (click)="openCreate()">
          <i class="ph ph-plus me-1" aria-hidden="true"></i> New driver
        </button>
      }
    </app-page-header>

    @if (!isAdmin()) {
      <div class="alert alert-info mt-4 d-flex align-items-start gap-2" role="alert">
        <i class="ph ph-info mt-1" aria-hidden="true"></i>
        <span class="small">
          You see the drivers granted to your account. Ask an administrator if a driver you need is
          missing, and remember to send its <code>id</code> as <code>driver_id</code> in
          <code>POST /translate</code>.
        </span>
      </div>
    }

    <div class="card mt-4">
      <div class="card-toolbar">
        <div class="filter-field">
          <label class="visually-hidden" for="driver-search">Search drivers</label>
          <input
            id="driver-search"
            type="search"
            class="form-control form-control-sm"
            placeholder="Search id or name…"
            [value]="list.search()"
            (input)="onSearch($event)"
          />
        </div>

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

        <label class="d-flex align-items-center gap-2 small text-muted mb-0">
          Type
          <select
            class="form-select form-select-sm filter-field"
            [value]="typeFilter()"
            (change)="onTypeChange($event)"
          >
            <option value="">All</option>
            <option value="ai">AI</option>
            <option value="api">API</option>
          </select>
        </label>

        <span class="toolbar-spacer"></span>
        <span class="text-muted small">{{ list.total() }} driver(s)</span>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Driver</th>
              <th scope="col">Type</th>
              <th scope="col">Engine</th>
              <th scope="col">Status</th>
              <th scope="col">Quota (rpm / rpd)</th>
              <th scope="col">Provider key</th>
              @if (isAdmin()) {
                <th scope="col" class="text-end">Actions</th>
              }
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
                message="No drivers found."
                hint="Adjust the filters, or register a new driver."
              ></tr>
            } @else {
              @for (driver of list.items(); track driver.id) {
                <tr>
                  <td>
                    <span class="d-block fw-medium">{{ driver.name }}</span>
                    <span class="text-muted cell-mono">{{ driver.id }}</span>
                  </td>
                  <td><app-status-badge [value]="driver.type" /></td>
                  <td>
                    @if (driver.engine; as engine) {
                      <span class="badge badge-soft-secondary">{{ engine }}</span>
                    } @else {
                      <span class="text-muted small">Unknown prefix</span>
                    }
                  </td>
                  <td><app-status-badge [value]="driver.status" /></td>
                  <td class="small text-nowrap">
                    {{ quota(driver.max_rpm) }} <span class="text-muted">/</span>
                    {{ quota(driver.max_rpd) }}
                  </td>
                  <td>
                    @if (driver.has_secret_key) {
                      <span class="badge badge-soft-success"
                        ><i class="ph ph-lock-key me-1"></i>Configured</span
                      >
                    } @else {
                      <span class="badge badge-soft-warning"
                        ><i class="ph ph-warning me-1"></i>Missing</span
                      >
                    }
                  </td>
                  @if (isAdmin()) {
                    <td class="text-end text-nowrap">
                      <button type="button" class="btn btn-sm btn-light" (click)="openEdit(driver)">
                        <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                        <span class="visually-hidden">Edit {{ driver.name }}</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-light text-danger"
                        (click)="remove(driver)"
                      >
                        <i class="ph ph-trash" aria-hidden="true"></i>
                        <span class="visually-hidden">Delete {{ driver.name }}</span>
                      </button>
                    </td>
                  }
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

    <app-modal [(open)]="formOpen" [title]="editing() ? 'Edit driver' : 'New driver'" size="lg">
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
            <label class="form-label" for="driver-id">Driver id</label>
            <input
              id="driver-id"
              class="form-control cell-mono"
              formControlName="id"
              placeholder="gemini-3.8-flash"
              maxlength="20"
              [readonly]="editing() !== null"
              [class.is-invalid]="showError('id')"
            />
            <div class="form-text">
              Must start with an engine prefix: <code>gemini</code>, <code>claude</code>,
              <code>deepseek</code> or <code>google-translate</code>.
            </div>
            @if (showError('id')) {
              <div class="invalid-feedback d-block">
                Use 3–20 lowercase letters, numbers, dots, dashes or underscores, starting with an
                engine prefix.
              </div>
            }
          </div>

          <div class="col-md-6">
            <label class="form-label" for="driver-name">Display name</label>
            <input
              id="driver-name"
              class="form-control"
              formControlName="name"
              maxlength="100"
              placeholder="Gemini Flash"
              [class.is-invalid]="showError('name')"
            />
            @if (showError('name')) {
              <div class="invalid-feedback d-block">Name is required (max 100 characters).</div>
            }
          </div>

          <div class="col-md-4">
            <label class="form-label" for="driver-type">Type</label>
            <select id="driver-type" class="form-select" formControlName="type">
              <option value="ai">AI</option>
              <option value="api">API</option>
            </select>
          </div>

          <div class="col-md-4">
            <label class="form-label" for="driver-status">Status</label>
            <select id="driver-status" class="form-select" formControlName="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div class="col-md-2">
            <label class="form-label" for="driver-rpm">Max rpm</label>
            <input
              id="driver-rpm"
              type="number"
              min="0"
              class="form-control"
              formControlName="max_rpm"
            />
          </div>

          <div class="col-md-2">
            <label class="form-label" for="driver-rpd">Max rpd</label>
            <input
              id="driver-rpd"
              type="number"
              min="0"
              class="form-control"
              formControlName="max_rpd"
            />
          </div>

          <div class="col-12">
            <label class="form-label" for="driver-secret">Provider secret key</label>
            <input
              id="driver-secret"
              type="password"
              class="form-control"
              formControlName="secret_key"
              autocomplete="new-password"
              [placeholder]="
                editing()?.has_secret_key ? 'Leave blank to keep the current key' : 'AIza…'
              "
            />
            <div class="form-text">
              Stored encrypted (AES-256-GCM) and never returned by the API. Send an empty value to
              clear it.
            </div>
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
          {{ editing() ? 'Save changes' : 'Create driver' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class DriverList {
  private readonly service = inject(DriverService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'Drivers' }];
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly statusFilter = signal<ActiveStatus | ''>('');
  protected readonly typeFilter = signal<DriverType | ''>('');

  private readonly filters = computed<DriverFilters>(() => {
    const status = this.statusFilter();
    const type = this.typeFilter();
    return { ...(status ? { status } : {}), ...(type ? { type } : {}) };
  });

  protected readonly list = new ListController<Driver, DriverQuery>(
    {
      load: (query) => this.service.list(query),
      filters: this.filters,
    },
    inject(DestroyRef),
  );

  protected readonly columnCount = computed(() => (this.isAdmin() ? 7 : 6));
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Driver | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorDetails = signal<string[]>([]);
  private readonly submitted = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    id: ['', [Validators.required, Validators.pattern(DRIVER_ID_PATTERN)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['ai' as DriverType, [Validators.required]],
    status: ['active' as ActiveStatus, [Validators.required]],
    max_rpm: [0, [Validators.min(0)]],
    max_rpd: [0, [Validators.min(0)]],
    secret_key: [''],
  });

  constructor() {
    this.list.connect();
  }

  protected quota(value: number): string {
    return formatQuota(value);
  }

  protected onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as ActiveStatus | '');
    this.list.applyFilters();
  }

  protected onTypeChange(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value as DriverType | '');
    this.list.applyFilters();
  }

  protected showError(control: 'id' | 'name'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || this.submitted());
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.resetForm({
      id: '',
      name: '',
      type: 'ai',
      status: 'active',
      max_rpm: 0,
      max_rpd: 0,
      secret_key: '',
    });
  }

  protected openEdit(driver: Driver): void {
    this.editing.set(driver);
    this.resetForm({
      id: driver.id,
      name: driver.name,
      type: driver.type,
      status: driver.status,
      max_rpm: driver.max_rpm,
      max_rpd: driver.max_rpd,
      secret_key: '',
    });
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

    const payload = {
      name: value.name,
      type: value.type,
      status: value.status,
      max_rpm: Number(value.max_rpm) || 0,
      max_rpd: Number(value.max_rpd) || 0,
      // An empty field means "leave the stored key alone" on update.
      ...(value.secret_key ? { secret_key: value.secret_key } : {}),
    };

    const request = editing
      ? this.service.update(editing.id, payload)
      : this.service.create({ ...payload, id: value.id.toLowerCase() });

    request.subscribe({
      next: (driver) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(
          editing ? 'Driver updated' : 'Driver created',
          `${driver.id} — ${driver.name}`,
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

  protected async remove(driver: Driver): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete driver',
      message: `Permanently delete “${driver.name}” (${driver.id})?`,
      details: [
        'Drivers already used by a translation job cannot be deleted — deactivate them instead.',
        'Deleting also removes the driver grants of every account.',
      ],
      confirmLabel: 'Delete driver',
    });

    if (!confirmed) {
      return;
    }

    this.service.remove(driver.id).subscribe({
      next: () => {
        this.toast.success('Driver deleted', `${driver.id} was removed.`);
        this.list.reload();
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.toast.error('Delete failed', apiError.message);
      },
    });
  }

  private resetForm(value: {
    id: string;
    name: string;
    type: DriverType;
    status: ActiveStatus;
    max_rpm: number;
    max_rpd: number;
    secret_key: string;
  }): void {
    this.formError.set(null);
    this.formErrorDetails.set([]);
    this.submitted.set(false);
    this.form.reset(value);
    this.formOpen.set(true);
  }
}
