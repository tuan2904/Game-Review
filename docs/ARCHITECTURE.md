# Architecture

GameReview backend follows a pragmatic Django/DRF architecture. Layers exist to
separate concerns, not to satisfy a pattern — every endpoint gets only the layers
it actually needs.

## Request Flow

```text
HTTP Request
    ↓
URL (config/urls.py → app urls.py)
    ↓
View / API Controller        # HTTP, auth context, serializer, calling services
    ↓
Serializer                   # input validation, output serialization
    ↓
Service                      # business rules, transactions, orchestration  (only if needed)
    ↓
Repository                   # reusable/complex data access                (only if needed)
    ↓
Django ORM
    ↓
PostgreSQL
```

Pragmatic rule: the health endpoint is `Request → View`. A simple read may be
`View → Serializer → ORM`. Auth endpoints are `View → Serializer → SimpleJWT`
(plus ORM for registration). Introduce Service/Repository only when there is
real business or data-access logic to separate.

## Layer Responsibilities

### View (`views.py`)

Handles: HTTP request/response, authentication context, invoking serializers,
calling service/application logic.

- Must stay thin — a view method should read like a short script.
- No business rules, no multi-step orchestration, no scattered ORM queries.
- Sets presentation options (`success_message` for paginated lists).

### Serializer (`serializers.py`)

Handles: request validation, response serialization, field-level validation.

- Not a service class — no complex database orchestration inside serializers.
- Field validators and simple cross-field checks belong here; multi-model
  business rules do not.

### Service (`services.py`)

Handles: business rules, transaction boundaries, orchestration, enforcing
invariants (e.g. "one review per user per game").

- Create a service when an operation spans multiple models, needs a transaction,
  or encodes a business rule.
- Do NOT create a service class merely because an endpoint exists.
- Services raise `AppException` subclasses (see Error Handling) instead of
  building HTTP responses.

### Repository (`repositories.py`)

Handles: complex queries, reusable query operations, query composition,
isolating hairy ORM logic.

- Do NOT wrap trivial access (`Model.objects.get(pk=pk)`) — direct ORM calls in
  a service are fine when simple.
- Repositories return querysets/model instances, never `Response` objects.

### Model (`models.py`)

Handles: schema, relationships, constraints, model-level invariants, small
domain behaviors where they naturally fit.

- Database constraints express real business invariants
  (`UNIQUE(user_id, game_id)`, etc.).
- No model method for every operation — keep behavior where it is used.

## Common Infrastructure (`apps/common/`)

| File            | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `responses.py`  | Standard success/error envelope builders                           |
| `exceptions.py` | `AppException` hierarchy + global DRF exception handler            |
| `pagination.py` | Page-number pagination returning the standard envelope             |
| `filters.py`    | `ListQueryMixin` — search / ordering / allowlisted field filtering |
| `permissions.py`| `IsAdmin`, `IsAdminOrReadOnly`, `IsOwner`, `IsAdminOrOwner`     |
| `serializers.py`| `SafeUserSerializer` — shared safe author fields (`id`, `first_name`, `last_name`) used by Review and Comment |
| `views.py`      | Health endpoint + JSON 404/500 handlers for `/api/` paths          |
| `urls.py`       | Common endpoints mounted at `/api/v1/`                             |

Rule: reuse infrastructure that repeats across modules; keep domain models
explicit. Never build `GameFilter`/`MovieFilter` duplicates — configure
`ListQueryMixin` instead.

## Error Handling

All API errors go through one handler
(`REST_FRAMEWORK["EXCEPTION_HANDLER"] = apps.common.exceptions.api_exception_handler`):

```text
AppException subclasses      → their status_code + message + errors
DRF APIException             → status + detail (validation → field errors)
Django Http404 / PermissionDenied → 404 / 403
anything else                → logged, generic 500 (never exposed)
```

Application exception hierarchy (raise these in services):

```text
AppException            (400)  base class
├── BusinessException   (400)  business rule violated
├── PermissionException (403)  application-level permission denial
├── ResourceNotFoundException (404)
└── ConflictException   (409)  duplicate/conflict (e.g. IntegrityError mapped by the service)
```

Never expose stack traces, SQL, credentials, or internal details in responses.
Details go to logs only (`logger.exception` / `logger.error`).

