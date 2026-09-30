import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Extra lines rendered as a bullet list, e.g. field level errors. */
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Bootstrap button variant for the confirm action. */
  variant?: 'danger' | 'primary' | 'warning';
  /** When `false` the dialog closes as soon as the confirm button is pressed. */
  pending?: boolean;
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'details'>> {
  details: string[];
}

interface PendingConfirm {
  request: ConfirmRequest;
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise based confirmation dialog.
 *
 * Pages stay linear — `if (!(await this.confirm.ask({…}))) return;` — instead of
 * carrying a `pendingDelete` field plus a dialog in every template. The visual
 * side lives in `ConfirmHost`, which is mounted once in `MainLayoutComponent`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pendingSignal = signal<PendingConfirm | null>(null);

  readonly pending = this.pendingSignal.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this.settle(false);

    return new Promise<boolean>((resolve) => {
      this.pendingSignal.set({
        request: {
          title: options.title,
          message: options.message,
          details: options.details ?? [],
          confirmLabel: options.confirmLabel ?? 'Confirm',
          cancelLabel: options.cancelLabel ?? 'Cancel',
          variant: options.variant ?? 'danger',
          pending: options.pending ?? false,
        },
        resolve,
      });
    });
  }

  /** Called by the dialog buttons / close handler. */
  settle(confirmed: boolean): void {
    const pending = this.pendingSignal();

    if (!pending) {
      return;
    }

    this.pendingSignal.set(null);
    pending.resolve(confirmed);
  }
}
