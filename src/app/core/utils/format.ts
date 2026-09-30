/** Presentation helpers shared by the feature screens. */

/** Formats an ISO 8601 timestamp with the browser locale, or a placeholder. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `2026-09-30` in the browser locale; used by date filters and pickers. */
export function toDateInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Human readable duration from a second count, e.g. `2d 4h 11m`. */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds % 60}s`;
}

/** Collapses whitespace so a paragraph preview stays on a single line. */
export function truncate(value: string, maxLength = 80): string {
  const single = value.replace(/\s+/g, ' ').trim();
  return single.length > maxLength ? `${single.slice(0, maxLength - 1)}…` : single;
}

/** Renders an unlimited (`0`) quota as `∞`. Numbers stay in `en-US` so the
 * format does not change with the browser locale. */
export function formatQuota(value: number): string {
  return value === 0 ? 'Unlimited' : value.toLocaleString('en-US');
}

/**
 * Stable colour token (`primary`, `success`, `warning`, `info`, `danger`) derived
 * from a value, so an avatar keeps the same colour between renders.
 */
export function accentFor(value: string): string {
  const palette = ['primary', 'success', 'warning', 'info', 'danger'];
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }

  return palette[hash % palette.length] ?? 'primary';
}

/** First two letters of a name, uppercased. */
export function initialsOf(value: string | null | undefined): string {
  if (!value) {
    return '?';
  }

  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts.at(0)?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}
