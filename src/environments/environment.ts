/**
 * Development runtime configuration.
 *
 * `apiBaseUrl` points at the Translator backend (see `API_DOC.md`). All paths in
 * the API live at the root, so every request is built as
 * `${apiBaseUrl}${path}`.
 */
import type { Environment } from './environment.model';

export type { Environment };

export const environment: Environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50, 100],
};