Database integrity errors: catch `IntegrityError` where a conflict is an
expected outcome and raise `ConflictException` (or a field error — registration
maps its unique-email race to a 400 email error in the serializer) — do not map
all integrity errors globally (most are bugs and deserve a 500).

Unknown URLs: `/api/*` paths return a JSON 404 envelope (when `DEBUG=False`);
other paths (e.g. Django admin) keep Django's HTML error pages.

## Pagination

`apps.common.pagination.DefaultPagination` (page-number based):

- Query params: `page`, `page_size` (default 12, max 100).
- Out-of-range page → 404 envelope.
- Response is wrapped in the standard envelope with
  `data.items` + `data.pagination` (see `docs/API.md`).
- Views may set `success_message` to customize the envelope message.

## Filtering / Search / Ordering Convention

List endpoints use `ListQueryMixin` (mixin first in bases):

```python
class GameListView(ListQueryMixin, ListAPIView):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    search_fields = ["name", "developer"]          # ?search=elden
    ordering_fields = ["name", "release_date"]     # allowlist for ?ordering=
    ordering = "-created_at"                       # default sort — always set this
    filter_fields = {"category": "category__slug"} # ?category=rpg
```

- Search/ordering are DRF's `SearchFilter`/`OrderingFilter` (no custom engine).
- `filter_fields` is an **allowlist** — unknown query params are ignored, so
  clients can never filter on arbitrary columns.
- Invalid `?ordering=` values are ignored (fall back to the default ordering).

## Permissions Foundation

| Class            | Meaning                                                        |
| ---------------- | -------------------------------------------------------------- |
| `IsAuthenticated`| DRF default for write endpoints (global default: `IsAuthenticatedOrReadOnly`) |
| `IsAdmin`        | `is_staff` users only                                          |
| `IsAdminOrReadOnly` | reads are public; writes require `is_staff` (composes `IsAdmin`) — used by the Game/Category module; anonymous writes → 401, non-admin → 403 |
| `IsOwner`        | owner of the object; **owner = `obj.user`**                    |
| `IsAdminOrOwner` | admins, or the object's owner — used by Review update/delete   |

- Object-level permissions require `self.check_object_permissions(request, obj)`
  in the view.
- Domain-specific permissions (e.g. "review moderation") belong in the owning
  module's `permissions.py` when those phases arrive.

## Authentication (JWT)

Implemented in `apps/accounts/` on top of `djangorestframework-simplejwt` —
framework-native, no custom token code:

- Access token: 30 min, sent as `Authorization: Bearer <token>`. Refresh
  token: 7 days, rotated on every `/auth/refresh/` with the presented token
  blacklisted immediately (`rest_framework_simplejwt.token_blacklist`).
  `/auth/logout/` blacklists the refresh token the same way.
- Flow for auth endpoints: `View → Serializer → SimpleJWT / ORM`. **No service
  layer**: issuing/verifying tokens is framework work and registration is a
  single validated write — a service would be a pass-through (plan rule:
  layers only when there is real logic to separate).
- `register/login/refresh/logout` are public (`AllowAny`); `/auth/me/` is
  `IsAuthenticated` for both `GET` (read) and `PATCH` (profile update — only
  `first_name`/`last_name` are writable, so `email`/staff flags are
  unreachable from the payload). The login serializer keeps SimpleJWT's token
  issuing and only adds safe user data plus a generic failure message.
- User administration is staff-only: `GET /admin/users/` (search + pagination,
  safe fields only) and `POST /admin/users/{id}/status/` (lock/unlock via
  `is_active`, `IsAdmin`). Locking takes effect immediately — the JWT auth
  class rejects deactivated users with `401` on every later request.
- Failed login (wrong password, unknown email, or inactive account) always
  returns the same `401 "Invalid email or password"` — no account
  enumeration. Duplicate email → `400` field error, backstopped by the
  model's `UNIQUE(email)` constraint.
- User identity is email (`USERNAME_FIELD = "email"`, no username field);
  `UserManager` normalizes to lowercase and is the only password-hashing
  entry point (`create_user`/`create_superuser`).
- Rate limiting uses **scoped** DRF throttles (`login` `10/min`, `register`
  `5/min`, env-overridable) applied only to those two views — no global
  `DEFAULT_THROTTLE_CLASSES`.

## Game & Category Conventions

First domain module (`apps/games/`) — flow is `View → Serializer → ORM`, no
service/repository layer (single-model CRUD with no cross-model business
orchestration):

