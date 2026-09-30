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
import { LanguageService } from '../../core/services/language.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ListController } from '../../core/ui/list-controller';
import { ToastService } from '../../core/ui/toast.service';
import type { ActiveStatus, Language, LanguageQuery } from '../../core/models/api.models';
import { Modal } from '../../shared/ui/modal/modal';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Pagination } from '../../shared/ui/pagination/pagination';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';
import { TableState } from '../../shared/ui/table-state/table-state';

interface LanguageFilters {
  status?: ActiveStatus;
}

/**
 * `/languages` — the language catalogue used by translation requests.
 *
 * Clients get a read-only view (they only need the list to pick codes); admins
 * additionally see the create/edit dialog and the status filter.
 */
@Component({
  selector: 'app-language-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeader, Pagination, StatusBadge, TableState, Modal],
  template: `
    <app-page-header
      title="Languages"
      subtitle="ISO 639-1 codes accepted by POST /translate."
      [crumbs]="crumbs"
    >
      @if (isAdmin()) {
        <button type="button" class="btn btn-primary" (click)="openCreate()">
          <i class="ph ph-plus me-1" aria-hidden="true"></i> New language
        </button>
      }
    </app-page-header>

    <div class="card mt-4">
      <div class="card-toolbar">
        <div class="filter-field">
          <label class="visually-hidden" for="language-search">Search languages</label>
          <input
            id="language-search"
            type="search"
            class="form-control form-control-sm"
            placeholder="Search code or name…"
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

        <span class="toolbar-spacer"></span>

        <span class="text-muted small">{{ list.total() }} language(s)</span>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
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
                message="No languages found."
                hint="Adjust the filters, or add the first language."
              ></tr>
            } @else {
              @for (language of list.items(); track language.id) {
                <tr>
                  <td>
                    <span class="badge badge-soft-primary cell-mono">{{ language.id }}</span>
                  </td>
                  <td class="fw-medium">{{ language.name }}</td>
                  <td><app-status-badge [value]="language.status" /></td>
                  @if (isAdmin()) {
                    <td class="text-end">
                      <button
                        type="button"
                        class="btn btn-sm btn-light"
                        (click)="openEdit(language)"
                      >
                        <i class="ph ph-pencil-simple" aria-hidden="true"></i>
                        <span class="visually-hidden">Edit {{ language.name }}</span>
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

    <app-modal [(open)]="formOpen" [title]="editing() ? 'Edit language' : 'New language'">
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
          <label class="form-label" for="language-id">ISO 639-1 code</label>
          <input
            id="language-id"
            class="form-control cell-mono"
            formControlName="id"
            maxlength="2"
            placeholder="en"
            [readonly]="editing() !== null"
            [class.is-invalid]="showError('id')"
          />
          <div class="form-text">
            Two lowercase letters. The code cannot be changed after creation.
          </div>
          @if (showError('id')) {
            <div class="invalid-feedback d-block">
              Enter exactly two letters, e.g. <code>id</code> or <code>en</code>.
            </div>
          }
        </div>

        <div class="mb-3">
          <label class="form-label" for="language-name">Display name</label>
          <input
            id="language-name"
            class="form-control"
            formControlName="name"
            maxlength="100"
            placeholder="English"
            [class.is-invalid]="showError('name')"
          />
          @if (showError('name')) {
            <div class="invalid-feedback d-block">Name is required (max 100 characters).</div>
          }
        </div>

        <div>
          <label class="form-label" for="language-status">Status</label>
          <select id="language-status" class="form-select" formControlName="status">
            <option value="active">Active — usable for translation</option>
            <option value="inactive">Inactive — hidden from new requests</option>
          </select>
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
          {{ editing() ? 'Save changes' : 'Create language' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class LanguageList {
  private readonly service = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly crumbs = [{ label: 'Home', link: '/dashboard' }, { label: 'Languages' }];
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly statusFilter = signal<ActiveStatus | ''>('');

  private readonly filters = computed<LanguageFilters>(() => {
    const status = this.statusFilter();
    return status ? { status } : {};
  });

  protected readonly list = new ListController<Language, LanguageQuery>(
    {
      load: (query) => this.service.list(query),
      filters: this.filters,
    },
    inject(DestroyRef),
  );

  protected readonly columnCount = computed(() => (this.isAdmin() ? 4 : 3));
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Language | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorDetails = signal<string[]>([]);
  private readonly submitted = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    id: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]{2}$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    status: ['active' as ActiveStatus, [Validators.required]],
  });

  constructor() {
    this.list.connect();
  }

  protected onSearch(event: Event): void {
    this.list.setSearch((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as ActiveStatus | '');
    this.list.applyFilters();
  }

  protected showError(control: 'id' | 'name'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || this.submitted());
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.formErrorDetails.set([]);
    this.submitted.set(false);
    this.form.reset({ id: '', name: '', status: 'active' });
    this.formOpen.set(true);
  }

  protected openEdit(language: Language): void {
    this.editing.set(language);
    this.formError.set(null);
    this.formErrorDetails.set([]);
    this.submitted.set(false);
    this.form.reset({ id: language.id, name: language.name, status: language.status });
    this.formOpen.set(true);
  }

  protected async save(): Promise<void> {
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

    const request = editing
      ? this.service.update(editing.id, { name: value.name, status: value.status })
      : this.service.create({ id: value.id.toLowerCase(), name: value.name, status: value.status });

    request.subscribe({
      next: (language) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(
          editing ? 'Language updated' : 'Language created',
          `${language.id} — ${language.name}`,
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
}
