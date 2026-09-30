import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Server-side pagination footer rendered under every list table.
 *
 * Emits page changes; page size changes are emitted separately so the owner can
 * reset the offset (handled by `ListController.setLimit`).
 */
@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .pagination-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.875rem 1.25rem;
      border-top: 1px solid var(--border-color);
    }

    .pagination-bar .pagination {
      margin: 0;
    }

    .pagination-size {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .pagination-size .form-select {
      width: auto;
    }
  `,
  template: `
    <div class="pagination-bar">
      <p class="mb-0 small text-muted">
        @if (total() === 0) {
          No results
        } @else {
          Showing <strong>{{ firstRow() }}</strong
          >–<strong>{{ lastRow() }}</strong> of
          <strong>{{ total() }}</strong>
        }
      </p>

      <nav aria-label="Pagination">
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item" [class.disabled]="page() <= 1">
            <button
              type="button"
              class="page-link"
              (click)="goTo(page() - 1)"
              aria-label="Previous page"
            >
              <i class="ph ph-caret-left" aria-hidden="true"></i>
            </button>
          </li>

          @for (entry of window(); track $index) {
            @if (entry === 'gap') {
              <li class="page-item disabled"><span class="page-link">…</span></li>
            } @else {
              <li class="page-item" [class.active]="entry === page()">
                <button type="button" class="page-link" (click)="goTo(entry)">{{ entry }}</button>
              </li>
            }
          }

          <li class="page-item" [class.disabled]="page() >= totalPages()">
            <button
              type="button"
              class="page-link"
              (click)="goTo(page() + 1)"
              aria-label="Next page"
            >
              <i class="ph ph-caret-right" aria-hidden="true"></i>
            </button>
          </li>
        </ul>
      </nav>

      <label class="pagination-size small text-muted">
        Rows
        <select
          class="form-select form-select-sm"
          [value]="limit()"
          (change)="onLimitChange($event)"
          aria-label="Rows per page"
        >
          @for (option of sizeOptions(); track option) {
            <option [value]="option" [selected]="option === limit()">{{ option }}</option>
          }
        </select>
      </label>
    </div>
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly limit = input.required<number>();
  readonly total = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly firstRow = input.required<number>();
  readonly lastRow = input.required<number>();
  readonly window = input.required<(number | 'gap')[]>();
  readonly sizeOptions = input<readonly number[]>([10, 25, 50, 100]);

  readonly pageChange = output<number>();
  readonly limitChange = output<number>();

  protected goTo(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }

    this.pageChange.emit(page);
  }

  protected onLimitChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(value) && value > 0) {
      this.limitChange.emit(value);
    }
  }
}
