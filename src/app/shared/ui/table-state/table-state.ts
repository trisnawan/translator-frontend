import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type TableStateMode = 'loading' | 'empty' | 'error';

const DEFAULT_MESSAGE: Record<TableStateMode, string> = {
  loading: 'Loading…',
  empty: 'Nothing to show yet.',
  error: 'Could not load data.',
};

/**
 * Placeholder row rendered inside a `<tbody>` while a list is loading, has
 * failed, or came back empty.
 *
 * Declared with an attribute selector so it can sit directly in the table body:
 *
 * ```html
 * <tbody>
 *   @if (list.loading()) {
 *     <tr app-table-state mode="loading" [colspan]="6"></tr>
 *   }
 * </tbody>
 * ```
 */
@Component({
  selector: 'tr[app-table-state]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'table-state-row' },
  template: `
    <td [attr.colspan]="colspan()" class="table-state-cell">
      @switch (mode()) {
        @case ('loading') {
          <span
            class="spinner-border spinner-border-sm text-primary me-2"
            role="status"
            aria-hidden="true"
          ></span>
          <span class="text-muted">{{ text() }}</span>
        }
        @case ('error') {
          <i class="ph ph-warning-circle d-block fs-3 text-danger mb-2"></i>
          <span class="text-danger d-block">{{ text() }}</span>
        }
        @default {
          <i class="ph ph-tray d-block fs-3 text-muted mb-2"></i>
          <span class="text-muted d-block">{{ text() }}</span>
        }
      }

      @if (hint(); as hintText) {
        <span class="text-muted small d-block mt-1">{{ hintText }}</span>
      }
    </td>
  `,
})
export class TableState {
  readonly mode = input<TableStateMode>('loading');
  readonly colspan = input<number>(1);
  /** Overrides the default copy for the current mode. */
  readonly message = input<string>();
  /** Secondary line, e.g. "Adjust the filters and try again." */
  readonly hint = input<string>();

  protected readonly text = computed(() => this.message() ?? DEFAULT_MESSAGE[this.mode()]);
}