- **Slug convention:** created once from `name` via `slugify`; collisions get
  `-2`, `-3` suffixes (`generate_unique_slug` in `serializers.py` — one small
  helper, not a framework). Renames never change the slug implicitly; send
  `slug` explicitly to change it (unique re-checked). Purely numeric slugs are
  rejected so `/games/{id}/` (admin PATCH/DELETE, registered **before**
  `/games/{slug}/`) can never be ambiguous.
- **Status / visibility:** `Game.status` ∈ `ACTIVE | INACTIVE` (default
  `ACTIVE`), enforced by model `choices`, a DRF `ChoiceField`, and a DB
  `CheckConstraint` (`game_status_valid`). Public readers only ever see
  `ACTIVE` games — one rule in `GameManager.visible_to(user)` used by both
  list and detail views; staff see everything.
- **Relationship:** `Game.category` is `ForeignKey(on_delete=PROTECT)` —
  deleting a referenced category raises `ProtectedError`, mapped to a safe
  `409` in the view. Never null/delete silently.
- **Game deletion:** hard delete; `INACTIVE` is the soft lifecycle control.
  `Review.game` is `ForeignKey(on_delete=PROTECT)`, so deleting a game that
  has reviews raises `ProtectedError`, mapped to a safe
  `409 "Cannot delete game while reviews reference it."` in the view —
  the same pattern as category deletion.
- **Indexes:** unique columns and the FK are indexed automatically
  (Postgres/Django); no extra indexes added at MVP scale — revisit with
  measured hotspots (no-premature-optimization rule).
- Writes are wrapped in the standard envelope by explicit view overrides
  (`create`/`update`/`destroy` return `success_response(...)`); list
  responses get the envelope from `DefaultPagination`. `DELETE` returns
  **200 + envelope**, never `204`.

## Review Conventions

Second domain module (`apps/reviews/`) — same `View → Serializer → ORM` flow
(no service/repository layer): one model, and the only cross-model rule
(one review per user per game) is enforced by the database, not by an
application service.

- **Model:** `Review` has `game` and `user` FKs, both `on_delete=PROTECT`
  (a review never silently disappears with its game or author), `rating`
  (`PositiveSmallIntegerField` + DB `CheckConstraint` `review_rating_range`
  1–5), free-text `content`, timestamps.
- **Invariant:** `UNIQUE(user, game)` (`unique_review_per_user_per_game`).
  The serializer wraps `create()` in `transaction.atomic()` and maps the
  race-window `IntegrityError` to `409 ConflictException` — the savepoint
  keeps the surrounding transaction usable.
- **Visibility:** review reads/writes resolve the game through
  `Game.objects.visible_to(user)`, so inactive games behave exactly like the
  Game module (404 for non-staff). Staff may review inactive games.
- **Author exposure:** nested as `{id, first_name, last_name}` only —
  never `email` (privacy). Game is nested as `{id, slug, name}`.
- **Read-only edges:** `user`, `game`, `id`, `created_at`, `updated_at` are
  read-only; identity comes from the token, the game from the URL, so forged
  IDs in payloads are ignored.
- **Aggregation without denormalized columns (Phase D):** `Game` still has no
  `average_rating` / `review_count` columns — read querysets annotate them
  via `with_review_stats()` (`Avg` + `Count` in a **single** `annotate()` so
  both share one join and a page stays one query). Values are therefore
  always current and the write path keeps no bookkeeping. The serializer
  declares both fields read-only with safe defaults (`null` / `0`) so a
  response built from a non-annotated instance (a freshly created game)
  cannot fail.
- **Review ordering (Phase D):** the review list is sortable server-side
  (`ordering_fields = ["created_at", "rating"]`, default `-created_at`),
  allowlisted through DRF's `OrderingFilter` (no review search), with an
  implicit `id` tie-break so equal ratings paginate deterministically.
- **Permissions:** list/create rely on the global
  `IsAuthenticatedOrReadOnly` (reads public, create 401 when anonymous);
  update/delete use `IsAdminOrOwner` (owner or `is_staff`).
- **Routing:** `games/{slug}/reviews/` (list+create) and `reviews/{id}/`
  (PATCH/DELETE) — segment counts differ, so they never collide with the
  Game routes.
- Envelope overrides mirror the Game module: 201 for create, 200 for
  update/delete (no `204`), pagination envelope for lists.

## Comment & Favorite Conventions

