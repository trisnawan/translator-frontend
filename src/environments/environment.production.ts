import type { Environment } from './environment.model';

/**
 * Production runtime configuration.
 *
 * `npm run build` swaps this file in for `environment.ts` (see the
 * `fileReplacements` entry in `angular.json`).
 *
 * `apiBaseUrl` prefers the value injected by the Docker container at start-up
 * (`assets/env.js`, written from the `API_BASE_URL` environment variable - see
 * `docker/40-runtime-config.sh`), and falls back to the hosted API for plain
 * static builds served without the container.
 */
export const environment: Environment = {
  production: true,
  apiBaseUrl: window.__env?.apiBaseUrl || 'https://translator-api.iarfcindonesia.com',
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50, 100],
};
