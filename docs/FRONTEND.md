# Frontend Architecture

React foundation from Phase 06, extended in Phase 07 with the game browsing
experience (listing + detail), Phase 08 with review workflows, Phase 09 with
the admin UI, and Phase 10 with comment display/mutation and favorites. This
document describes the infrastructure and the implemented flows.

## Startup & Environment

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

| Variable            | Default                        | Purpose                      |
| ------------------- | ------------------------------ | ---------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL         |

Copy `.env.example` to `.env` to override (`.env` is git-ignored; only
`.env.example` is committed — no secrets in the repository). The backend must
allow the frontend origin (CORS defaults to `http://localhost:5173`).

## Checks

| Task              | Command                            |
| ----------------- | ---------------------------------- |
| Lint              | `npm run lint` (oxlint)            |
| Format check      | `npm run format:check` (Prettier)  |
| Unit tests        | `npm test` (Vitest + Testing Library) |
| Production build  | `npm run build` (Vite)             |

Tests run in `jsdom` (`vite.config.js` → `test`), setup in
`src/test/setup.js` (jest-dom matchers, DOM cleanup, token/sessionStorage
reset between tests). **Tests never hit the network** — they swap
`client.defaults.adapter` for the shared fake adapter
(`src/test/helpers.js`: adapter + envelope/pagination builders) with verified
payload fixtures (`src/test/fixtures.js`).

## Module Layout

```text
frontend/src/
├── api/            # Axios client + one module per backend resource
│   ├── client.js   # envelope unwrap, ApiError, tokens, refresh logic
│   ├── auth.js     # register/login/me/logout
│   └── …           # games, reviews, comments, favorites wrappers
├── components/
│   ├── common/     # Button, Input, Pagination, Loading, ErrorMessage, EmptyState, PageContainer
│   ├── comments/   # ReviewComments (lazily expanded panel), CommentForm, CommentItem
│   ├── favorites/  # FavoriteToggle (shared add/remove control)
│   ├── games/      # GameCard (listing card, optional action slot)
│   ├── layouts/    # AppLayout (header/nav/footer, auth-aware links)
│   ├── reviews/    # GameReviews section + ReviewCard (with comments slot)
│   └── routes/     # ProtectedRoute (auth gate)
├── contexts/       # AuthContext (auth state), FavoritesContext (shared favorite set)
├── pages/          # Route components (Home/Profile remain badged placeholders)
├── routes/         # AppRoutes — route table
├── test/           # vitest setup + shared fake adapter, fixtures
├── types/          # JSDoc typedefs mirroring API shapes (no TypeScript)
└── utils/          # date formatting helpers
```

The project is intentionally **plain JavaScript with JSDoc** — no TypeScript
conversion.

## API Client (`src/api/client.js`)

- Every response is unwrapped from the `{success, message, data|errors}`
  envelope; callers receive `data` directly.
- Failures reject with `ApiError { status, message, errors }` (`errors` is the
  DRF field-error object). Non-envelope 5xx responses and network failures
  surface generic messages — the backend's raw body is never shown or logged.
- One shared Axios instance adds the `Authorization: Bearer` header when an
  access token exists and maps params through `buildParams` (drops empty
  values).
- `fieldError(errors, name)` returns a field's first message, tolerating both
  DRF arrays (`{email: ["…"]}`) and local string errors.

## Authentication & Token Storage (documented trade-off)

The backend (djangorestframework-simplejwt) returns tokens **only in the JSON
body** — it has no HttpOnly-cookie flow (adding one would change the
documented API contract, so it was not done in Phase 06).

| Token         | Where                   | Why                                             |
| ------------- | ----------------------- | ----------------------------------------------- |
| Access (30m)  | In memory (module var)  | Never persisted → XSS cannot read it from storage; lost on reload (accepted) |
| Refresh (7d)  | `sessionStorage` key `gamereview.refresh` | Survives reload for session restore, scoped to the tab; **not** `localStorage` (never shared across tabs/sessions) |

Consequences:

- On startup `AuthProvider` restores: refresh token → `POST /auth/refresh/`
  → `GET /auth/me/` → authenticated; no token → immediately unauthenticated
  (no needless request).
