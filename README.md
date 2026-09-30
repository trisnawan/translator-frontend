# Translator Frontend

Angular 21 control panel for the **Translator Service** backend (see `API_DOC.md`).
Two roles are supported — **admin** and **client** — with a UI that adapts to the
signed-in account.

The interface is built on the **TrendyAdmin** Bootstrap template that ships in
`templates/`. The template's SCSS is compiled to a minified stylesheet and its
vendor libraries are loaded as global assets.

---

## Quick start

```bash
npm install
npm start          # compiles the template SCSS, then serves on http://localhost:4200
```

The API base URL lives in `src/environments/environment.ts` and defaults to
`http://localhost:3000`. The backend must allow the panel origin (CORS) — the
panel sends `Authorization: Bearer <access_token>` on every request.

Seeded accounts from the backend seeder:

| Role   | Email                         | Password    |
| ------ | ----------------------------- | ----------- |
| admin  | `halo.trisnasejati@gmail.com` | `admin123`  |
| client | `devs.trisnasejati@gmail.com` | `client123` |

### npm scripts

| Script              | Purpose                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `npm start`         | `build:css` then `ng serve`                                                                         |
| `npm run build`     | `build:css` then a production `ng build` into `dist/`                                               |
| `npm run build:css` | Compiles `templates/assets/scss/main.scss` → `public/assets/css/main.css` (minified, no source map) |
| `npm run watch:css` | Same, in watch mode — handy while tweaking the template SCSS                                        |
| `npm test`          | Unit tests (Vitest)                                                                                 |

---

## Features

Everything in `API_DOC.md` **except** `POST /translate` (the panel is for
humans; machine-to-machine requests are signed with an API key, not a session).

### Shared by both roles

| Screen        | Endpoints used                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Login         | `POST /auth/login`                                                                                      |
| Dashboard     | `GET /histories` (counts read from `meta.total`), `GET /languages`, `GET /drivers`, `GET /account-keys` |
| Histories     | `GET /histories`, `GET /histories/detail/{ID}`, `POST /histories/resend-callback/{ID}`                  |
| API Keys      | `GET/POST/PUT/DELETE /account-keys…`, `GET /account-keys/detail/{ID}`                                   |
| Drivers       | `GET /drivers`                                                                                          |
| Languages     | `GET /languages`                                                                                        |
| System Status | `GET /`, `GET /health`                                                                                  |
| My Profile    | `GET /auth/me`, `GET /access-token` (refresh), `POST /auth/logout`                                      |

### Admin only

| Screen        | Endpoints used                                                                    |
| ------------- | --------------------------------------------------------------------------------- |
| Accounts      | `GET /accounts`, `GET /accounts/detail/{ID}`, `POST/PUT/DELETE /accounts…`        |
| Driver Access | `GET/POST/PUT/DELETE /account-drivers…`                                           |
| Languages     | `POST /languages/insert`, `PUT /languages/update/{ID}`                            |
| Drivers       | `POST /drivers/insert`, `PUT /drivers/update/{ID}`, `DELETE /drivers/delete/{ID}` |
| API Keys      | Every key of every account, with an `account_id` filter                           |
| Histories     | Every account's jobs, plus retranslate and delete                                 |

Clients only ever see their own keys, their granted drivers and their own
histories — the backend enforces this and the panel mirrors it by hiding the
admin menu section. `roleGuard` also redirects a client away from `/accounts`
and `/account-drivers`.

The Histories detail screen polls `GET /histories/detail/{ID}` every 4 s while a
job is still `requested`, which is the polling fallback the API documents for
keys without a `callback_url`.

---

## Architecture

```
src/
  environments/            Runtime config (apiBaseUrl, page size)
  types/vendor.d.ts        Ambient types for the global template / 3rd-party scripts
  app/
    core/
      models/              Types mirroring API_DOC.md
      http/                ApiService (envelope unwrapping), ApiError, interceptors
      auth/                SessionStore (token + account, mirrored to localStorage)
      guards/              authGuard, guestGuard, roleGuard
      services/            One service per API resource + LookupService cache
      ui/                  ListController, ToastService, ConfirmService, ThemeService
      utils/               Formatting helpers
    layout/                Header, Sidebar, Footer, MainLayout, AuthLayout
    shared/ui/             Reusable presentational components
    features/              One folder per screen, all lazily routed
```

### Key ideas

- **`ApiService`** is the only place that knows about URLs and the
  `{ success, message, data, meta }` envelope. Resource services
  (`LanguageService`, `DriverService`, …) are thin wrappers over it.
