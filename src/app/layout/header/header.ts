import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ThemeToggle } from './theme-toggle';

/**
 * Top bar of the authenticated layout.
 *
 * Only the parts the panel actually needs are kept from the template: the
 * sidebar toggle, brand, theme toggle, fullscreen toggle and the user menu
 * (profile / logout). Global search, messages and notifications were dropped
 * because the API exposes no matching resources — rebuilding them with mock
 * data would be more maintenance, not less.
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ThemeToggle],
  template: `
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <button
            type="button"
            class="sidebar-toggle"
            title="Toggle sidebar"
            (click)="toggleSidebar.emit()"
          >
            <i class="ph ph-list" aria-hidden="true"></i>
          </button>

          <a routerLink="/dashboard" class="header-logo">
            <span class="header-logo-mark"><i class="bi bi-translate" aria-hidden="true"></i></span>
            <span class="header-logo-text">Translator</span>
          </a>
        </div>

        <div class="header-right">
          <div class="header-actions-desktop">
            <app-theme-toggle />

            <button
              type="button"
              class="header-action"
              title="Fullscreen"
              (click)="toggleFullscreen()"
            >
              <i class="ph ph-arrows-out" aria-hidden="true"></i>
            </button>

            <div class="header-divider"></div>

            <div class="header-action dropdown user-dropdown">
              <button
                class="dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <span class="avatar user-avatar-initials">{{ initials() }}</span>
                <span class="user-name">{{ account()?.full_name ?? 'Account' }}</span>
                <i class="ph ph-caret-down user-caret" aria-hidden="true"></i>
              </button>

              <div class="dropdown-menu dropdown-menu-end">
                <div class="user-menu-card">
                  <span class="user-menu-avatar user-avatar-initials">{{ initials() }}</span>
                  <span class="user-menu-name">{{ account()?.full_name }}</span>
                  <span class="user-menu-mail">{{ account()?.email }}</span>
                  <span class="user-menu-role">{{
                    account()?.role === 'admin' ? 'Administrator' : 'Client'
                  }}</span>
                </div>
                <div class="user-menu-body">
                  <a class="dropdown-item" routerLink="/profile">
                    <span class="user-menu-item-icon"
                      ><i class="ph ph-user" aria-hidden="true"></i
                    ></span>
                    My Profile
                    <i class="ph ph-caret-right user-menu-item-caret" aria-hidden="true"></i>
                  </a>
                  <a class="dropdown-item" routerLink="/system">
                    <span class="user-menu-item-icon"
                      ><i class="ph ph-heartbeat" aria-hidden="true"></i
                    ></span>
                    System Status
                    <i class="ph ph-caret-right user-menu-item-caret" aria-hidden="true"></i>
                  </a>
                </div>
                <div class="user-menu-footer">
                  <button type="button" class="user-menu-signout" (click)="signOut.emit()">
                    <i class="ph ph-sign-out" aria-hidden="true"></i> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="header-actions-mobile">
            <app-theme-toggle />

            <div class="header-action dropdown user-dropdown">
              <button
                class="dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <span class="avatar user-avatar-initials">{{ initials() }}</span>
              </button>
              <div class="dropdown-menu dropdown-menu-end">
                <a class="dropdown-item" routerLink="/profile">Profile</a>
                <a class="dropdown-item" routerLink="/system">System Status</a>
                <button type="button" class="dropdown-item text-danger" (click)="signOut.emit()">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: `
    .user-avatar-initials {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: var(--radius-full);
      background-color: var(--accent-color);
      color: var(--contrast-color);
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .user-menu-avatar.user-avatar-initials {
      width: 56px;
      height: 56px;
      font-size: 1.125rem;
    }
  `,
})
export class Header {
  private readonly auth = inject(AuthService);

  readonly toggleSidebar = output<void>();
  readonly signOut = output<void>();

  protected readonly account = this.auth.account;
  protected readonly initials = computed(() => {
    const name = this.auth.account()?.full_name;
    if (!name) {
      return '?';
    }

    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts.at(0)?.[0] ?? '';
    const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
    return (first + last).toUpperCase() || '?';
  });

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void document.documentElement.requestFullscreen?.();
  }
}
