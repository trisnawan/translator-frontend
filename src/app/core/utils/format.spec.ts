import { describe, expect, it } from 'vitest';

import {
  formatDateTime,
  formatDuration,
  formatQuota,
  initialsOf,
  toDateInputValue,
  truncate,
} from './format';
import { endOfDay, startOfDay } from '../../shared/ui/date-picker/date-picker';

describe('format helpers', () => {
  it('formats a valid timestamp and falls back for empty or invalid input', () => {
    expect(formatDateTime('2026-09-30T02:30:00.000Z')).not.toBe('—');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
  });

  it('renders a duration in the coarsest useful unit', () => {
    expect(formatDuration(45)).toBe('0m 45s');
    expect(formatDuration(3_725)).toBe('1h 2m');
    expect(formatDuration(188_400)).toBe('2d 4h');
  });

  it('renders an unlimited quota as a word', () => {
    expect(formatQuota(0)).toBe('Unlimited');
    expect(formatQuota(5000)).toBe('5,000');
  });

  it('collapses whitespace and ellipsises long previews', () => {
    expect(truncate('  hello   world  ')).toBe('hello world');
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });

  it('derives initials from one or two name parts', () => {
    expect(initialsOf('Client Demo')).toBe('CD');
    expect(initialsOf('Admin')).toBe('A');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });

  it('produces a zero padded date input value', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('history date bounds', () => {
  it('turns a picked day into inclusive ISO 8601 bounds', () => {
    expect(startOfDay('2026-09-01')).toBe('2026-09-01T00:00:00.000Z');
    expect(endOfDay('2026-09-30')).toBe('2026-09-30T23:59:59.999Z');
  });

  it('returns undefined for an empty pick so the query param is dropped', () => {
    expect(startOfDay('')).toBeUndefined();
    expect(endOfDay('')).toBeUndefined();
  });
});
