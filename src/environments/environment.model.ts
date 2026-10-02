/**
 * Shape of the runtime configuration.
 *
 * Lives in its own module so both `environment.ts` and
 * `environment.production.ts` can import it — the production build swaps the
 * environment file for its production counterpart, which would otherwise create
 * a self-import.
 */
export interface Environment {
  production: boolean;
  /** Origin of the Translator API, without a trailing slash. */
  apiBaseUrl: string;
  /** Page size used by every list screen on first load. */
  defaultPageSize: number;
  /** Options offered by the page-size selector. */
  pageSizeOptions: number[];
}

/**
 * Shape of `window.__env`, the runtime configuration the Docker image writes
 * to `assets/env.js` at container start-up (see `docker/40-runtime-config.sh`).
 * It does not exist outside the container, so every field is optional and
 * `environment.production.ts` falls back to a hard-coded value.
 */
export interface RuntimeEnvironment {
  apiBaseUrl?: string;
}

declare global {
  interface Window {
    __env?: RuntimeEnvironment;
  }
}