- **Single-flight refresh**: concurrent 401s share one refresh promise; each
  request retries at most once (`_retry`). Auth endpoints
  (`login/register/refresh/logout`) never trigger a refresh.
- Refresh failure (HTTP error) clears the session everywhere via
  `onSessionCleared` → user is logged out; transient network errors do not
  destroy the session.
- Logout always clears local state even if the server call fails.
- Tokens and credentials are never logged. A future hardening step (Phase 11)
  could move refresh into an HttpOnly cookie **server-side**, which requires a
  backend change.

## Auth State (`src/contexts/AuthContext.jsx`)

`AuthProvider` owns `{ user, status, isAuthenticated, isLoading, login,
register, logout }`; `useAuth()` consumes it. `status` starts as `"loading"`
only when a stored refresh token exists.

- `login(email, password)` → `POST /auth/login/`, stores tokens, sets user.
- `register(...)` → `POST /auth/register/` then **auto-login** (the register
  endpoint returns no tokens; on login failure the account still exists and
  the page falls back to an error linking to `/login`).
- No Redux/Zustand — auth is the only shared client state, context is enough.

## Routing (`src/routes/AppRoutes.jsx`)

| Path                 | Page            | Guard   |
| -------------------- | --------------- | ------- |
| `/`                  | Home            | —       |
| `/games`             | Games           | —       |
| `/games/:slug`       | GameDetail      | —       |
| `/login`             | Login           | —       |
| `/register`          | Register        | —       |
| `/profile`           | Profile         | Protected |
| `/favorites`         | Favorites       | Protected |
| `/admin`             | AdminDashboard  | Admin   |
| `/admin/games`       | AdminGames      | Admin   |
| `/admin/games/new`   | AdminGameForm   | Admin   |
| `/admin/games/:slug/edit` | AdminGameForm | Admin |
| `/admin/categories`  | AdminCategories | Admin   |
| `*`                  | NotFound        | —       |