- **`ApiError`** is a normalised failure. `errorInterceptor` converts every
  `HttpErrorResponse` into one, so components only read `.message` and
  `.fieldMessages` instead of switching on status codes.
- **`SessionStore`** owns the access token and the cached account. It is
  deliberately HTTP-free so `authInterceptor` and `AuthService` can both depend
  on it without a DI cycle.
- **`ListController`** holds the list-screen state shared by all eight tables
  (page, page size, search, sort order, loading/error flags, "reset to page 1
  when a filter changes"). Each page only supplies a `load(query)` function and
  a reactive `filters` signal.
- **Route-level lazy loading** everywhere; the initial bundle is just the shell.
- The app is **zoneless** (Angular 21 default) and uses signals + `OnPush`.

### Authentication notes

`POST /auth/login` returns the token in the body _and_ sets an httpOnly cookie.
Because the panel and the API usually run on different origins, cross-site
cookie delivery is unreliable (`SameSite=Lax`), so the panel authenticates with
the `Authorization: Bearer` header, which `API_DOC.md` documents as equivalent.
The token is persisted in `localStorage` under `translator.access_token` and is
revalidated against `GET /auth/me` by `provideAppInitializer` before the first
render, so guards never trust a stale token. A `401` clears the session and
redirects to `/login?reason=session-expired`.

---

## Template integration

The template lives untouched in `templates/`. Three things bridge it into Angular:

1. **SCSS → CSS.** `npm run build:css` compiles
   `templates/assets/scss/main.scss` into `public/assets/css/main.css`
   (minified). Keep editing the SCSS; never edit the generated CSS.
2. **Vendor assets.** The libraries the panel needs were copied into
   `public/assets/vendor/` and are referenced from `src/index.html`:

   | Asset           | Used for                                   |
   | --------------- | ------------------------------------------ |
   | Bootstrap 5     | Grid, utilities, dropdowns, modals, toasts |
   | Bootstrap Icons | Brand marks                                |
   | Phosphor Icons  | All UI icons (`ph-*`)                      |
   | Remixicon       | Kept from the template for parity          |
   | Flatpickr       | Date range filters on Histories            |
   | ApexCharts      | Jobs-by-status donut on the Dashboard      |

   They are loaded as `<link>` / `<script src>` rather than bundled, because the
   icon stylesheets resolve their font files relative to the stylesheet — the
   bundler would otherwise try to inline them.

3. **Template JavaScript.** `assets/js/theme.js` is loaded because it applies the
   saved colour scheme before the first paint and exposes `window.Theme`, which
   `ThemeService` delegates to. The sidebar, back-to-top, fullscreen and toast
   behaviours are reimplemented in Angular instead of loading `main.js` /
   `notifications.js`: those scripts bind listeners on `DOMContentLoaded`, which
   races with Angular rendering. `assets/js/*` are still served from
   `public/assets/js/` for reference.

   > The theme toggle button uses `.js-theme-toggle`, not the template's
   > `.theme-toggle`, so `theme.js` does not add a second click handler that
   > would cancel the Angular one out.

---

## Project conventions

- One screen per file, standalone components, `ChangeDetectionStrategy.OnPush`,
  no `NgModule`.
- Lists: `<div class="card">` → `.card-toolbar` → `table.table.table-hover` →
  `app-pagination`. Loading/empty/error rows come from `tr[app-table-state]`.
- Mutations: `<app-modal>` wrapping a reactive form; API failures are shown
  inside the dialog using `ApiError.fieldMessages`.
- Destructive actions always go through `ConfirmService.ask()`.
- Every mutation reports its outcome with `ToastService`.

---

## Verification performed

Checked against the running backend on `http://localhost:3000`:

- Login for both seeded roles; session restored after a page reload.
- Admin sees the full menu, client sees no Administration section and
  `/accounts` redirects to `/dashboard`.
- Create / edit a language, create a driver, create an API key (one-time reveal
  dialog), delete an API key through the confirmation dialog, cancel with ESC.
- Server-side search, status filter, page-size selection, sidebar
  collapse/expand, off-canvas drawer on mobile, light/dark theme toggle.
- No console errors; no horizontal overflow at 390 px or 1440 px.

---

## Known limitations

- `LookupService` loads filter options with `limit=100` (the API maximum). A
  deployment with more than 100 languages / drivers / accounts would need a
  typeahead instead of a plain `<select>`.
- Languages have no delete endpoint, so the Languages screen only offers create
  and edit — deactivating a code is the API's way of retiring it.
