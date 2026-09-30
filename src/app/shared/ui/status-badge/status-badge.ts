import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Every value the panel renders as a coloured pill. */
export type BadgeValue =
  | 'active'
  | 'inactive'
  | 'requested'
  | 'translated'
  | 'failed'
  | 'open'
  | 'close'
  | 'admin'
  | 'client'
  | 'ai'
  | 'api'
  | 'up'
  | 'down'
  | 'disabled';

interface BadgeStyle {
  label: string;
  className: string;
}

const STYLES: Record<BadgeValue, BadgeStyle> = {
  // account / driver / language status
  active: { label: 'Active', className: 'status-badge status-badge-active' },
  inactive: { label: 'Inactive', className: 'status-badge status-badge-inactive' },
  // translation job status
  requested: { label: 'Requested', className: 'badge badge-soft-warning' },
  translated: { label: 'Translated', className: 'badge badge-soft-success' },
  failed: { label: 'Failed', className: 'badge badge-soft-danger' },
  // callback status
  open: { label: 'Open', className: 'badge badge-soft-info' },
  close: { label: 'Close', className: 'badge badge-soft-secondary' },
  // account role
  admin: { label: 'Admin', className: 'badge badge-soft-primary' },
  client: { label: 'Client', className: 'badge badge-soft-info' },
  // driver type
  ai: { label: 'AI', className: 'badge badge-soft-primary' },
  api: { label: 'API', className: 'badge badge-soft-secondary' },
  // health dependency state
  up: { label: 'Up', className: 'badge badge-soft-success' },
  down: { label: 'Down', className: 'badge badge-soft-danger' },
  disabled: { label: 'Disabled', className: 'badge badge-soft-secondary' },
};

/**
 * Renders an API enum (`active`, `translated`, `open`, …) as a pill that matches
 * the template's badge styling.
 */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="style().className">{{ style().label }}</span>`,
})
export class StatusBadge {
  readonly value = input.required<BadgeValue>();

  protected readonly style = computed<BadgeStyle>(
    () => STYLES[this.value()] ?? { label: this.value(), className: 'badge badge-soft-secondary' },
  );
}
