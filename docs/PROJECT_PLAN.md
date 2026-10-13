# Project Plan — GameReview

Academic MVP fullstack game review application.
Stack: Django + DRF + PostgreSQL + JWT (backend), React + Vite (frontend),
REST API under `/api/v1`, pragmatic View → Service → Repository → Model flow.

This document tracks phase progress. Checked items are complete; unchecked
items are not implemented yet.

## Status

| Phase | Description               | Status        |
| ----- | ------------------------- | ------------- |
| 00    | Project Setup             | ✅ Complete   |
| 01    | Backend Foundation        | ✅ Complete   |
| 02    | Authentication            | ✅ Complete   |
| 03    | Game Module               | ✅ Complete   |
| 04    | Review                    | ✅ Complete   |
| 05    | Comment and Favorite      | ✅ Complete   |

| 06    | Frontend Foundation       | ✅ Complete   |
| 07    | Game UI                   | ✅ Complete   |
| 08    | Review UI                 | ✅ Complete   |
| 09    | Admin                     | ✅ Complete   |
| 10    | Testing and Hardening     | ⬜ Pending    |

---

## Phase 00 — Project Setup ✅

- [x] Repository structure (`backend/`, `frontend/`, `docs/`)
- [x] Django project + app skeletons (accounts, games, reviews, comments, favorites, common)
- [x] React + Vite project (axios, react-router-dom)
- [x] PostgreSQL configuration (local database `gamereview`)
- [x] Environment configuration (`.env` gitignored, `.env.example`)
- [x] Basic README
- [x] Lint/format configuration (ruff, oxlint, prettier)
- [x] `.gitignore`

Acceptance:

- [x] Backend starts
- [x] Frontend starts
- [x] Database connection works
- [x] Health endpoint works

---

## Phase 01 — Backend Foundation ✅

- [x] Standard success/error response envelope (`apps/common/responses.py`)
- [x] Global DRF exception handling (`apps/common/exceptions.py`)
- [x] Application exception hierarchy (`AppException` family)
- [x] JSON 404/500 handlers for `/api/` routes
- [x] Pagination foundation with standard envelope (`apps/common/pagination.py`)
- [x] Reusable filtering/search/ordering foundation (`apps/common/filters.py`)
- [x] Permission foundation (`apps/common/permissions.py`)
- [x] Health endpoint with lightweight database check
- [x] Logging configuration (`DJANGO_LOG_LEVEL`)
- [x] Configuration review (env vars, CORS, no committed secrets)
- [x] API versioning consistent (`/api/v1/`)

Acceptance:

- [x] Request flow documented (`docs/ARCHITECTURE.md`)
- [x] Layer responsibilities documented (View / Serializer / Service / Repository / Model)
- [x] No unnecessary layers introduced
- [x] Standard success response exists
- [x] Standard error response exists
- [x] Global exception handling exists
- [x] Pagination foundation exists
- [x] API versioning is consistent
- [x] `exceptions.py`, `responses.py`, `pagination.py`, `filters.py`, `permissions.py` exist
- [x] Environment variables used correctly; no secrets committed
- [x] CORS configured safely for local development
- [x] PostgreSQL setup continues working
- [x] Health endpoint tested
- [x] Response handling tested (400/401/403/404/405/409/500)
- [x] Exception handling tested
- [x] Pagination tested (default page, custom size, caps, boundaries)
- [x] Permission foundation tested
- [x] Filtering foundation tested
- [x] Existing tests still pass
- [x] Ruff + format + pytest pass
- [x] Documentation updated (`docs/ARCHITECTURE.md`, `docs/API.md`)

Known follow-up resolved in Phase 02: accounts now uses an email-based
`UserManager` (`create_user(email, password)`); shared test fixtures moved to
`backend/conftest.py` and use it.

---

## Phase 02 — Authentication ✅

