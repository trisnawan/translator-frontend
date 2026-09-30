import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { ToastService } from '../../../core/ui/toast.service';

/**
 * Read-only field with a copy-to-clipboard button.
 *
 * Used for values that are only ever displayed once — most importantly the
 * plaintext `secret_key` returned by `POST /account-keys/insert`.
 */
@Component({
  selector: 'app-copy-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .copy-field {
      display: flex;
      align-items: stretch;
      gap: 0.5rem;
    }

    .copy-field code {
      flex: 1 1 auto;
      min-width: 0;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background-color: var(--background-color);
      color: var(--heading-color);
      overflow-x: auto;
      white-space: nowrap;
    }
  `,
  template: `
    <div class="copy-field">
      <code>{{ value() }}</code>
      <button
        type="button"
        class="btn btn-sm"
        [class.btn-success]="copied()"
        [class.btn-light]="!copied()"
        [attr.aria-label]="'Copy ' + label()"
        (click)="copy()"
      >
        <i class="ph" [class.ph-check]="copied()" [class.ph-copy]="!copied()"></i>
        <span class="ms-1">{{ copied() ? 'Copied' : 'Copy' }}</span>
      </button>
    </div>
  `,
})
export class CopyField {
  private readonly toast = inject(ToastService);

  readonly value = input.required<string>();
  /** Used in the button label and accessibility text. */
  readonly label = input('value');

  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toast.warning('Copy failed', 'Select the value and copy it manually.');
    }
  }
}