Phase 05 modules (`apps/comments/`, `apps/favorites/`) — both stay
`View → Serializer → ORM`; neither needs a service layer because every rule
is either a DB constraint or a single scoped query:

- **Comment model:** `review` + `user` FKs, both `on_delete=PROTECT`
  (comments survive neither game cleanup nor account removal silently).
  `content` is a `TextField` with a DB `CheckConstraint`
  `comment_content_not_blank` (`NOT content ~ '^\s*$'`) so whitespace-only
  comments are impossible even outside the API; the serializer's `CharField`
  rejects them first with a friendly `400`. No nested replies; no extra
  indexes beyond the automatic FK indexes (list queries filter on the
  `review_id` index and sort a single review's small comment set — revisit
  only with measured need).
- **Comment visibility:** list/create resolve the review through
  `Review.objects.filter(game__in=Game.objects.visible_to(user))` — a
  comment inherits its game's visibility exactly (inactive → 404 for
  non-staff, staff allowed). Unknown review → 404.
- **Comment ownership:** `author` (via `SafeUserSerializer`) and `review`
  are read-only; the view supplies `user=request.user` and
  `review=URL kwargs` in `perform_create`, so forged `user_id`/`review_id`
  payload keys are ignored. Update/delete reuse `IsAdminOrOwner` — no
  duplicated ownership logic (owner or `is_staff`).
- **Favorite model:** `user` + `game` FKs, both `PROTECT`, `created_at`
  only (no `updated_at`, no soft delete, no history), and
  `UNIQUE(user, game)` (`unique_favorite_per_user_per_game`).
- **Duplicate favorite:** no pre-check — `FavoriteSerializer.create()`
  wraps the insert in `transaction.atomic()` and maps the constraint
  `IntegrityError` to `409 ConflictException`
  ("You have already favorited this game."), so a duplicate request and a
  concurrency race return the identical clean response (never a raw DB
  error).
- **Favorite scoping:** every favorite read/write is
  `filter(user=request.user, ...)`; the user identity never comes from
  payload or query params. `DELETE /games/{slug}/favorite/` is
  **idempotent** (200 whether or not a row existed — documented), scoped to
  the caller so another user's favorite is untouched.
- **Favorite visibility:** add/remove/list resolve the game through
  `Game.objects.visible_to(user)` — unknown/inactive slug → 404 for
  non-staff; the list also filters `game__in=visible_to(user)` so favorites
  of later-deactivated games disappear for their owner (staff still see
  them).
- **Safe game shape:** favorites serialize the game as
  `{id, name, slug, cover_image, release_date, status, category}` (category
  nested `{id, name, slug}`) via `select_related("game", "game__category")`.
- **Routing:** `reviews/{id}/comments/`, `comments/{id}/`,
  `games/{slug}/favorite/`, `me/favorites/` — segment counts and prefixes
  differ from existing routes, so no collisions.

## Report & Moderation Conventions (Phase 11E)

`apps/reports/` is a regular domain app (`View → Serializer → ORM`, no
service layer — every rule is a DB constraint or one scoped query), and the
staff moderation lists reuse `ListQueryMixin` like every other list:

- **Report model — exactly one target:** `review` XOR `comment`, enforced
  by the DB `CheckConstraint` `report_exactly_one_target` (last line of
  defence behind the view, which always constructs the row with one target).
  Two conditional `UniqueConstraint`s (`reporter+review`,
  `reporter+comment`) make duplicate reporting impossible even under races —
  the create path wraps `Report.objects.create` in `transaction.atomic()` and
  maps `IntegrityError` to `409` (same pattern as the
  one-review-per-game rule). FK policy: `reporter` `PROTECT` (reports never
  outlive their author silently), both targets `CASCADE` (deleting the
  content deletes its reports), `resolved_by` `SET_NULL`.
- **Report creation is URL-scoped:** the target comes from the path and is
  visibility-checked with `Game.objects.visible_to(user)` (reviews) plus
  `is_hidden=False` for non-staff (comments); the body carries only
  `reason` (choices) and optional `details` (≤ 500), so client-supplied
  `reporter`/`status` fields are ignored rather than trusted.