- [x] Register, login, refresh, logout, current user endpoints (`/api/v1/auth/`)
- [x] JWT issuance wired to the accounts module (SimpleJWT, rotation + blacklist)
- [x] Email-based `UserManager` (`create_user`/`create_superuser`, normalized
      email, hashed passwords, safe defaults)
- [x] Permissions: authenticated user, admin, ownership
      (authenticated flow tested here; `IsAdmin`/`IsOwner` classes from
      Phase 01)
- [x] Tests: valid registration, duplicate email (case-insensitive), invalid
      credentials, authenticated endpoint, unauthorized request, expired token,
      token rotation/blacklist, logout, admin add-user form

Acceptance:

- [x] Register returns 201 + safe user fields, no tokens, no password
- [x] Login returns access + refresh + user; same generic 401 for wrong
      password / unknown email / inactive account
- [x] `GET /auth/me/` works with Bearer access token; 401 without/invalid/expired
- [x] Refresh rotates tokens; old/blacklisted refresh rejected with 401
- [x] Logout blacklists refresh token (reuse → 401)
- [x] Passwords stored hashed (`set_password`), never returned or logged
- [x] Duplicate email → 400 field error; model `UNIQUE` constraint backstop
- [x] Email normalized to lowercase everywhere (API + manager + admin form)
- [x] Users cannot self-register as staff/superuser
- [x] Admin add-user form uses email + password fields (no username)
- [x] Migration non-destructive (`AlterModelManagers` + `AddField` only)
- [x] Existing Phase 00/01 tests still pass
- [x] Ruff + format + pytest pass
- [x] Documentation updated (`docs/API.md`, `docs/ARCHITECTURE.md`, `README.md`)

---

## Phase 03 — Game Module ✅

- [x] Category CRUD (public list, admin create/update/delete)
- [x] Game CRUD, detail by slug, search, filtering, pagination
- [x] Tests: CRUD, validation, permission, filtering, pagination

Acceptance:

- [x] `Category` model: unique `name`, unique `slug`, timestamps
- [x] `Game` model: unique `slug`, status choices (`ACTIVE`/`INACTIVE` +
      DB check), `category` FK with `PROTECT`, timestamps
- [x] Predictable slug generation (slugify + `-2` suffixes, numeric slugs
      rejected on Game for unambiguous routing)
- [x] `GET /api/v1/games/` — search, `?category=` slug filter, `?status=`,
      allowlisted ordering, pagination, envelope
- [x] `GET /api/v1/games/{slug}/` — detail; unknown slug → 404
- [x] `GET /api/v1/categories/` — public list ordered by name
- [x] Public reads; anonymous writes → 401; non-admin writes → 403;
      admin CRUD works
- [x] Inactive games hidden from non-staff (list, detail, `?status=`);
      staff see and manage them
- [x] Referenced-category delete → 409 safe envelope (tested); empty
      category delete → 200 envelope (no 204 anywhere)
- [x] Timestamps/id are read-only — clients cannot set them
- [x] `select_related("category")` — query count does not grow with data
      (regression-tested)
- [x] Migration inspected before applying; `migrate --check` passes
- [x] Phase 00–02 tests still pass
- [x] Ruff + format + pytest + Django check pass
- [x] Documentation updated (`docs/API.md`, `docs/ARCHITECTURE.md`, `README.md`)

---

## Phase 04 — Review ✅

- [x] Review create/update/delete/list, rating validation (1–5), one review per user per game
- [x] Tests covering business rules

Acceptance:

- [x] `Review` model: `game` FK `PROTECT` (`related_name="reviews"`), `user` FK
      `PROTECT`, `rating` 1–5 (`PositiveSmallIntegerField` + DB check
      `review_rating_range`), `content` TextField, timestamps
- [x] `UNIQUE(user, game)` (`unique_review_per_user_per_game`) — duplicate →
      409 `ConflictException("You have already reviewed this game.")` (atomic +
      `IntegrityError` catch in serializer `create()`)
