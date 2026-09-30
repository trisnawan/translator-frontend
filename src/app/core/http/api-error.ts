import { HttpErrorResponse } from '@angular/common/http';

import type { ApiErrorDetail, ApiErrorMeta, ApiErrorResponse } from '../models/api.models';

/**
 * Normalised transport failure.
 *
 * Every `HttpErrorResponse` leaving the API is converted into this class by
 * `errorInterceptor`, so components never have to inspect status codes.
 */
export class ApiError extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly details: ApiErrorDetail[] = [],
    readonly meta?: ApiErrorMeta,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** HTTP 401 — token missing, malformed or expired. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** HTTP 403 — account inactive, wrong role, or driver not granted. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** HTTP 404 — resource no longer exists. */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** HTTP 409 — duplicate entry or row still referenced. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** HTTP 429 — account `max_rpm` / `max_rpd` quota exhausted. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** HTTP 503 — broker / engine / driver not ready. */
  get isUnavailable(): boolean {
    return this.status === 503;
  }

  /**
   * Messages suitable for inline form validation. Falls back to the envelope
   * `message` when the backend provided no per-field detail.
   */
  get fieldMessages(): string[] {
    return this.details.map((detail) => detail.message);
  }

  /** Builds an {@link ApiError} from any thrown value. */
  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      return ApiError.fromHttp(error);
    }

    if (error instanceof Error) {
      return new ApiError(error.message, 0);
    }

    return new ApiError('Unexpected error', 0);
  }

  private static fromHttp(response: HttpErrorResponse): ApiError {
    const body = response.error as ApiErrorResponse | string | null;

    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return new ApiError(body.message, response.status, body.errors ?? [], body.meta);
    }

    // The request never reached the API (offline, DNS failure, CORS, timeout).
    if (response.status === 0) {
      return new ApiError(
        'Cannot reach the API. Check that the backend is running and allows this origin (CORS).',
        0,
      );
    }

    return new ApiError(
      response.message || `Request failed with status ${response.status}`,
      response.status,
    );
  }
}
