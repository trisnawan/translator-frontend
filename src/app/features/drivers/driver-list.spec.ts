import { describe, expect, it } from 'vitest';

import { DRIVER_ID_PATTERN } from './driver-list';

/**
 * The pattern must stay in sync with the backend `DRIVER_ID_PATTERN`
 * (`translator-backend/src/modules/drivers/dto/create-driver.dto.ts`),
 * otherwise a form value the API accepts is rejected client-side.
 */
describe('DRIVER_ID_PATTERN', () => {
  it('accepts the seeded and documented driver ids', () => {
    expect(DRIVER_ID_PATTERN.test('gemini-3.8-flash')).toBe(true);
    expect(DRIVER_ID_PATTERN.test('api-google-translate')).toBe(true);
  });

  it('accepts lowercase letters, numbers, dots, dashes and underscores', () => {
    expect(DRIVER_ID_PATTERN.test('claude-3.5-sonnet')).toBe(true);
    expect(DRIVER_ID_PATTERN.test('deepseek_v3.1')).toBe(true);
    expect(DRIVER_ID_PATTERN.test('abc')).toBe(true);
    expect(DRIVER_ID_PATTERN.test('a1b2c3')).toBe(true);
  });

  it('enforces the 3–20 character bounds', () => {
    expect(DRIVER_ID_PATTERN.test('ab')).toBe(false);
    expect(DRIVER_ID_PATTERN.test('abcdefghij0123456789')).toBe(true); // 20 chars
    expect(DRIVER_ID_PATTERN.test('abcdefghij01234567890')).toBe(false); // 21 chars
  });

  it('rejects uppercase, leading punctuation and whitespace', () => {
    expect(DRIVER_ID_PATTERN.test('Gemini-3.8-flash')).toBe(false);
    expect(DRIVER_ID_PATTERN.test('-gemini-flash')).toBe(false);
    expect(DRIVER_ID_PATTERN.test('.gemini-flash')).toBe(false);
    expect(DRIVER_ID_PATTERN.test('gemini flash')).toBe(false);
    expect(DRIVER_ID_PATTERN.test('gemini/flash')).toBe(false);
  });
});
