import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** In-layout 404 for unknown paths. */
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="text-center py-5">
      <span class="d-inline-block mb-3"><i class="ph ph-compass fs-1 text-primary"></i></span>
      <h1 class="h3 mb-2">Page not found</h1>
      <p class="text-muted mb-4">The page you asked for does not exist in this panel.</p>
      <a class="btn btn-primary" routerLink="/dashboard">
        <i class="ph ph-house me-1" aria-hidden="true"></i> Back to dashboard
      </a>
    </div>
  `,
})
export class NotFound {}
