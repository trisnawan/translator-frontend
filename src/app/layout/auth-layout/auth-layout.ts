import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastHost } from '../../shared/ui/toast-host/toast-host';

/**
 * Split-screen shell for the unauthenticated screens (currently only login).
 * Mirrors `templates/auth-login.html`: brand panel on the left, form on the
 * right, footer pinned to the bottom.
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHost],
  template: `
    <div class="auth-layout auth-split">
      <aside class="auth-panel">
        <span class="auth-panel-logo">
          <span class="auth-logo-mark"><i class="bi bi-translate" aria-hidden="true"></i></span>
          <span>Translator</span>
        </span>

        <div class="auth-panel-body">
          <h2 class="auth-panel-title">One panel for every translation job.</h2>
          <p class="auth-panel-text">
            Manage languages, drivers, accounts and API keys, then follow every request from
            <em>requested</em> to <em>translated</em> in real time.
          </p>
          <ul class="auth-panel-list">
            <li>
              <i class="ph ph-check-circle" aria-hidden="true"></i> Role aware: admin and client
              views
            </li>
            <li>
              <i class="ph ph-check-circle" aria-hidden="true"></i> Live history with callback
              status
            </li>
            <li>
              <i class="ph ph-check-circle" aria-hidden="true"></i> Issue and rotate API keys safely
            </li>
          </ul>
        </div>

        <div class="auth-panel-footer">&copy; {{ year }} Translator Service</div>
      </aside>

      <div class="auth-content">
        <span class="auth-logo">
          <span class="auth-logo-mark"><i class="bi bi-translate" aria-hidden="true"></i></span>
          <span>Translator</span>
        </span>

        <div class="auth-content-inner">
          <router-outlet />
        </div>

        <footer class="auth-footer">
          <div class="footer-copyright">&copy; {{ year }} Translator Service</div>
        </footer>
      </div>
    </div>

    <app-toast-host />
  `,
})
export class AuthLayout {
  protected readonly year = new Date().getFullYear();
}