- **Moderation lists:** `ReportListView`, `AdminReviewListView` and
  `AdminCommentListView` all mix in `ListQueryMixin` (search + ordering
  allowlists) behind `IsAdmin`; comment `?is_hidden=` normalization is one
  shared helper (`apply_hidden_filter` in `apps/comments/views.py`) used by
  both the per-review list (Phase B) and the global queue (Phase E), and an
  unrecognized value yields an **empty** list instead of dropping the
  filter — a typo must never widen a moderation view.
- **Summary:** `AdminSummaryView` (`apps/common/views.py`) issues one
  `aggregate()` per model using `Count("pk", filter=Q(...))` for the
  splits — 7 count queries in a single request. Counts are always live: no
  cached totals, consistent with the no-denormalization stance of Phase D.
- **Resolution:** the staff-only transition `PENDING → RESOLVED` stamps
  `resolved_by` + `resolved_at`; a repeat resolve is `409` (explicit state,
  not silently idempotent).
- **Routing:** `reviews/{id}/report/`, `comments/{id}/report/`,
  `admin/reports/`, `admin/reports/{id}/resolve/` (in `apps/reports/urls.py`)
  plus `admin/reviews/`, `admin/comments/` and `admin/summary/` on the
  owning apps — all under the existing `/api/v1/` prefix; no collisions.

## Transactions Convention

- Use `transaction.atomic()` when a business operation performs **multiple
  related writes** that must succeed or fail together, or when a constraint
  violation is an expected outcome that must be caught cleanly (e.g.
  `ReviewSerializer.create()` uses a savepoint so a duplicate review surfaces
  as a 409 instead of poisoning the transaction).
- Single-write operations do not need an explicit transaction (ORM already
  wraps each write).
- Do not wrap every query in `atomic()` — it adds overhead and hides design
  problems.
- Services are the transaction boundary, not views.

## ORM / Query Conventions

- Prefer the Django ORM; raw SQL only with a demonstrated need.
- Prevent N+1: `select_related()` for to-one joins, `prefetch_related()` for
  to-many; annotate aggregates (`Avg`, `Count`) instead of looping in Python.
- Filter and paginate at the database level (pagination does this by default).
- Always set an explicit `ordering` on paginated lists — unstable ordering can
  skip or duplicate rows across pages. When a sort key has many equal values
  (e.g. rating), append a unique tie-break (`id`) after the chosen field.
- Avoid loading full tables to filter in Python.
- Do not prematurely optimize; fix confirmed hotspots.

## Logging

- Console handler, format: `{asctime} {levelname} {name} {message}`.
- Level via `DJANGO_LOG_LEVEL` (default `INFO`) — see `.env.example`.
- Use `logger.exception` for unexpected errors (full traceback in logs),
  `logger.error` for operational failures (e.g. DB down in health check).
- Never log passwords, JWT tokens, secrets, or raw tokens.

## Configuration & CORS

- All secrets/config come from environment variables (`.env` is gitignored;
  `.env.example` holds safe placeholders).
- CORS is restricted to explicit origins (`CORS_ALLOWED_ORIGINS`, default
  `http://localhost:5173`). Never `CORS_ALLOW_ALL_ORIGINS = True`.
- API version: all endpoints live under `/api/v1/` — a single version only.

## Testing Conventions

- pytest + pytest-django, PostgreSQL test database (`python -m pytest` from
  `backend/`; config in `backend/pyproject.toml`). The suite needs a reachable
  database — set `DB_PORT` (and other `DB_*` vars) via the environment to
  override `backend/.env` when needed.
- All shared fixtures (`api_client`, `user_client`/`other_client`/`admin_client`,
  `make_user`/`user`/`other_user`/`admin`, `make_category`/`category`,
  `make_game`/`game`, `make_review`/`review`, `make_comment`, `make_favorite`)
  live in `backend/conftest.py`; an autouse fixture clears the DRF throttle
  cache between tests. Tests are grouped per app under `apps/<app>/tests/`.
- Tests verify behavior through the request → response cycle against the real
  versioned API (`/api/v1/…`) using DRF's `APIClient`, not private method calls.
- Auth throttling is scoped per view (not global): `login` defaults to `10/min`
  and `register` to `5/min`, overridable with `AUTH_LOGIN_THROTTLE_RATE` /
  `AUTH_REGISTER_THROTTLE_RATE`. `apps/accounts/tests/test_throttling.py`
  asserts the 429 response.
- Service-level business behavior (later phases) may be tested by calling the
  service directly when that is clearer.
- Cover reusable infrastructure and important business rules; do not chase
  100% coverage.
