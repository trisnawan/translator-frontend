import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';

describe('ApiError', () => {
  it('reads the message and field details from the API error envelope', () => {
    const response = new HttpErrorResponse({
      status: 400,
      error: {
        success: false,
        message: 'Validation failed',
        errors: [
          { message: 'driver_id is required' },
          { field: 'max_rpm', message: 'must be >= 0' },
        ],
        meta: {
          path: '/translate',
          method: 'POST',
          statusCode: 400,
          timestamp: '2026-09-30T02:30:00.000Z',
        },
      },
    });

    const error = ApiError.from(response);

    expect(error.message).toBe('Validation failed');
    expect(error.status).toBe(400);
    expect(error.fieldMessages).toEqual(['driver_id is required', 'must be >= 0']);
    expect(error.meta?.path).toBe('/translate');
  });

  it('flags the status codes the panel reacts to', () => {
    const statuses = [401, 403, 404, 409, 429, 503];
    const flags = [
      'isUnauthorized',
      'isForbidden',
      'isNotFound',
      'isConflict',
      'isRateLimited',
      'isUnavailable',
    ] as const;

    statuses.forEach((status, index) => {
      const error = new ApiError('boom', status);
      expect(error[flags[index]!]).toBe(true);
    });
  });

  it('explains a transport failure when the request never reached the API', () => {
    const error = ApiError.from(new HttpErrorResponse({ status: 0 }));
    expect(error.status).toBe(0);
    expect(error.message).toContain('Cannot reach the API');
  });

  it('is idempotent and keeps plain Error messages', () => {
    const original = new ApiError('already normalised', 409, [{ message: 'duplicate' }]);

    expect(ApiError.from(original)).toBe(original);
    expect(ApiError.from(new Error('network exploded')).message).toBe('network exploded');
    expect(ApiError.from('nope').message).toBe('Unexpected error');
  });
});
