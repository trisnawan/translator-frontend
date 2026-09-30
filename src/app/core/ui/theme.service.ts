import { Injectable, computed, signal } from '@angular/core';

export type ThemeName = 'light' | 'dark';

const THEME_KEY = 'theme';

/**
 * Typed wrapper around the template's `window.Theme` helper
 * (`assets/js/theme.js`), which owns the `data-theme` attribute and the
 * `localStorage` persistence.
 *
 * The wrapper re-implements the same logic as a fallback so the panel keeps
 * working even when the template script is not loaded (unit tests, SSR).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly theme = signal<ThemeName>(currentTheme());
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  readonly current = this.theme.asReadonly();
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    // Follow OS changes while the user has not made an explicit choice.
    const listener = (event: MediaQueryListEvent) => {
      if (readStoredTheme() === null) {
        this.apply(event.matches ? 'dark' : 'light');
      }
    };

    this.media.addEventListener('change', listener);
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: ThemeName): void {
    this.apply(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable - the choice lasts for this tab only */
    }
  }

  private apply(theme: ThemeName): void {
    const template = (window as unknown as { Theme?: { setDark(): void; setLight(): void } }).Theme;

    if (template) {
      // Delegate to the template script so both stay in sync.
      (theme === 'dark' ? template.setDark : template.setLight).call(template);
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    this.theme.set(theme);
  }
}

function readStoredTheme(): ThemeName | null {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

function currentTheme(): ThemeName {
  const stored = readStoredTheme();
  if (stored) {
    return stored;
  }

  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
