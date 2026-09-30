import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiError } from '../../../core/http/api-error';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/ui/toast.service';

/**
 * Login screen — the only public route (`POST /auth/login`).
 *
 * The API returns the access token in the response body *and* sets an httpOnly
 * cookie. Because the panel is served from a different origin than the API, the
 * bearer token is what actually authenticates subsequent requests; it is kept by
 * `SessionStore`.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="auth-card">
      <div class="auth-card-header">
        <h1 class="auth-title">Welcome back 👋</h1>
        <p class="auth-subtitle">Sign in to the Translator control panel</p>
      </div>

      @if (reason() === 'session-expired') {
        <div class="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <i class="ph ph-clock-countdown mt-1" aria-hidden="true"></i>
          <span class="small">Your session expired. Please sign in again.</span>
        </div>
      }

      @if (errorMessage(); as message) {
        <div class="alert alert-danger" role="alert">
          <span class="d-block fw-semibold">{{ message }}</span>
          @if (errorDetails().length) {
            <ul class="mb-0 mt-1 ps-3 small">
              @for (detail of errorDetails(); track detail) {
                <li>{{ detail }}</li>
              }
            </ul>
          }
        </div>
      }

      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="auth-field-group">
          <label for="email" class="form-label">Email address</label>
          <div class="auth-field">
            <i class="ph ph-envelope auth-field-icon" aria-hidden="true"></i>
            <input
              id="email"
              type="email"
              class="form-control"
              formControlName="email"
              placeholder="name@example.com"
              autocomplete="username"
              [class.is-invalid]="showError('email')"
            />
          </div>
          @if (showError('email')) {
            <div class="invalid-feedback d-block">Enter a valid email address.</div>
          }
        </div>

        <div class="auth-field-group">
          <label for="password" class="form-label">Password</label>
          <div class="auth-field">
            <i class="ph ph-lock auth-field-icon" aria-hidden="true"></i>
            <input
              id="password"
              [type]="passwordVisible() ? 'text' : 'password'"
              class="form-control"
              formControlName="password"
              placeholder="Enter your password"
              autocomplete="current-password"
              [class.is-invalid]="showError('password')"
            />
            <button
              type="button"
              class="auth-field-toggle"
              tabindex="-1"
              [attr.aria-label]="passwordVisible() ? 'Hide password' : 'Show password'"
              (click)="passwordVisible.set(!passwordVisible())"
            >
              <i
                class="ph"
                [class.ph-eye]="!passwordVisible()"
                [class.ph-eye-slash]="passwordVisible()"
              ></i>
            </button>
          </div>
          @if (showError('password')) {
            <div class="invalid-feedback d-block">Password must be at least 6 characters.</div>
          }
        </div>

        <button type="submit" class="auth-submit" [disabled]="submitting()">
          @if (submitting()) {
            <span
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
            Signing in…
          } @else {
            Sign In <i class="ph ph-arrow-right" aria-hidden="true"></i>
          }
        </button>
      </form>

      <p class="auth-footer-text text-muted small mb-0">
        Access is issued by an administrator. Contact your admin if you cannot sign in.
      </p>
    </div>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly submitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly errorDetails = signal<string[]>([]);
  protected readonly reason = computed(() => this.route.snapshot.queryParamMap.get('reason'));
  protected readonly submitted = signal(false);

  protected showError(control: 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.errorDetails.set([]);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.toast.success('Signed in', `Welcome back, ${result.account.full_name}.`);
        void this.router.navigateByUrl(this.redirectTarget());
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.submitting.set(false);
        this.errorMessage.set(apiError.message);
        this.errorDetails.set(apiError.fieldMessages);
      },
    });
  }

  /** Honours `?redirect=` but never leaves the app. */
  private redirectTarget(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');

    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }

    return '/dashboard';
  }
}