- [x] `GET /api/v1/games/{slug}/reviews/` — paginated list ordered
      `-created_at`, envelope `Reviews retrieved successfully`; unknown slug →
      404; inactive game hidden from anonymous/non-staff (404), staff see it
- [x] `POST /api/v1/games/{slug}/reviews/` — authenticated only (401 anon);
      201 `Review created successfully`; rating integer 1–5 (out of range /
      missing → 400); whitespace-only/empty/missing content → 400
- [x] `PATCH/DELETE /api/v1/review/{pk}/` — owner or admin
      (`IsAdminOrOwner`); other user → 403; anonymous → 401; 200 envelopes
      (`Review updated successfully` / `Review deleted successfully`, no 204)
- [x] Author serialized safely as `{id, first_name, last_name}` (no email);
      game serialized as `{id, slug, name}`
- [x] `user`/`game`/`id`/timestamps read-only — forged IDs in payloads ignored
- [x] Review writes follow game visibility (`Game.objects.visible_to(user)`)
- [x] `select_related("game", "user")` — list query count does not grow with
      data (regression-tested)
- [x] Game delete with reviews → 409 safe envelope (regression fixed:
      `ProtectedError` caught in `GameUpdateDestroyView.destroy`)
- [x] Migration inspected before applying; `migrate --check` passes
- [x] Phase 00–03 tests still pass
- [x] Ruff + format + pytest + Django check pass
- [x] Documentation updated (`docs/API.md`, `docs/ARCHITECTURE.md`, `README.md`)

Out of scope (deferred): Comment CRUD and `average_rating`/`review_count`
aggregation — no denormalized rating fields on `Game` (Phase 05/09 decisions).

---

## Phase 05 — Comment and Favorite ✅

- [x] Comment CRUD with ownership permissions
- [x] Add/remove favorite, list favorites
- [x] Duplicate prevention via database constraint
- [x] Tests

Acceptance:

- [x] `Comment` model: `review` FK `PROTECT` (`related_name="comments"`),
      `user` FK `PROTECT`, `content` TextField + DB `CheckConstraint`
      `comment_content_not_blank` (rejects whitespace-only/empty), timestamps;
      no nested replies; no indexes beyond the automatic FK indexes
- [x] `GET /api/v1/reviews/{id}/comments/` — public list, paginated,
      ordered `-created_at`, envelope `Comments retrieved successfully`;
      unknown review → 404; visibility inherited from the game (inactive →
      404 for non-staff, staff see it)
- [x] `POST /api/v1/reviews/{id}/comments/` — authenticated (401 anon);
      201 `Comment created successfully`; author from token, review from URL;
      forged `user`/`user_id`/`review`/`review_id`/timestamps ignored;
      blank/whitespace/missing content → 400; inactive-game reviews → 404
      for ordinary users, staff allowed
- [x] `PATCH/DELETE /api/v1/comments/{id}/` — owner or admin
      (`IsAdminOrOwner`); non-owner → 403, anon → 401, unknown → 404;
      200 envelopes (`Comment updated successfully` /
      `Comment deleted successfully`, no 204); partial PATCH
- [x] Safe author serialization `{id, first_name, last_name}` (shared
      `SafeUserSerializer`), `review` returned as plain id; `select_related`
      — list query count does not grow with data (regression-tested)
- [x] `Favorite` model: `user`/`game` FKs `PROTECT`, `created_at` only,
      `UNIQUE(user, game)` (`unique_favorite_per_user_per_game`); no
      soft-delete/history
- [x] `POST /api/v1/games/{slug}/favorite/` — authenticated (401 anon);
      201 `Favorite added successfully`; game via `visible_to(user)`
      (unknown/inactive → 404 for non-staff); **duplicate → 409**
      `"You have already favorited this game."` via atomic savepoint +
      `IntegrityError` mapping (races never leak DB errors); forged user ids
      ignored
