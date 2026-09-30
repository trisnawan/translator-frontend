import type { AccountRole } from '../../core/models/api.models';

export interface NavItem {
  label: string;
  link: string;
  /** Phosphor icon class, e.g. `ph-translate`. */
  icon: string;
  /** Roles allowed to see the entry; omitted means "everyone signed in". */
  roles?: AccountRole[];
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar, `PageHeader` breadcrumbs and the
 * dashboard shortcut list. Keeping it in one place means adding a screen only
 * requires touching this file plus `app.routes.ts`.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Overview',
    items: [{ label: 'Dashboard', link: '/dashboard', icon: 'ph-gauge' }],
  },
  {
    heading: 'Translation',
    items: [
      { label: 'Histories', link: '/histories', icon: 'ph-clock-counter-clockwise' },
      { label: 'API Keys', link: '/account-keys', icon: 'ph-key' },
      { label: 'Drivers', link: '/drivers', icon: 'ph-engine' },
      { label: 'Languages', link: '/languages', icon: 'ph-translate' },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { label: 'Accounts', link: '/accounts', icon: 'ph-users', roles: ['admin'] },
      {
        label: 'Driver Access',
        link: '/account-drivers',
        icon: 'ph-shield-check',
        roles: ['admin'],
      },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'System Status', link: '/system', icon: 'ph-heartbeat' },
      { label: 'My Profile', link: '/profile', icon: 'ph-user-circle' },
    ],
  },
];

/** Nav entries visible to `role`. */
export function navSectionsFor(role: AccountRole | null): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    heading: section.heading,
    items: section.items.filter(
      (item) => !item.roles || (role !== null && item.roles.includes(role)),
    ),
  })).filter((section) => section.items.length > 0);
}
