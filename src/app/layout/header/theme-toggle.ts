import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../../core/ui/theme.service';

/**
 * Header button that flips light/dark mode.
 *
 * Deliberately uses `.js-theme-toggle` rather than the template's
 * `.theme-toggle` class: `assets/js/theme.js` binds its own click handler to
 * that class, and two handlers would cancel each other out. `ThemeService`
 * delegates to `window.Theme` so both stay in sync.
 */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="header-action js-theme-toggle"
      [attr.aria-label]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      [attr.aria-pressed]="isDark()"
      (click)="theme.toggle()"
    >
      <i class="ph" [class.ph-sun]="isDark()" [class.ph-moon]="!isDark()" aria-hidden="true"></i>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly isDark = this.theme.isDark;
}
