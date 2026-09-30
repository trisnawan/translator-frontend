import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { ConfirmHost } from '../../shared/ui/confirm-host/confirm-host';
import { ToastHost } from '../../shared/ui/toast-host/toast-host';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

const COLLAPSED_KEY = 'sidebar-collapsed';

/**
 * Shell for every authenticated screen: header, sidebar, content outlet, footer
 * plus the two global overlays (toasts and the confirmation dialog).
 *
 * Sidebar state lives here rather than in the template's `main.js`, so it reacts
 * to Angular state instead of querying the DOM after `DOMContentLoaded`. The
 * `sidebar-collapsed` / `sidebar-open` classes are still mirrored onto `<body>`
 * because the compiled template SCSS targets them as body classes
 * (`.sidebar-collapsed .main`, `.sidebar-open .sidebar`, …).
 */
@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Sidebar, Footer, ToastHost, ConfirmHost],
  host: {
    '(window:resize)': 'handleResize()',
    '(window:scroll)': 'handleScroll()',
  },
  template: `
    <app-header (toggleSidebar)="onToggleSidebar()" (signOut)="onSignOut()" />

    <app-sidebar
      (close)="mobileOpen.set(false)"
      (navigate)="mobileOpen.set(false)"
      (signOut)="onSignOut()"
    />

    <div class="sidebar-overlay" (click)="mobileOpen.set(false)"></div>

    <main class="main">
      <div class="main-content">
        <router-outlet />
      </div>

      <app-footer />
    </main>

    @if (showBackToTop()) {
      <button
        type="button"
        class="back-to-top visible"
        aria-label="Back to top"
        (click)="scrollToTop()"
      >
        <i class="ph ph-arrow-up" aria-hidden="true"></i>
      </button>
    }

    <app-toast-host />
    <app-confirm-host />
  `,
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  private readonly narrowScreen = signal(window.innerWidth < 1200);
  protected readonly collapsed = signal(readCollapsed());
  protected readonly mobileOpen = signal(false);
  protected readonly showBackToTop = signal(false);

  constructor() {
    effect(() => {
      document.body.classList.toggle('sidebar-collapsed', this.collapsed());
      document.body.classList.toggle('sidebar-open', this.mobileOpen());
    });

    inject(DestroyRef).onDestroy(() => {
      document.body.classList.remove('sidebar-collapsed', 'sidebar-open');
    });
  }

  /**
   * Desktop toggles the collapsed rail; narrower viewports slide the sidebar in
   * as an overlay so the content is never squeezed.
   */
  protected onToggleSidebar(): void {
    if (this.narrowScreen()) {
      this.mobileOpen.update((open) => !open);
      return;
    }

    const next = !this.collapsed();
    this.collapsed.set(next);

    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      /* storage unavailable - the state lasts for this tab only */
    }
  }

  protected async onSignOut(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Sign out',
      message: 'End this session and return to the login screen?',
      confirmLabel: 'Sign out',
      variant: 'primary',
    });

    if (!confirmed) {
      return;
    }

    this.auth.logout().subscribe(() => {
      void this.router.navigate(['/login']);
      this.toast.info('Signed out', 'Your access token was removed from this browser.');
    });
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected handleResize(): void {
    const narrow = window.innerWidth < 1200;
    this.narrowScreen.set(narrow);

    if (narrow) {
      this.collapsed.set(false);
    } else {
      this.mobileOpen.set(false);
    }
  }

  protected handleScroll(): void {
    this.showBackToTop.set(window.scrollY > 320);
  }
}

function readCollapsed(): boolean {
  try {
    return window.innerWidth >= 1200 && localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}
