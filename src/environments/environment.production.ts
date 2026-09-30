import type { Environment } from './environment.model';

/**
 * Production runtime configuration.
 *
 * `npm run build` swaps this file in for `environment.ts` (see the
 * `fileReplacements` entry in `angular.json`), so only `apiBaseUrl` normally
 * needs editing before shipping.
 */
export const environment: Environment = {
  production: true,
  apiBaseUrl: 'http://localhost:3000',
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50, 100],
};
