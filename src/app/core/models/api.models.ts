/**
 * Domain + transport types for the Translator backend.
 *
 * Everything here mirrors `API_DOC.md` verbatim so a contract change only has to
 * be applied in one place.
 */

/* -------------------------------------------------------------------------- */
/* Envelope                                                                    */
/* -------------------------------------------------------------------------- */

/** Pagination block returned by every list endpoint. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** One entry of the `errors` array on a failed request. */
export interface ApiErrorDetail {
  field?: string;
  message: string;
}

/** Debug block appended to failed requests. */
export interface ApiErrorMeta {
  path: string;
  method: string;
  statusCode: number;
  timestamp: string;
}

/** Successful response envelope. `meta` is only present on list endpoints. */
export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: PageMeta;
}

/** Failed response envelope. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: ApiErrorDetail[];
  meta?: ApiErrorMeta;
}

/** A page of results plus its pagination block. */
export interface PagedResult<T> {
  items: T[];
  meta: PageMeta;
}

/* -------------------------------------------------------------------------- */
/* Shared unions                                                               */
/* -------------------------------------------------------------------------- */

export type AccountRole = 'admin' | 'client';
export type ActiveStatus = 'active' | 'inactive';
export type DriverType = 'ai' | 'api';
export type HistoryStatus = 'requested' | 'translated' | 'failed';
export type CallbackStatus = 'open' | 'close';
export type LanguageCode = string;

/** Engine that executes a driver; `null` when the id prefix is unrecognised. */
export type DriverEngine = 'gemini' | 'claude' | 'deepseek' | 'google-translate' | null;

/** Direction of the `order` query parameter (sort by creation date). */
export type SortOrder = 'asc' | 'desc';

/* -------------------------------------------------------------------------- */
/* Resources                                                                   */
/* -------------------------------------------------------------------------- */

export interface Account {
  id: string;
  full_name: string;
  email: string;
  role: AccountRole;
  status: ActiveStatus;
  /** `0` means unlimited. */
  max_rpm: number;
  /** `0` means unlimited. */
  max_rpd: number;
  created_at: string;
  updated_at: string;
}

/** Trimmed account object embedded in key/driver/history responses. */
export interface AccountRef {
  id: string;
  full_name: string;
  email: string;
}

export interface Language {
  id: LanguageCode;
  name: string;
  status: ActiveStatus;
}

/** Trimmed driver object embedded in `account_drivers` and `histories`. */
export interface DriverRef {
  id: string;
  name: string;
  type: DriverType;
  status: ActiveStatus;
}

export interface Driver {
  id: string;
  type: DriverType;
  name: string;
  status: ActiveStatus;
  max_rpm: number;
  max_rpd: number;
  has_secret_key: boolean;
  engine: DriverEngine;
}

export interface AccountKey {
  id: string;
  account_id: string;
  /**
   * Embedded by the list endpoint and (since the account join was added) also
   * by detail/update. Kept nullable so the UI never dereferences a missing
   * account and breaks the whole view.
   */
  account: AccountRef | null;
  callback_url: string | null;
  secret_key_masked: string;
  has_secret_key: boolean;
  created_at: string;
}

/** Returned by `POST /account-keys/insert` only: the plaintext key, shown once. */
export interface AccountKeyCreated extends AccountKey {
  secret_key: string;
}

export interface AccountDriver {
  id: string;
  account_id: string;
  account: AccountRef;
  driver_id: string;
  driver: DriverRef;
  created_at: string;
}

export interface History {
  id: string;
  account_id: string;
  account: AccountRef | null;
  driver_id: string;
  driver: DriverRef | null;
  translate_from: LanguageCode;
  translate_to: LanguageCode;
  reference_id: string;
  reference_content: string;
  translated_content: string | null;
  status: HistoryStatus;
  requested_at: string;
  translated_at: string | null;
  callback_status: CallbackStatus;
  callback_retry: number;
  callback_at: string | null;
}

export interface LoginResult {
  token_type: string;
  access_token: string;
  expires_in: number;
  expires_at: string;
  account: Account;
}

export interface AppInfo {
  name: string;
  description: string;
  environment: string;
  version: string;
  timezone: string;
  time: string;
  documentation: string;
}

export interface HealthDependencies {
  database: 'up' | 'down';
  broker: 'up' | 'down' | 'disabled';
}

export interface HealthInfo {
  status: 'ok' | 'degraded';
  app: string;
  environment: string;
  timezone: string;
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: HealthDependencies;
}

/* -------------------------------------------------------------------------- */
/* Request payloads                                                            */
/* -------------------------------------------------------------------------- */

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LanguagePayload {
  /** Ignored by `PUT /languages/update/{ID}`: the code is immutable. */
  id?: LanguageCode;
  name: string;
  status?: ActiveStatus;
}

export interface DriverPayload {
  /** Ignored by `PUT /drivers/update/{ID}`: the id is immutable. */
  id?: string;
  type?: DriverType;
  name: string;
  status?: ActiveStatus;
  /** Omit to keep, send `''` on update to clear, send a value to rotate. */
  secret_key?: string;
  max_rpm?: number;
  max_rpd?: number;
}

export interface AccountPayload {
  full_name: string;
  email: string;
  /** Required on insert, optional (send to replace) on update. */
  password?: string;
  role?: AccountRole;
  status?: ActiveStatus;
  max_rpm?: number;
  max_rpd?: number;
}

export interface AccountKeyPayload {
  /** Admins may target another account; clients are forced to their own. */
  account_id?: string;
  secret_key?: string;
  /** `null` removes the callback URL so the client falls back to polling. */
  callback_url?: string | null;
}

export interface AccountDriverPayload {
  account_id?: string;
  driver_id?: string;
}

/* -------------------------------------------------------------------------- */
/* Query parameters                                                            */
/* -------------------------------------------------------------------------- */

/** Parameters understood by every list endpoint. */
export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  order?: SortOrder;
}

export interface LanguageQuery extends ListQuery {
  status?: ActiveStatus;
}

export interface DriverQuery extends ListQuery {
  status?: ActiveStatus;
  type?: DriverType;
}

export interface AccountQuery extends ListQuery {
  status?: ActiveStatus;
  role?: AccountRole;
}

export interface AccountKeyQuery extends ListQuery {
  /** Admin only. */
  account_id?: string;
}

export interface AccountDriverQuery extends ListQuery {
  account_id?: string;
  driver_id?: string;
}

export interface HistoryQuery extends ListQuery {
  status?: HistoryStatus;
  callback_status?: CallbackStatus;
  driver_id?: string;
  translate_from?: LanguageCode;
  translate_to?: LanguageCode;
  reference_id?: string;
  /** ISO 8601 lower bound on `requested_at` (inclusive). */
  date_from?: string;
  /** ISO 8601 upper bound on `requested_at` (inclusive). */
  date_to?: string;
  /** Admin only. */
  account_id?: string;
}
