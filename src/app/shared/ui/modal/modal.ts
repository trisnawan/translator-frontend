import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  model,
  viewChild,
} from '@angular/core';

/**
 * Thin wrapper around the Bootstrap 5 modal plugin.
 *
 * Declarative usage keeps forms and confirmations inside the page template while
 * Bootstrap owns the backdrop, focus trap, ESC handling and scroll lock:
 *
 * ```html
 * <app-modal [(open)]="formOpen" title="New language">
 *   <form>…</form>
 * </app-modal>
 * ```
 *
 * The plugin is instantiated the first time the dialog opens, so list pages with
 * several dialogs do not pay for plugins they never use.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #dialog class="modal fade" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" [class]="sizeClass()">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ title() }}</h5>
            <button type="button" class="btn-close" aria-label="Close" (click)="close()"></button>
          </div>

          <div class="modal-body">
            <ng-content />
          </div>

          @if (hasFooter()) {
            <div class="modal-footer">
              <ng-content select="[modalFooter]" />
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class Modal implements OnDestroy {
  readonly title = input.required<string>();
  readonly size = input<'sm' | 'lg' | 'xl' | ''>('');
  /** Two-way flag; set it to `true` to show the dialog. */
  readonly open = model(false);
  /** When `true` the dialog cannot be dismissed by clicking the backdrop. */
  readonly staticBackdrop = input(false);
  /** Hides the footer wrapper when no `[modalFooter]` content is projected. */
  readonly hasFooter = input(true);

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private instance: BootstrapModalInstance | null = null;
  private applied = false;

  protected readonly sizeClass = computed(() => (this.size() ? `modal-${this.size()}` : ''));

  constructor() {
    effect(() => {
      const shouldOpen = this.open();
      const element = this.dialog()?.nativeElement;

      // `viewChild` is reactive: this effect re-runs once the dialog renders.
      if (!element || shouldOpen === this.applied) {
        return;
      }

      this.applied = shouldOpen;
      const modal = this.instance ?? this.instantiate(element);

      if (shouldOpen) {
        modal?.show();
      } else {
        modal?.hide();
      }
    });
  }

  ngOnDestroy(): void {
    this.instance?.dispose();
    this.instance = null;
  }

  protected close(): void {
    this.open.set(false);
  }

  private instantiate(element: HTMLElement): BootstrapModalInstance | null {
    const plugin = window.bootstrap?.Modal;

    if (!plugin) {
      // Bootstrap unavailable (tests, stripped build): toggle the classes by
      // hand so the dialog stays usable.
      element.classList.toggle('show', this.open());
      element.classList.toggle('d-block', this.open());
      document.body.classList.toggle('modal-open', this.open());
      return null;
    }

    this.instance = plugin.getOrCreateInstance(element, {
      backdrop: this.staticBackdrop() ? 'static' : true,
    });

    // Bootstrap can close the dialog itself (ESC, backdrop click), so mirror
    // that back into the model.
    element.addEventListener('hidden.bs.modal', () => {
      this.applied = false;
      this.open.set(false);
    });

    return this.instance;
  }
}
