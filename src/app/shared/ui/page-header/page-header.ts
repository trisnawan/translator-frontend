import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Breadcrumb {
  label: string;
  /** Absolute router path; omitted for the trailing (current) crumb. */
  link?: string;
}

/**
 * Title, subtitle, breadcrumb and an action slot used by every screen.
 *
 * The template styles this as `.page-header`; `pg-actions` content is projected
 * on the right hand side:
 *
 * ```html
 * <app-page-header title="Languages" [crumbs]="crumbs()">
 *   <button class="btn btn-primary">New</button>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: `
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
    }

    .page-header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ title() }}</h1>
        @if (subtitle(); as text) {
          <p class="mb-1 text-muted small">{{ text }}</p>
        }
        @if (crumbs().length) {
          <nav class="breadcrumb">
            @for (crumb of crumbs(); track crumb.label; let last = $last) {
              @if (crumb.link && !last) {
                <a class="breadcrumb-item" [routerLink]="crumb.link">{{ crumb.label }}</a>
              } @else {
                <span class="breadcrumb-item" [class.active]="last">{{ crumb.label }}</span>
              }
            }
          </nav>
        }
      </div>

      <div class="page-header-actions">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly crumbs = input<Breadcrumb[]>([]);
}
