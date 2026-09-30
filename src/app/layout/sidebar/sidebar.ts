import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { navSectionsFor } from './nav-items';

/**
 * Off-canvas navigation for the authenticated layout.
 *
 * The menu is derived from `NAV_SECTIONS` filtered by the signed-in role, so a
 * client never sees the admin-only `Accounts` / `Driver Access` entries and the
 * guard on the route blocks direct URL access as well.
 */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="sidebar-header">
        <a routerLink="/dashboard" class="sidebar-logo">
          <span class="sidebar-logo-mark"><i class="bi bi-translate" aria-hidden="true"></i></span>
          <span class="sidebar-logo-text">Translator</span>
        </a>
        <button type="button" class="sidebar-close" aria-label="Close menu" (click)="close.emit()">
          <i class="ph ph-x" aria-hidden="true"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-menu">
          @for (section of sections(); track section.heading) {
            <li class="nav-heading">
              <span>{{ section.heading }}</span>
            </li>

            @for (item of section.items; track item.link) {
              <li class="nav-item">
                <a
                  class="nav-link"
                  [routerLink]="item.link"
                  routerLinkActive="active"
                  #activeLink="routerLinkActive"
                  [attr.aria-current]="activeLink.isActive ? 'page' : null"
                  (click)="navigate.emit()"
                >
                  <span class="nav-icon"
                    ><i class="ph {{ item.icon }}" aria-hidden="true"></i
                  ></span>
                  <span class="nav-text">{{ item.label }}</span>
                </a>
              </li>
            }
          }
        </ul>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <a routerLink="/profile" class="sidebar-user-link" (click)="navigate.emit()">
            <span class="sidebar-user-avatar sidebar-user-initials">{{ initials() }}</span>
            <span class="sidebar-user-info">
              <span class="sidebar-user-name">{{ account()?.full_name }}</span>
              <span class="sidebar-user-role">{{ roleLabel() }}</span>
            </span>
          </a>
          <div class="sidebar-user-actions">
            <a
              routerLink="/system"
              class="sidebar-user-action"
              title="System status"
              (click)="navigate.emit()"
            >
              <i class="ph ph-heartbeat" aria-hidden="true"></i>
            </a>
            <button
              type="button"
              class="sidebar-user-action sidebar-user-logout"
              title="Sign out"
              (click)="signOut.emit()"
            >
              <i class="ph ph-sign-out" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    </aside>
  `,
  styles: `
    .sidebar-user-initials {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: var(--radius-full);
      background-color: var(--sidebar-active-bg);
      color: var(--sidebar-active-color);
      font-size: 0.8125rem;
      font-weight: 600;
      flex: 0 0 auto;
    }
  `,
})
export class Sidebar {
  private readonly auth = inject(AuthService);

  readonly close = output<void>();
  readonly navigate = output<void>();
  readonly signOut = output<void>();

  protected readonly account = this.auth.account;
  protected readonly sections = computed(() => navSectionsFor(this.auth.account()?.role ?? null));
  protected readonly roleLabel = computed(() =>
    this.auth.account()?.role === 'admin' ? 'Administrator' : 'Client',
  );
  protected readonly initials = computed(() => this.auth.initials());
}
