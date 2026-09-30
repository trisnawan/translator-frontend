import { Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { MainLayout } from './layout/main-layout/main-layout';

/**
 * Application routes.
 *
 * Two shells: `AuthLayout` for the public login screen and `MainLayout` for
 * everything behind `authGuard`. Admin-only screens carry an extra `roleGuard`
 * so a client typing the URL is redirected to the dashboard instead of seeing a
 * broken page (the API would answer `403` anyway).
 *
 * Every feature is lazy loaded, keeping the initial bundle to the shell.
 */
export const routes: Routes = [
  {
    path: 'login',
    component: AuthLayout,
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        title: 'Sign in · Translator',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
      },
    ],
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · Translator',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'histories',
        title: 'Histories · Translator',
        loadComponent: () => import('./features/histories/history-list').then((m) => m.HistoryList),
      },
      {
        path: 'histories/:id',
        title: 'History detail · Translator',
        loadComponent: () =>
          import('./features/histories/history-detail').then((m) => m.HistoryDetail),
      },
      {
        path: 'account-keys',
        title: 'API keys · Translator',
        loadComponent: () =>
          import('./features/account-keys/account-key-list').then((m) => m.AccountKeyList),
      },
      {
        path: 'drivers',
        title: 'Drivers · Translator',
        loadComponent: () => import('./features/drivers/driver-list').then((m) => m.DriverList),
      },
      {
        path: 'languages',
        title: 'Languages · Translator',
        loadComponent: () =>
          import('./features/languages/language-list').then((m) => m.LanguageList),
      },
      {
        path: 'accounts',
        title: 'Accounts · Translator',
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./features/accounts/account-list').then((m) => m.AccountList),
      },
      {
        path: 'account-drivers',
        title: 'Driver access · Translator',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/account-drivers/account-driver-list').then((m) => m.AccountDriverList),
      },
      {
        path: 'system',
        title: 'System status · Translator',
        loadComponent: () => import('./features/system/system-status').then((m) => m.SystemStatus),
      },
      {
        path: 'profile',
        title: 'My profile · Translator',
        loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'not-found',
        title: 'Page not found · Translator',
        loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
      },
      { path: '**', redirectTo: 'not-found' },
    ],
  },
  { path: '**', redirectTo: '' },
];
