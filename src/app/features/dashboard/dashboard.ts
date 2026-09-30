import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { ApiError } from '../../core/http/api-error';
import { AccountKeyService } from '../../core/services/account-key.service';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { DriverService } from '../../core/services/driver.service';
import { HistoryService } from '../../core/services/history.service';
import { LanguageService } from '../../core/services/language.service';
import type { History } from '../../core/models/api.models';
import { formatDateTime, truncate } from '../../core/utils/format';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { StatusBadge } from '../../shared/ui/status-badge/status-badge';

interface Overview {
  histories: number;
  requested: number;
  translated: number;
  failed: number;
  languages: number;
  drivers: number;
  accountKeys: number;
  accounts: number | null;
}

interface Kpi {
  label: string;
  value: number;
  icon: string;
  accent: string;
  hint: string;
  link?: string;
}

const EMPTY_OVERVIEW: Overview = {
  histories: 0,
  requested: 0,
  translated: 0,
  failed: 0,
  languages: 0,
  drivers: 0,
  accountKeys: 0,
  accounts: null,
};

/**
 * Landing screen.
 *
 * Counts come from `meta.total` of `limit=1` requests rather than from fetching
 * whole collections, so the dashboard stays cheap regardless of data volume.
 * Admin and client see the same cards minus the account counters the client role
 * cannot read.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, StatusBadge, RouterLink],
  template: `
    <app-page-header
      [title]="greeting()"
      [subtitle]="subtitle()"
      [crumbs]="[{ label: 'Home', link: '/dashboard' }, { label: 'Dashboard' }]"
    >
      <button type="button" class="btn btn-light" [disabled]="loading()" (click)="reload()">
        @if (loading()) {
          <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
        } @else {
          <i class="ph ph-arrow-clockwise me-1" aria-hidden="true"></i>
        }
        Refresh
      </button>
    </app-page-header>

    @if (error(); as message) {
      <div class="alert alert-danger mt-4 d-flex align-items-start gap-2" role="alert">
        <i class="ph ph-warning-circle mt-1" aria-hidden="true"></i>
        <span>{{ message }}</span>
      </div>
    }

    <div class="row g-3 mt-1">
      @for (kpi of kpis(); track kpi.label) {
        <div class="col-sm-6 col-xl-3">
          <div class="card h-100 dash-kpi-card">
            <div class="card-body">
              <div class="d-flex align-items-start justify-content-between mb-3">
                <span class="kpi-icon" [style.color]="kpi.accent">
                  <i class="ph {{ kpi.icon }}" aria-hidden="true"></i>
                </span>
                @if (kpi.link) {
                  <a [routerLink]="kpi.link" class="small text-muted"
                    >View <i class="ph ph-arrow-right"></i
                  ></a>
                }
              </div>

              <div class="kpi-value">{{ kpi.value.toLocaleString() }}</div>
              <div class="kpi-label">{{ kpi.label }}</div>
              <div class="text-muted small mt-1">{{ kpi.hint }}</div>
            </div>
          </div>
        </div>
      }
    </div>

    <div class="row g-4 mt-1">
      <div class="col-xl-5">
        <div class="card h-100">
          <div class="card-header">
            <h5 class="card-title mb-0">Jobs by status</h5>
          </div>
          <div class="card-body">
            @if (overview().histories === 0 && !loading()) {
              <p class="text-muted text-center py-4 mb-0">No translation jobs yet.</p>
            } @else {
              <div #statusChart class="chart-host"></div>
            }
          </div>
        </div>
      </div>

      <div class="col-xl-7">
        <div class="card h-100">
          <div class="card-header d-flex align-items-center justify-content-between">
            <h5 class="card-title mb-0">Latest jobs</h5>
            <a routerLink="/histories" class="small">All histories</a>
          </div>

          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Languages</th>
                  <th scope="col">Status</th>
                  <th scope="col">Requested</th>
                </tr>
              </thead>
              <tbody>
                @if (loading() && recent().length === 0) {
                  <tr>
                    <td colspan="4" class="table-state-cell">
                      <span
                        class="spinner-border spinner-border-sm text-primary me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      <span class="text-muted">Loading…</span>
                    </td>
                  </tr>
                } @else if (recent().length === 0) {
                  <tr>
                    <td colspan="4" class="table-state-cell">
                      <i class="ph ph-tray d-block fs-3 text-muted mb-2"></i>
                      <span class="text-muted d-block">Nothing here yet.</span>
                      <span class="text-muted small">
                        Create an <a routerLink="/account-keys">API key</a> and call
                        <code>POST /translate</code> to see jobs appear.
                      </span>
                    </td>
                  </tr>
                } @else {
                  @for (history of recent(); track history.id) {
                    <tr>
                      <td>
                        <a [routerLink]="['/histories', history.id]" class="fw-medium cell-mono">
                          {{ history.reference_id }}
                        </a>
                        <span class="d-block text-muted small cell-truncate">
                          {{ preview(history.reference_content) }}
                        </span>
                      </td>
                      <td class="text-nowrap">
                        <span class="badge badge-soft-secondary cell-mono">{{
                          history.translate_from
                        }}</span>
                        <i class="ph ph-arrow-right mx-1 text-muted" aria-hidden="true"></i>
                        <span class="badge badge-soft-primary cell-mono">{{
                          history.translate_to
                        }}</span>
                      </td>
                      <td><app-status-badge [value]="history.status" /></td>
                      <td class="small text-muted text-nowrap">
                        {{ format(history.requested_at) }}
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .dash-kpi-card .kpi-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      background-color: var(--background-color);
      font-size: 1.25rem;
    }

    .dash-kpi-card .kpi-value {
      font-family: var(--heading-font);
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.1;
      color: var(--heading-color);
    }

    .dash-kpi-card .kpi-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--default-color);
    }

    .chart-host {
      min-height: 300px;
    }
  `,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly historyService = inject(HistoryService);
  private readonly languageService = inject(LanguageService);
  private readonly driverService = inject(DriverService);
  private readonly accountKeyService = inject(AccountKeyService);
  private readonly accountService = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<Overview>(EMPTY_OVERVIEW);
  protected readonly recent = signal<History[]>([]);
  protected readonly isAdmin = this.auth.isAdmin;

  private readonly chartHost = viewChild<ElementRef<HTMLDivElement>>('statusChart');
  private chart: ApexChartsInstance | null = null;

  protected readonly greeting = computed(() => {
    const name = this.auth.account()?.full_name?.split(' ')[0] ?? 'there';
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${part}, ${name} 👋`;
  });

  protected readonly subtitle = computed(() =>
    this.isAdmin()
      ? 'Everything happening across accounts, drivers and translation jobs.'
      : 'Your translation activity at a glance.',
  );

  protected readonly kpis = computed<Kpi[]>(() => {
    const data = this.overview();
    const cards: Kpi[] = [
      {
        label: this.isAdmin() ? 'Translation jobs' : 'My translation jobs',
        value: data.histories,
        icon: 'ph-clock-counter-clockwise',
        accent: '#7c3aed',
        hint: `${data.translated} translated · ${data.failed} failed`,
        link: '/histories',
      },
      {
        label: 'Jobs in progress',
        value: data.requested,
        icon: 'ph-hourglass-medium',
        accent: '#f59e0b',
        hint: 'Waiting for the worker or the provider',
        link: '/histories',
      },
      {
        label: 'Drivers available',
        value: data.drivers,
        icon: 'ph-engine',
        accent: '#0ea5e9',
        hint: this.isAdmin() ? 'Registered engines' : 'Granted to your account',
        link: '/drivers',
      },
      {
        label: 'Languages',
        value: data.languages,
        icon: 'ph-translate',
        accent: '#0d9f6e',
        hint: 'Codes accepted by POST /translate',
        link: '/languages',
      },
      {
        label: 'API keys',
        value: data.accountKeys,
        icon: 'ph-key',
        accent: '#f43f5e',
        hint: 'Credentials signing your requests',
        link: '/account-keys',
      },
    ];

    if (data.accounts !== null) {
      cards.unshift({
        label: 'Accounts',
        value: data.accounts,
        icon: 'ph-users',
        accent: '#7c3aed',
        hint: 'Admins and clients',
        link: '/accounts',
      });
    }

    return cards;
  });

  constructor() {
    this.reload();
    this.setupChart();
  }

  protected format(value: string): string {
    return formatDateTime(value);
  }

  protected preview(content: string): string {
    return truncate(content, 60);
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);

    const count = (query: Parameters<HistoryService['list']>[0]) =>
      this.historyService.list({ ...query, limit: 1, page: 1 });

    forkJoin({
      histories: count({}),
      requested: count({ status: 'requested' }),
      translated: count({ status: 'translated' }),
      failed: count({ status: 'failed' }),
      languages: this.languageService.list({ limit: 1, page: 1 }),
      drivers: this.driverService.list({ limit: 1, page: 1 }),
      accountKeys: this.accountKeyService.list({ limit: 1, page: 1 }),
      accounts: this.isAdmin() ? this.accountService.list({ limit: 1, page: 1 }) : of(null),
      recent: this.historyService.list({ limit: 5, page: 1, order: 'desc' }),
    }).subscribe({
      next: (result) => {
        this.overview.set({
          histories: result.histories.meta.total,
          requested: result.requested.meta.total,
          translated: result.translated.meta.total,
          failed: result.failed.meta.total,
          languages: result.languages.meta.total,
          drivers: result.drivers.meta.total,
          accountKeys: result.accountKeys.meta.total,
          accounts: result.accounts ? result.accounts.meta.total : null,
        });
        this.recent.set(result.recent.items);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(ApiError.from(error).message);
        this.loading.set(false);
      },
    });
  }

  private setupChart(): void {
    this.destroyRef.onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });

    effect(() => {
      const host = this.chartHost()?.nativeElement;
      const data = this.overview();

      if (!host || typeof ApexCharts === 'undefined') {
        return;
      }

      const options = this.chartOptions(data);

      if (!this.chart) {
        this.chart = new ApexCharts(host, options);
        void this.chart.render();
        return;
      }

      void this.chart.updateOptions(options);
    });
  }

  private chartOptions(data: Overview): ApexChartsOptions {
    const series = [data.translated, data.requested, data.failed];

    return {
      chart: {
        type: 'donut',
        height: 300,
        fontFamily: 'inherit',
        toolbar: { show: false },
      },
      series,
      labels: ['Translated', 'Requested', 'Failed'],
      colors: ['#0d9f6e', '#f59e0b', '#f43f5e'],
      legend: { position: 'bottom', fontSize: '13px' },
      stroke: { width: 0 },
      dataLabels: { enabled: true },
      tooltip: { y: { formatter: (value: number) => `${value} job(s)` } },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                showAlways: true,
                label: 'Jobs',
                formatter: () => `${data.histories}`,
              },
            },
          },
        },
      },
      noData: { text: 'No jobs yet' },
      responsive: [
        {
          breakpoint: 480,
          options: { chart: { height: 260 }, legend: { position: 'bottom' } },
        },
      ],
    };
  }
}