- [x] `DELETE /api/v1/games/{slug}/favorite/` — authenticated; scoped to
      `request.user` only (another user's favorite never removed);
      **idempotent** — missing favorite → 200 `Favorite removed successfully`
      (documented); unknown/inactive game → 404; 200 envelope
- [x] `GET /api/v1/me/favorites/` — authenticated only (401 anon);
      paginated envelope `Favorites retrieved successfully`, only the current
      user's favorites (client-supplied user params ignored), inactive games
      filtered for non-staff, `select_related("game", "game__category")` —
      query count flat (regression-tested)
- [x] Safe game shape `{id, name, slug, cover_image, release_date, status,
      category}` with nested `{id, name, slug}` category
- [x] Migrations inspected before applying (`comments.0001`,
      `favorites.0001` — PROTECT FKs, content check, unique constraint);
      `migrate --check` passes; no unrelated schema changes
- [x] Phase 00–04 tests still pass (review ownership, game-delete 409 intact)
- [x] Ruff + format + pytest + Django check pass
- [x] Documentation updated (`docs/API.md`, `docs/ARCHITECTURE.md`,
      `README.md`)

---

## Phase 06 — Frontend Foundation ✅

- [x] Routing, API client, centralized authentication state
- [x] Reusable layout, loading/error states, pagination component
- [x] Tests (45 Vitest + Testing Library, no network)

Acceptance:

- [x] Single Axios client (`src/api/client.js`): unwraps the
      `{success, message, data|errors}` envelope, normalizes every failure to
      `ApiError {status, message, errors}`; non-envelope 5xx/network failures
      map to generic messages — raw payloads never surfaced or logged
- [x] Access token held **in memory only**; refresh token in `sessionStorage`
      (`gamereview.refresh`) — **no tokens in `localStorage`** (backend returns
      tokens only in JSON, no HttpOnly-cookie flow; trade-off documented in
      `docs/FRONTEND.md`)
- [x] Single-flight token refresh: concurrent 401s share one refresh promise,
      each request retried at most once, auth endpoints (`login/register/
      refresh/logout`) never trigger refresh; HTTP refresh failure clears the
      session app-wide, network failure keeps it; logout clears local state
      even when the server call fails
- [x] `AuthProvider` restores the session on startup (refresh → `GET
      /auth/me/`) or starts unauthenticated without a request; `login`,
      `register` (auto-login — register issues no tokens), `logout` exposed
      via `useAuth()`; no Redux/Zustand (auth is the only shared client state)
- [x] Route table (`AppRoutes`): `/`, `/games`, `/login`, `/register`,
      `/profile` + `/favorites` behind `ProtectedRoute` (loader while
      restoring, redirect to `/login` preserving `location.state.from`),
      `*` → NotFound; no admin route (none until Phase 09)
- [x] `AppLayout` with responsive nav (auth-aware links, hamburger on small
      screens); reusable components: `Button` (loading/`aria-busy`),
      `Input` (label + `aria-invalid`/`aria-describedby` + alert),
      `Loading`, `ErrorMessage`, `EmptyState`, `PageContainer`, `Pagination`
- [x] Functional `Login`/`Register` pages against the real API; Home, Games,
      Profile, Favorites are clearly badged placeholders — no mock data,
      no full business pages (Phase 07–08 scope)
- [x] JSDoc API types mirror documented shapes only — no invented fields
      (e.g. no `average_rating`); no hardcoded secrets (`.env` ignored,
      `.env.example` committed)
- [x] Tooling: Vitest + jsdom + Testing Library (lightest suitable), fake
      adapters — tests never hit the network; lint (`oxlint`) clean with zero
      warnings, `prettier --check` clean, `vite build` succeeds; dev server
      smoke (`/` and `/login` → 200, title `GameReview`)
- [x] Backend untouched this phase (242 backend tests unchanged);
      documentation updated (`docs/FRONTEND.md`, `README.md`, this plan)

---

## Phase 07 — Game UI ✅

- [x] Game list, search, filtering, pagination, detail, category navigation

Acceptance:

- [x] Listing (`/games`) fetches real data via `listGames()` through the
      shared client — backend-supported params only: `search`, `category`
      (slug), `ordering` allowlist, `page`, `page_size=12`; URL query uses
      the same names (refresh/back/share preserve state); search debounced
      300 ms (`replace`), filter/page changes push and reset to page 1
- [x] Every fetch carries an `AbortController` and drops responses after
      `signal.aborted`; loading/error derived from a params-key comparison
      (no duplicate/stale application of results; effects set state only
      from async callbacks)
- [x] States: loader, retryable API error (**Try again**), 404-past-last-page
      (**Back to first page** — backend returns 404 for out-of-range pages),
      empty catalog vs filtered empty (**Clear filters**), result count,
      `Pagination` wired to `pagination.page/total_pages`
- [x] Category filter options from `GET /categories/?page_size=100` (backend
      max); disabled while loading, retryable error on failure;
      `status` filter deliberately omitted (only meaningful for staff —
      documented, not invented)
- [x] `GameCard` component renders verified fields only (name, category
      badge, developer, release date, excerpt; `Inactive` badge when
      `status=INACTIVE`); missing `cover_image` → neutral placeholder, no
      fabricated images/attributes; card click → detail via one stretched
      link (single accessible target, `focus-within` ring)
- [x] Detail route `/games/:slug` (slug = API identifier): verified fields
      only, timezone-safe `release_date` formatting (`utils/format.js`,
      `en-US` pinned), **Game not found** state for 404 (unknown/invisible
      slug), retryable error state, **Back to games** link; browser
      back/forward intact
- [x] Reviews on detail are display-only: `GET /games/{slug}/reviews/`
      (paginated, newest first) with reusable `ReviewCard` (sr-only rating
      label), independent loading/error/empty states (reviews failure never
      hides the game); no review create/edit workflow (Phase 08)
- [x] Navigation: existing Games nav item functional, listing↔detail click
      round-trip verified; auth behavior, Home/Profile/Favorites/Login/
      Register/NotFound untouched; no layout redesign
- [x] Responsive grid (`auto-fill minmax`), semantic HTML (dl facts,
      labelled selects/inputs, headings), keyboard-accessible links/buttons
      with existing focus styles; design tokens only — no new dependencies
      (`package.json` unchanged)
- [x] Tests: 63 total across 10 files — new coverage for listing success,
      loading, empty (both variants), error + retry, debounced search
      (single request), ordering/category params, pagination, stale-response
      drop, page-out-of-range; detail fields, loading, 404, error + retry,
      reviews failure/empty; listing↔detail navigation. All fake adapters,
      no network. Existing auth/client/route-protection tests unchanged and
      passing (the one placeholder assertion in `AppRoutes.test.jsx` was
      updated to assert the real listing)
- [x] Quality gates: `npm test` 63 passed, `oxlint` 0 warnings,
      `prettier --check` clean, `vite build` OK, backend `pytest` 242 passed
      (backend untouched — no `.py`/migration changes), `git diff --check`
      clean; tree-diff vs Phase 06 baseline shows only Phase 07 files
- [x] Documentation updated (`docs/FRONTEND.md`, `README.md`, this plan)

---

## Phase 08 — Review UI ✅

- [x] Review list/create/edit/delete, rating display — integrated into
      `/games/:slug` via a `GameReviews` section (`key={slug}` remount
      resets pagination/edit/confirm state) with the keyed + abort
      fetch pattern: shared `ReviewForm` (rating 1–5 radio group + content,
      client validation mirroring the backend, server field errors inline,
      general `ApiError.message` as alert, pending submit guard, no
      optimistic UI), `ReviewCard` owner/staff actions with inline delete
      confirmation, signed-out "Log in" prompt preserving `state.from`,
      page reset + refetch after create, list refetch after edit/delete
- [x] Authorization mirrors the verified contracts: author
      (`review.author.id` vs `useAuth().user.id`) or `is_staff` for
      Edit/Delete; create form hidden when the user already reviewed (page
      load or session create) with the backend 409 as the authoritative
      duplicate guard; 401/403/400/404/409 rendered as recoverable errors
      (404 on delete reconciles the list silently)
- [x] Comment UI deliberately not added: the Phase 08 spec covers reviews
      only and forbids functionality outside the phase (the plan bullet's
      original "comments" wording noted here rather than silently
      implemented); comment API wrappers exist since Phase 06
- [x] Tests: 85 total across 11 files — new `ReviewForm.test.jsx` (8:
      accessible rating group, client validation, trimmed payload,
      duplicate-submit guard, server field/general errors, prefill, cancel)
      and 14 detail-page workflows (anon prompt + destination preserved,
      signed-in creation form, author/staff controls, client validation
      with no request, exact `{rating, content}` create payload + list
      refresh, 409 keeping input, 401, edit prefill + `PATCH` + refresh,
      delete confirm/cancel/success + form reappears, 403 recoverable,
      pagination, stale-response drop after mutation refresh). Existing
      coverage passes with minimal harness updates (AuthProvider wrapper,
      `/games/:slug` route so `useParams` resolves, one review assertion
      now awaited because the section mounts after the game)
- [x] Quality gates: `npm test` 85 passed, `oxlint` 0 warnings,
      `prettier --check` clean, `vite build` OK, backend `pytest` 242 passed
      (backend untouched — no `.py`/migration changes), dev-server smoke
      `/`, `/games`, `/games/elden-ring` → 200; tree-diff vs Phase 07
      baseline shows only Phase 08 files (`api/reviews.js` JSDoc,
      `GameReviews.jsx`, `ReviewForm.jsx` + test, `ReviewCard.jsx`,
      `GameDetail.jsx` + test, `index.css`)
- [x] Documentation updated (`docs/FRONTEND.md`, `README.md`, this plan)

---

## Phase 09 — Admin ✅

- [x] Access boundary: `AdminRoute` wraps the `/admin` subtree — session
      loader while restoring, unauthenticated → `/login` with
      `location.state.from`, authenticated non-staff (and any user whose
      `is_staff` flag is missing/malformed) → access-denied `EmptyState`,
      check is `user?.is_staff === true` (fails closed); `Admin` layout nav
      entry only for staff; documented as UX-only because `IsAdmin`/
      `IsAdminOrReadOnly` enforces every write server-side (401/403 verified
      against backend tests/source)
- [x] Navigation-only dashboard (`/admin`): cards to the supported modules
      plus a muted unsupported-capabilities note — **zero API calls, no
      fabricated metrics** (verified: the backend exposes no
      dashboard/statistics summary endpoint)
- [x] Game management (`/admin/games`, `/admin/games/new`,
      `/admin/games/:slug/edit`): list over `GET /games/` with on-submit
      search, supported `status` filter and server pagination; create with
      the exact verified payload (`name`, `slug` when typed, `description`,
      `developer`, `publisher`, `release_date`, `cover_image`, `status`,
      numeric `category_id`); edit loads by slug and `PATCH`es by **numeric
      id**; reversible `PATCH {status}` toggle with list refresh; two-step
      delete — 409 (reviews reference the game) and 403 render recoverable
      alerts that keep the row, 404 reconciles; client validation mirrors
      backend rules, server field errors (`errors.slug`) render inline,
      duplicate submits guarded
- [x] Category management (`/admin/categories`): paginated list, create
      panel (exact payload `{name}`, `slug` omitted unless typed, panel
      remounted after success), inline row edit (`PATCH {name, slug}`), and
      two-step delete with 409 (games reference the category) recoverable /
      404 reconcile
- [x] Limitations implemented as documented, not faked: **no review
      moderation module** (backend has no global cross-game review list —
      staff can already delete any review from game detail since Phase 08),
      **no user management** (no user/role endpoints beyond
      register/login/refresh/logout/me), **no dashboard metrics** (no
      summary endpoint)
- [x] Tests: 117 total across 15 files — new `AdminRoute.test.jsx` (5:
      loader, anonymous redirect preserving destination, staff allowed,
      non-staff denied, missing flag fails closed), `AdminGames.test.jsx`
      (13: list fields/badges/actions, empty, error + retry, supported
      params + clear filters, pagination, exact create payload +
      navigation, client validation with no request, server field errors,
      duplicate-submit guard, edit prefill + exact `PATCH {id}/`, status
      toggle single-field PATCH + refresh, delete confirm/cancel/refresh,
      409 then 403 recoverable), `AdminCategories.test.jsx` (9: list,
      empty, error + retry, exact `{name}` create + form reset, explicit
      slug, client validation + server duplicate, inline edit + exact
      `PATCH {id}/`, delete confirm + 409 recoverable + success, pagination),
      `AdminDashboard.test.jsx` (2: navigation only, no API calls/metrics),
      plus 3 AppRoutes additions (staff-only `Admin` nav, hidden from
      regular users, staff dashboard at `/admin`); the never-settling
      loader stub was made self-releasing so it cannot hang the
      module-level single-flight refresh for later tests
- [x] Quality gates: `npm test` 117 passed, `oxlint` 0 warnings,
      `prettier --check` clean, `vite build` OK, backend `pytest` 242 passed
      (backend untouched — no `.py`/migration changes), dev-server smoke
      `/`, `/admin`, `/admin/games`, `/admin/games/new`,
      `/admin/categories` → 200; tree-diff vs Phase 08 baseline shows only
      Phase 09 files (`AdminRoute.jsx` + test, `pages/admin/*`,
      `components/admin/*`, `AppRoutes.jsx` + test, `AppLayout.jsx`,
      `Input.jsx`, `api/games.js` JSDoc, `types/index.js`, `index.css`);
      hygiene greps clean (no console/TODO/localStorage/`.only`/secrets/
      mock data/direct network calls)
- [x] Documentation updated (`docs/FRONTEND.md` routing + Admin UI section
      with limitations, `README.md`, this plan)

---

## Phase 10 — Comments & Favorites UI ✅

- [x] Contracts verified against backend source/tests/docs before UI work
      (no backend changes): `GET|POST /reviews/{id}/comments/` (paginated,
      newest first, public read, auth write, `IsAuthenticatedOrReadOnly`,
      exact `{content}` payload, 201/400 blank), `PATCH|DELETE /comments/{id}/`
      (`IsAdminOrOwner`, 401/403/404, 200 envelopes); `POST|DELETE
      /games/{slug}/favorite/` (auth, empty body, 201 + reduced game payload,
      duplicate 409, idempotent DELETE 200), `GET /me/favorites/` (auth,
      current-user-only, `-created_at`, standard pagination, 404 out of
      range); **no `is_favorited` field / no per-game status endpoint** —
      status is derived from the favorites set
- [x] Comment UI: lazily expanded `ReviewComments` panel per review card
      (`ReviewCard` children slot; zero requests while collapsed; toggle
      `aria-expanded`/`aria-controls`), shared keyed-result +
      `AbortController` fetch (`reviewId|page|reloadKey`, stale responses
      dropped), `CommentForm` (trimmed `content`, client + server field
      errors, duplicate-submit guard, input kept on failure / cleared on
      success), `CommentItem` (verified payload only, "(edited)" marker,
      owner/staff Edit + two-step Delete via `canManage =
      is_staff || author.id === user.id`, 403 recoverable, 404 silent
      reconcile), anon prompt links to `/login` with `state.from`, panel
      failure never hides the game/review
- [x] Favorites: `FavoritesProvider` (slug set loaded once per session from
      `GET /me/favorites/` at `page_size=100`, silent load failure, ops
      replayed over the load, synchronous per-slug pending guard, 409-on-add
      reconciled as success, no optimistic UI) + shared `FavoriteToggle`
      (anon → "Log in to favorite" with `state.from`; signed in →
      add/remove button + inline recoverable error) wired into
      `GameCard`'s new action slot, the detail header, and the new
      `/favorites` page (loader → error+retry → 404 out-of-range with back
      action → empty + Browse games → grid + count + pagination; rows reuse
      `GameCard` + toggle and refresh after a confirmed removal);
      `GameCard` hides `developer`/`description` when absent (favorite
      payload omits them) instead of inventing "unknown" text
- [x] Tests: 154 total across 18 files — new `ReviewComments.test.jsx` (17:
      lazy fetch against the right review, loading/error/retry, empty, anon
      prompt + destination + no form, exact trimmed create + refresh +
      clear, client validation without a request, server field errors keep
      input, duplicate-submit guard, author/non-author/staff controls,
      exact `PATCH` + refresh + "(edited)", delete confirm/cancel/success,
      403 recoverable, 404 reconcile, stale-response drop, pagination),
      `FavoriteToggle.test.jsx` (8: signed-out link + destination, exact
      POST + flip, pending duplicate guard, 409 reconcile without alert,
      add failure unchanged, prefilled set → remove flips, remove failure
      unchanged, load failure still functional via 409 self-heal),
      `Favorites.test.jsx` (8: renders API favorites without invented card
      fields, empty + browse link, error + retry, pagination, removal →
      DELETE + list refresh, removal failure keeps row, 404 out-of-range +
      back, listing↔favorites consistency integration); additions to
      `Games.test.jsx` (signed-out card prompt), `GameDetail.test.jsx`
      (signed-out toggle prompt, authed favorite status, comments failure
      isolation); harness updates only where providers are now required
      (`Games.test`/`GameDetail.test` render helpers wrap
      `FavoritesProvider`, `Login.test` destination assertion now proves the
      real favorites page)
- [x] Quality gates: `npm test` 154 passed, `oxlint` 0 warnings
      (`useFavorites` added to the existing `allowExportNames` list),
      `prettier --check` clean, `vite build` OK, backend `pytest` 242 passed
      (backend untouched — no `.py`/migration changes), dev-server smoke
      `/` + module transforms OK; tree-diff vs Phase 09 baseline shows only
      Phase 10 files (`components/comments/*`, `components/favorites/*`,
      `contexts/FavoritesContext.jsx`, `pages/Favorites.jsx` + test,
      `GameCard.jsx`, `ReviewCard.jsx`, `GameReviews.jsx`, `Games.jsx`,
      `GameDetail.jsx` + test, `AppRoutes.jsx`, `index.css`,
      `api/comments.js`/`api/favorites.js` JSDoc + signal config,
      `test/fixtures.js`, `.oxlintrc.json`, `Games.test.jsx`,
      `Login.test.jsx`); hygiene greps clean (no console/TODO/localStorage/
      `.only`/secrets/mock data/direct network calls)
- [x] Documentation updated (`docs/FRONTEND.md` Comments & Favorites section
      with decisions, `README.md`, this plan)

---

## Phase 11 — Testing and Hardening ⬜

- [ ] Security, permissions, validation, DB constraints, N+1 review,
      duplicated code, API consistency, error handling, frontend API handling,
      test coverage — fix only confirmed issues, no new features

---

## Quality Gate (every phase)

1. Implementation → 2. Tests → 3. Test execution → 4. Code review →
5. Architecture review → 6. Fix confirmed issues → 7. Update documentation →
8. Final verification

A phase is DONE only when tests pass, architecture rules are respected, no
known critical bug remains, documentation is updated, and scope has not
expanded.

## Scope Control

Not in the MVP unless explicitly requested: payments, recommendation AI,
realtime chat, notifications, microservices, Elasticsearch, Kubernetes,
complex cloud infrastructure. Out-of-scope discoveries are recorded as future
improvements, not implemented.
