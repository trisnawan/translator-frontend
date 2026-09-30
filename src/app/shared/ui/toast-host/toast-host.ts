import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService, type ToastVariant } from '../../../core/ui/toast.service';

const ICONS: Record<ToastVariant, string> = {
  success: 'ph-check-circle',
  danger: 'ph-x-circle',
  warning: 'ph-warning',
  info: 'ph-info',
};

/**
 * Fixed bottom-right stack of Bootstrap toasts driven by `ToastService`.
 * Mounted once in the main layout and once on the login screen.
 */
@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast-container position-fixed bottom-0 end-0 p-3"
      aria-live="polite"
      aria-atomic="true"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          class="toast show align-items-center border-0 mb-2"
          [class]="variantClass(toast.variant)"
          role="alert"
        >
          <div class="d-flex">
            <div class="toast-body d-flex align-items-start gap-2">
              <i class="ph {{ icon(toast.variant) }} fs-5"></i>
              <span>
                <strong class="d-block">{{ toast.title }}</strong>
                <span class="small">{{ toast.message }}</span>
              </span>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto"
              [class.btn-close-white-dark]="toast.variant === 'warning'"
              aria-label="Close"
              (click)="dismiss(toast.id)"
            ></button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  private readonly service = inject(ToastService);

  protected readonly toasts = this.service.toasts;

  protected icon(variant: ToastVariant): string {
    return ICONS[variant];
  }

  protected variantClass(variant: ToastVariant): string {
    return `bg-${variant}`;
  }

  protected dismiss(id: number): void {
    this.service.dismiss(id);
  }
}