`ProtectedRoute` shows a loader while the session restores, redirects to
`/login` with `location.state.from` preserved (Login returns the user to the
originally requested page after a successful sign-in). The `/admin` subtree
is wrapped in `AdminRoute` (see [Admin UI](#admin-ui-phase-09)).

## Games Browsing (Phase 07)

### Listing (`/games`, `src/pages/Games.jsx`)

- Fetches `GET /api/v1/games/` through `listGames()` with exactly the
  backend-supported params: `search`, `category` (slug), `ordering`
  (allowlist: `name`, `release_date`, `created_at` ± `-`), `page`,
  `page_size=12`. The URL query string uses **the same parameter names**, so
  refresh/back/share restore the listing state.
- **Debounce**: the search input updates the URL after 300 ms
  (`replace: true` — no history spam); category/ordering/page changes push
  history and reset to page 1. No debounce library — one `setTimeout`.
- **Stale-response protection**: every fetch gets an `AbortController`;
  responses arriving after `signal.aborted` are dropped. Loading/error are
  *derived* by comparing the last result's params key with the current one —
  effects only set state from async callbacks (keeps
  `react(set-state-in-effect)` clean and avoids flicker races).
- States: loader → API error with **Try again** → 404-on-page (backend
  returns 404 past the last page) with **Back to first page** → empty
  catalog vs. *filtered* empty with **Clear filters** → grid + result count
  + `Pagination`.
- Category options come from `GET /api/v1/categories/?page_size=100` (backend
  max) once on mount; while loading the select is disabled, a failure shows
  a retryable error (never silently swallowed).
- **Decisions:** the `status` filter is intentionally **not** exposed —
  non-staff only ever see `ACTIVE` games, so it would be meaningless for the
  public UI (status filtering lives in `/admin/games`, Phase 09). Cards render
  `status` only as an `Inactive` badge when present (staff view).

### Detail (`/games/:slug`, `src/pages/GameDetail.jsx`)

- `GET /api/v1/games/{slug}/` (slug is the API identifier). 404 → explicit
  **Game not found** state with a link back to the listing; other failures →
  retryable error. `Back to games` link + browser back/forward both work.
- Fields shown are the verified serializer output only (`name`, `category`,
  `developer`, `publisher`, `release_date`, `description`, `status`,
  `created_at`). No cover image is rendered when `cover_image` is empty —
  nothing is fabricated.
- The reviews section (display + Phase 08 write workflows) lives in
  `src/components/reviews/GameReviews.jsx` — see
  [Review Workflows](#review-workflows-phase-08) below. A reviews failure
  never hides the game itself.
- Dates: `release_date` is split into local date parts before formatting
  (`utils/format.js`) — parsing `"YYYY-MM-DD"` with `new Date()` would show
  the previous day in negative-offset timezones. Output locale is pinned to
  `en-US`.

### Card & accessibility

- `GameCard` uses a single stretched link (`.game-card__link::after` covers
  the card): whole card clickable, one focus stop, focus ring via
  `.game-card:focus-within`. Covers use `alt=""` (decorative next to the
  title) and a neutral placeholder block when the image is absent.

## Review Workflows (Phase 08)

### Section component (`src/components/reviews/GameReviews.jsx`)

- Mounted by the detail page as `<GameReviews key={slug} slug={slug} />` —
  pagination, edit mode, and delete confirmation reset per game via the
  remount, with no slug-reset effects. The section owns its keyed fetch
  (same `AbortController` + drop-stale + derived-loading pattern as the
  listing) and its own loader/error/empty states, so a reviews failure
  never affects the game details.
- `GET /api/v1/games/{slug}/reviews/?page&page_size=12` (newest first) with
  the shared `Pagination`.

### Form (`src/components/reviews/ReviewForm.jsx`)

- One form for create and edit: rating radio group (`fieldset`/`legend`,
  options `1 star` … `5 stars`) plus a labelled content textarea. Client
  validation mirrors the backend (rating required 1–5, content non-blank);
  server field errors (`ApiError.errors.rating` / `.content`) render inline
  via `fieldError`, and the general `ApiError.message` (e.g. `409 You have
  already reviewed this game.`) renders as a form-level alert.
- The submit button is disabled while pending (no duplicate requests) and
  nothing is optimistic: on failure the input values are kept so the user
  can correct and retry; the server stays authoritative.

### Permissions (mirrored client-side, server authoritative)

- Signed out → "Log in to write a review." linking to `/login` with
  `state.from` (Login already redirects to `location.state?.from`).
- Signed in → the "Write a review" form, hidden once the user's own review
  is on the loaded page or right after creating one (page resets to 1 — the
  new review is newest). The create payload is exactly `{rating, content}`;
  `user`/`game` come from the token/URL, and the backend's 409 also guards
  duplicates whose review sits on another page.
- Edit/Delete render only for the review's author
  (`review.author.id === user.id`, from the verified payload — the token
  `user.id` comes from `useAuth()`) or staff (`user.is_staff`). No
  client-invented fields such as `is_owner`.
- Delete is a two-step inline confirmation (no native dialogs); while
  pending, both buttons are disabled. Failures (401/403/400/409/…) render a
  recoverable **Review action failed** alert and leave the list untouched;
  a 404 on delete silently reconciles the list instead.

### Mutations (`src/api/reviews.js`)

- `POST /games/{slug}/reviews/` → refetch the list at page 1;
  `PATCH /reviews/{id}/` → close the editor + refetch;
  `DELETE /reviews/{id}/` → close confirmation + refetch. The JSDoc on each
  wrapper records the verified contract (status codes, envelopes,
  permission rules).

### Decisions

- **Comment UI was deferred past Phase 08** (the Phase 08 spec covered
  reviews only) and shipped in Phase 10 — see
  [Comments & Favorites](#comments--favorites-phase-10).
- **No optimistic mutations** — the list refetches only after the server
  confirms, keeping server state authoritative.

## Admin UI (Phase 09)

### Access boundary (`src/components/routes/AdminRoute.jsx`)

- Wraps the whole `/admin` subtree (see the routing table). Behaviour:
  while the startup session restore runs → loader (`Restoring session…`);
  unauthenticated → `/login` with `location.state.from` preserved;
  authenticated but `user?.is_staff !== true` → an access-denied `EmptyState`
  ("Admin access required" + Back to games) — the admin UI is never rendered.
  The flag check is `=== true`, so a missing/malformed `is_staff` fails closed.
- This is **UX-only gating**: every admin write is enforced server-side by
  `IsAdmin`/`IsAdminOrReadOnly` (`user.is_staff`, verified in Phase 09) and
  surfaces as a recoverable 403 when the server denies it. `AdminLayout` nav
  shows the `Admin` link only for `user?.is_staff === true`.

### Modules (navigation-only dashboard)

- `AdminDashboard` (`/admin`) — cards linking to the two supported modules
  plus a muted note listing what the API cannot do. **No API calls and no
  fabricated metrics**: the backend has no dashboard/statistics summary
  endpoint (verified against source in Phase 09).
- `AdminGames` (`/admin/games`) — list over `GET /games/` (staff see every
  status; search submitted on demand, supported `status` filter, server-side
  pagination). Row actions: Edit (→ `/admin/games/:slug/edit`), a reversible
  `PATCH /games/{id}/ {status}` toggle, and a two-step delete calling
  `DELETE /games/{id}/`. Failures are recoverable alerts: 409 (reviews
  reference the game) keeps the row; 403 renders the server message; 404 on
  delete reconciles the list.
- `AdminGameForm` — shared create (`/admin/games/new`) and edit page.
  Fields are exactly the verified writable payload: `name`, `slug`
  (optional, blank on create → omitted), `description`, `developer`,
  `publisher`, `release_date`, `cover_image`, `status`, `category_id`
  (numeric). Client validation mirrors backend rules; server field errors
  (`errors.slug`, …) render inline. Edit loads the game by **slug**
  (`GET /games/{slug}/`) and patches by **numeric id** (`PATCH /games/{id}/`).
- `AdminCategories` (`/admin/categories`) — `GET /categories/` list with a
  create panel above (remounted after success), inline row editing
  (`PATCH /categories/{id}/`), two-step delete. `POST /categories/` sends
  `{name}` only (slug omitted unless explicitly typed); 409 (games reference
  the category) renders a recoverable alert, 404 reconciles the list.

### Decisions & limitations (backend-verified)

- **No review moderation module**: the backend has no global cross-game
  review list endpoint. Staff can already delete any review from the game
  detail page (Phase 08 `is_staff` controls); a moderation queue is not
  implementable against the current API and is documented rather than faked.
- **No user management**: `/auth/*` exposes only
  register/login/refresh/logout/me — no user list/role endpoints exist.
- **No dashboard metrics**: no summary/statistics endpoint exists, so the
  dashboard renders navigation only (no invented counts or charts).
- Admin list fetches use the shared keyed-result + `AbortController` pattern
  (stale responses dropped, loading/error derived from the result key) and
  reuse the existing wrappers in `src/api/games.js` (JSDoc updated with the
  verified request/response contracts).

## Comments & Favorites (Phase 10)

### Comment panel (`src/components/comments/`)

- `ReviewComments` is rendered by `ReviewCard` through an optional `children`
  slot (`.review-card__comments`), so each review carries its own panel —
  collapsed by default: **no comment request happens until the panel is
  expanded**, keeping a listing of N reviews at zero comment cost. The toggle
  exposes `aria-expanded`/`aria-controls` (`useId`).
- The list uses the shared keyed-result + `AbortController` pattern
  (`key = reviewId|page|reloadKey`): effects only set state from async
  callbacks, responses arriving after `signal.aborted` are dropped, and
  loading/error are derived by comparing result keys. Every mutation
  (create/edit/delete) triggers a refresh of the same keyed fetch.
- Endpoints (docs/API.md — Comment API): `GET|POST /reviews/{id}/comments/`
  (paginated `page_size=12`, newest first), `PATCH|DELETE /comments/{id}/`.
  A comment failure renders a recoverable **Couldn't load comments** error
  inside the panel only — the game and its reviews are never affected.
- `CommentForm` mirrors `ReviewForm`: single `content` field, client
  validation matching the backend (trimmed non-blank → "Write a comment."),
  server field errors (`errors.content`) inline, general `ApiError.message`
  as a form-level alert, submit disabled while pending, input kept on
  failure and cleared on success (edit mode unmounts the form).
- `CommentItem` renders the verified payload only (`content`,
  `author {id, first_name, last_name}`, `created_at`/`updated_at`); an
  `updated_at !== created_at` shows a static "(edited)" marker. Edit/Delete
  render only when the parent passes them — the parent computes ownership as
  `user.is_staff || comment.author.id === user.id` (server `IsAdminOrOwner`
  is authoritative). Delete is a two-step inline confirmation; failures
  render a recoverable **Comment action failed** alert and restore the idle
  controls, while a 404 silently reconciles (refresh, no error).
- Signed out → the public list still renders with a "Log in to comment."
  prompt linking to `/login` with `state.from` preserved; there is no form.

### Favorites (`src/contexts/FavoritesContext.jsx`, `src/components/favorites/FavoriteToggle.jsx`, `src/pages/Favorites.jsx`)

- **Why a shared set:** the backend exposes **no** favorite-status field on
  the public game serializer and no single-game status endpoint — the only
  source is `GET /me/favorites/`. `FavoritesProvider` (mounted inside
  `AuthProvider` in `AppRoutes`) loads that list once per session (all pages,
  `page_size=100` = backend max) and keeps a slug `Set`, so `/games`,
  `/games/:slug` and `/favorites` stay consistent without a state library
  and without per-card request waterfalls.
- Load failures are **silent by design**: the toggle stays usable and the
  server's `409` on add reconciles a wrong "not favorited" state (delete is
  idempotent). Mutations resolve only after server confirmation (no
  optimistic UI); ops issued while the initial load is in flight are
  replayed over its result, and a synchronous `pendingRef` drops duplicate
  requests per slug. `useFavorites()` throws outside the provider.
- `FavoriteToggle` is shared by the listing card (via GameCard's
  `.game-card__action` slot, layered above the stretched link), the detail
  header and the favorites page. Signed out → "Log in to favorite" link
  preserving `state.from`; signed in → "Add to favorites"/"Remove from
  favorites" button (`loading` while pending) with an inline recoverable
  error. A `409` on add is treated as success (label flips, no alert); an
  optional `onChanged(favorited)` callback lets the favorites page refresh.
- `GET /me/favorites/` items carry a reduced game payload
  (`id, name, slug, cover_image, release_date, status, category` — **no
  `developer`/`description`**): `GameCard` now hides those lines when the
  fields are absent instead of inventing "unknown" text (present-but-empty
  values keep the explicit fallbacks).
- The `/favorites` page is a full keyed-fetch page: loader → retryable error
  → 404 past the last page (backend returns 404 out of range) with **Back to
  first page** → empty state with a **Browse games** link → card grid +
  count + `Pagination`. Rows reuse `GameCard` + `FavoriteToggle`; removing
  confirms with the `DELETE` first, then refreshes this list and the shared
  set, so all three surfaces stay consistent.

### Decisions & limitations (backend-verified)

- **No per-game status endpoint** → status is derived from the single
  `/me/favorites/` set (documented above); no other endpoint was invented.
- **No `is_favorited` on game detail** → the detail toggle reflects the same
  shared set; a silent load failure degrades to "not yet known" until the
  first mutation reconciles it.
- Comment/favorite identity, ownership and duplicates are enforced
  server-side (`IsAuthenticatedOrReadOnly`, `IsAdminOrOwner`, 409 on
  duplicate favorite); the client mirrors rules for UX only.

## Conventions

- Pages compose `PageContainer` + `Input`/`Button` + `Loading` /
  `ErrorMessage` / `EmptyState`; forms use controlled inputs with
  `noValidate` and render `ErrorMessage` (role `alert`) plus per-field errors.
- Placeholder pages are explicitly badged — they must never be mistaken for
  finished features.
- Endpoint wrappers in `src/api/*.js` stay thin and are justified by
  documented endpoints; `src/types/index.js` mirrors only fields the API
  actually returns (no invented fields such as `average_rating`).
- Accessible markup: labelled inputs, `aria-invalid`/`aria-describedby` on
  errors, `aria-busy` on loading buttons, `aria-live` nav landmarks.
