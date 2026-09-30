import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Slim footer shown under the content area. */
@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-brand">
          <span class="footer-brand-mark"><i class="bi bi-translate" aria-hidden="true"></i></span>
          <span class="footer-copyright">
            &copy; {{ year }} Translator Service —
            <span class="text-muted small">TrendyAdmin template</span>
          </span>
        </div>
      </div>
    </footer>
  `,
})
export class Footer {
  protected readonly year = new Date().getFullYear();
}
