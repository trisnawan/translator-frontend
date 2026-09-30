import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ConfirmService } from '../../../core/ui/confirm.service';
import { Modal } from '../modal/modal';

/**
 * Renders the dialog requested through `ConfirmService`. Mounted once, in
 * `MainLayoutComponent`.
 */
@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal
      [open]="isOpen()"
      (openChange)="onOpenChange($event)"
      [title]="title()"
      size="sm"
      [hasFooter]="true"
    >
      <p class="mb-0">{{ message() }}</p>

      @if (details().length) {
        <ul class="small text-muted mt-3 mb-0 ps-3">
          @for (detail of details(); track detail) {
            <li>{{ detail }}</li>
          }
        </ul>
      }

      <ng-container modalFooter>
        <button type="button" class="btn btn-light" (click)="cancel()">{{ cancelLabel() }}</button>
        <button type="button" class="btn" [class]="confirmClass()" (click)="confirm()">
          {{ confirmLabel() }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class ConfirmHost {
  private readonly service = inject(ConfirmService);
  private readonly pending = this.service.pending;

  protected readonly isOpen = computed(() => this.pending() !== null);
  protected readonly title = computed(() => this.pending()?.request.title ?? 'Please confirm');
  protected readonly message = computed(() => this.pending()?.request.message ?? '');
  protected readonly details = computed(() => this.pending()?.request.details ?? []);
  protected readonly confirmLabel = computed(
    () => this.pending()?.request.confirmLabel ?? 'Confirm',
  );
  protected readonly cancelLabel = computed(() => this.pending()?.request.cancelLabel ?? 'Cancel');
  protected readonly confirmClass = computed(
    () => `btn-${this.pending()?.request.variant ?? 'danger'}`,
  );

  /** Dismissing with ESC or the backdrop counts as "cancel". */
  protected onOpenChange(open: boolean): void {
    if (!open) {
      this.service.settle(false);
    }
  }

  protected cancel(): void {
    this.service.settle(false);
  }

  protected confirm(): void {
    this.service.settle(true);
  }
}
