# API

Base URL: `http://localhost:8000/api/v1`

All endpoints are versioned under `/api/v1/`. Only one API version exists.

## Response Format

Every response (success or error) uses the same envelope.

Success:

```json
{
  "success": true,
  "message": "Game retrieved successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {}
}
```

- `data` holds the payload for success responses (`{}` when there is none).
- `errors` holds field-level details for validation failures
  (`{"name": ["Ensure this field has no more than 5 characters."]}`), otherwise
  `{}`.
- Stack traces, SQL, and internal details are never returned; details are
  logged server-side only.

## Status Codes

| Status | Meaning                                              | Example `message`                       |
| ------ | ---------------------------------------------------- | --------------------------------------- |
| 200    | OK                                                   | `Request successful`                    |
| 400    | Validation / business error                          | `Validation failed`                     |
| 401    | Not authenticated                                    | `Authentication credentials were not provided.` |
| 403    | Authenticated but not allowed                        | `Admin privileges required.`            |
| 404    | Resource or route not found                          | `Not found`                             |
| 405    | HTTP method not allowed                              | `Method "POST" not allowed.`            |
| 409    | Conflict (duplicate resource)                        | `Resource already exists`               |
| 500    | Unexpected server error (generic, never detailed)    | `Internal server error`                 |
| 503    | Service unavailable (e.g. database down)             | `Service unavailable`                   |

Application errors raised by services map as:
`BusinessException` → 400, `PermissionException` → 403,
`ResourceNotFoundException` → 404, `ConflictException` → 409.

Unknown URLs under `/api/` return a JSON 404 envelope when `DEBUG=False`
(Django's debug/HTML pages apply outside the API prefix or in development).

## Health Check

```http
GET /api/v1/health/
```

No authentication required. Checks application availability plus a lightweight
database ping (`SELECT 1`).

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": { "status": "ok", "database": "ok" }
}
```

Database unreachable → `503` with `"message": "Service unavailable"`.

## Pagination

List endpoints are paginated with page-number pagination.

Request parameters:

| Param       | Default | Max | Description                 |
| ----------- | ------- | --- | --------------------------- |
| `page`      | 1       | —   | Page number (1-based)       |
| `page_size` | 12      | 100 | Items per page              |

```http
GET /api/v1/games/?page=2&page_size=20
```

Response:

```json
{
  "success": true,
  "message": "Games retrieved successfully",
  "data": {
    "items": [],
    "pagination": {
      "page": 2,
      "page_size": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

- `page` beyond the last page → `404`.
- Invalid `page_size` falls back to the default; values above 100 are capped.
- Views set `success_message` to customize `message`.

## Search, Filtering, Ordering

Convention for list endpoints (configurable per module, see
`ListQueryMixin` in `docs/ARCHITECTURE.md`):

```http
GET /api/v1/games/?search=elden
GET /api/v1/games/?category=rpg
GET /api/v1/games/?ordering=-release_date
GET /api/v1/games/?search=rpg&ordering=name&page=2
```

- `search` — full-text-ish match over the view's `search_fields`
  (case-insensitive contains).
- `ordering` — comma-separated fields; prefix `-` for descending. Fields must
  be allowlisted (`ordering_fields`); invalid values are ignored and the
  default ordering applies.
- Domain filters (e.g. `category`) are **allowlisted** query parameters mapped
  to ORM lookups (`filter_fields`); unknown parameters are ignored.
- Sorting/filtering happen in the database; no external search infrastructure.

## Authentication

JWT-based authentication (`djangorestframework-simplejwt`). Send the access
token as:

```http
Authorization: Bearer <access_token>
```

| Token   | Lifetime | Behaviour                                              |
| ------- | -------- | ------------------------------------------------------ |
| Access  | 30 min   | Used on every protected request. Not refreshed itself. |
| Refresh | 7 days   | Rotated on every `/auth/refresh/`; old one is blacklisted. |

No server-side sessions: revocation happens by rotating/blacklisting refresh
tokens (`rest_framework_simplejwt.token_blacklist`).

### Register

```http
POST /api/v1/auth/register/
Content-Type: application/json

{
  "email": "player@example.com",
  "password": "Str0ngPass!9x",
  "first_name": "Ada",
  "last_name": "Lovelace"
}
```

- `201 Registration successful` → `data` contains the safe user fields
  (`id`, `email`, `first_name`, `last_name`, `is_staff`). No tokens are issued
  here; login is a separate step.
- `email` is required, normalized to lowercase, and must be unique.
- Duplicate email → `400` with `errors.email`
  (`"A user with this email already exists."`).
- Weak password → `400` with `errors.password` (Django password validators:
  minimum length, common/numeric passwords, similarity to user attributes).
- `is_staff` / `is_superuser` in the payload are ignored; users can never
  self-register as staff.

### Login

```http
POST /api/v1/auth/login/

{ "email": "player@example.com", "password": "Str0ngPass!9x" }
```

- `200 Login successful` → `data`:

  ```json
  {
    "access": "<jwt>",
    "refresh": "<jwt>",
    "user": { "id": 1, "email": "player@example.com", "first_name": "Ada", "last_name": "Lovelace", "is_staff": false }
  }
  ```

- `401` with message `"Invalid email or password"` for wrong password,
  unknown email, and inactive accounts — the same generic message for all
  three, so account existence is never revealed. `data` is absent; `errors` is
  `{}`.
- Missing field → `400` with field-level `errors`.

### Refresh

```http
POST /api/v1/auth/refresh/

{ "refresh": "<refresh_token>" }
```

- `200 Token refreshed successfully` → `data` has a new `access` **and** a new
  `refresh` (rotation). The presented refresh token is blacklisted
  immediately; reusing it later → `401`.
- Invalid/expired/blacklisted/missing token → `401` / `400` respectively.

### Logout

```http
POST /api/v1/auth/logout/

{ "refresh": "<refresh_token>" }
```

- `200 Logout successful` — blacklists the refresh token so it can never be
  exchanged again. Public endpoint (the refresh token itself is the
  credential).
- Invalid or already-used token → `401`. Missing field → `400`.

### Current user

```http
GET /api/v1/auth/me/
Authorization: Bearer <access_token>
```

- `200 User retrieved successfully` → safe user fields only; never passwords
  or tokens.
- No token → `401` `"Authentication credentials were not provided."`
- Invalid or expired token → `401`.

### Update current user (profile)

```http
PATCH /api/v1/auth/me/
Authorization: Bearer <access_token>

{ "first_name": "Ada", "last_name": "Lovelace" }
```

- `200 Profile updated successfully` → the updated safe user.
- Only `first_name` / `last_name` are writable (both optional, partial update).
  `email`, `is_staff`, `is_superuser` and `is_active` are **read-only** — a
  crafted payload can never change them (no privilege escalation).
- Values longer than 150 characters → `400` with
  `errors.first_name` / `errors.last_name`.
- No token → `401`.

## Game API

### List games (public)

```http
GET /api/v1/games/
GET /api/v1/games/?search=elden
GET /api/v1/games/?category=action-rpg
GET /api/v1/games/?status=ACTIVE
GET /api/v1/games/?ordering=-release_date
GET /api/v1/games/?page=2&page_size=20
```

Query parameters (all allowlisted; unknown parameters are ignored):

| Param     | Values                                                        |
| --------- | ------------------------------------------------------------- |
| `search`  | matches `name`, `description`, `developer`, `publisher`        |
| `category`| category **slug** (e.g. `action-rpg`); unknown slug → empty    |
| `status`  | `ACTIVE` or `INACTIVE` (invalid value → empty, never an error) |
| `ordering`| `name`, `release_date`, `created_at` and their `-` forms; anything else is ignored (default `-created_at`) |
| `page`, `page_size` | standard pagination (default 12, max 100)          |

- **Visibility:** non-staff requests only ever see `ACTIVE` games — including
  when they pass `?status=INACTIVE` (the result is empty). Staff see all
  statuses, and `?status=` is meaningful for them.
- `200 Games retrieved successfully` with `data.items` +
  `data.pagination`; each item contains
  `id, name, slug, description, developer, publisher, release_date,
  cover_image, status, category, average_rating, review_count,
  created_at, updated_at` where `category` is the nested object
  `{id, name, slug}`.
- **Rating aggregates:** `average_rating` is the mean of all the game's
  review ratings (`null` when there are none) and `review_count` is how many
  reviews it has (`0` when there are none). Both are computed inside the list
  query (one `annotate()` — no N+1, no extra query per row).
- `page` beyond the last page → `404`.

### Game detail (public)

```http
GET /api/v1/games/{slug}/
```

- `200 Game retrieved successfully` — same fields as list items, including
  the `average_rating` / `review_count` aggregates (always current: they are
  computed from the reviews table on every read).
- Unknown slug (or an `INACTIVE` game viewed by non-staff) → `404`.
- Slugs cannot be purely numeric (they would clash with the numeric
  `/games/{id}/` admin routes), so `{slug}` and `{id}` never collide.

### Create game (admin)

```http
POST /api/v1/games/

{
  "name": "Elden Ring",
  "description": "Open-world action RPG.",
  "developer": "FromSoftware",
  "publisher": "Bandai Namco",
  "release_date": "2022-02-25",
  "cover_image": "https://example.com/elden-ring.jpg",
  "status": "ACTIVE",
  "category_id": 1
}
```

- Requires admin (`is_staff`): anonymous → `401`, authenticated non-admin →
  `403`.
- `201 Game created successfully`.
- Required: `name`, `description`, `developer`, `publisher`, `release_date`,
  `category_id`. Optional: `slug` (auto-generated from `name`; collisions get
  `-2`, `-3`, … suffixes), `cover_image` (URL), `status` (default `ACTIVE`).
- Server-controlled fields (`id`, `created_at`, `updated_at`) are read-only
  and ignored if sent.
- The response carries the aggregates too: a brand-new game reports
  `average_rating: null` and `review_count: 0`.
- Invalid category id / date / status / URL, duplicate slug, or numeric slug
  → `400` with field-level `errors`.

### Update game (admin)

```http
PATCH /api/v1/games/{id}/

{ "status": "INACTIVE" }
```

- Partial update: only supplied fields change. `200 Game updated successfully`.
- The response includes the game's current `average_rating` / `review_count`.
- The slug is generated once at creation and does **not** change when you
  rename a game; send `slug` explicitly to change it (uniqueness re-checked).
- Unknown id → `404`; duplicate slug → `400`.

### Delete game (admin)

```http
DELETE /api/v1/games/{id}/
```

- `200` with envelope
  `{"success": true, "message": "Game deleted successfully", "data": {}}`
  (this project never uses `204` — every response carries the envelope).
- **Decision:** hard delete. `status=INACTIVE` is the soft lifecycle control
  for de-listing. The Review `game` FK uses `PROTECT`: a game with reviews
  cannot be deleted → **`409`**
  `"Cannot delete game while reviews reference it."`
- Unknown id → `404`.

## Category API

### List categories (public)

```http
GET /api/v1/categories/
```

- `200 Categories retrieved successfully`; items are exactly
  `{id, name, slug}`, ordered by `name`, standard pagination applies.

### Create category (admin)

```http
POST /api/v1/categories/

{ "name": "Action RPG" }
```

- `201 Category created successfully`; `slug` is auto-generated
  (`action-rpg`) unless provided explicitly (unique, URL-safe).
- Duplicate `name` or `slug` → `400`. Anonymous → `401`, non-admin → `403`.

### Update category (admin)

```http
PATCH /api/v1/categories/{id}/

{ "name": "..." }  and/or  { "slug": "..." }
```

- `200 Category updated successfully`. Renaming does not change the slug
  unless `slug` is sent explicitly. Game filtering by `?category=<slug>`
  always uses the current slug (games store the FK, not a copy of the slug).

### Delete category (admin)

```http
DELETE /api/v1/categories/{id}/
```

- Empty category → `200 Category deleted successfully` (envelope, no `204`).
- Category referenced by games → **`409`**
  `"Cannot delete category while games reference it."`
  (`on_delete=PROTECT`; the relationship is never silently destroyed).
- Unknown id → `404`.

## Review API

Reviews live under their game. A user may review each game **once**;
the relationship is protected from both sides (`PROTECT` on `game` and `user`).

### List reviews for a game (public)

```http
GET /api/v1/games/{slug}/reviews/
GET /api/v1/games/{slug}/reviews/?ordering=rating
GET /api/v1/games/{slug}/reviews/?page=2&page_size=20
```

Query parameters:

| Param     | Values                                                        |
| --------- | ------------------------------------------------------------- |
| `ordering`| `created_at`, `rating` and their `-` forms (default `-created_at` = newest first); anything else is ignored |
| `page`, `page_size` | standard pagination (default 12, max 100)          |

- `200 Reviews retrieved successfully` with standard pagination
  (`data.items` + `data.pagination`), ordered **newest first**
  (`-created_at`) unless `?ordering=` says otherwise. Sorting always ends
  with an implicit `id` tie-break, so equal ratings paginate deterministically
  (no duplicates/omissions across pages).
- There is no `?search=` on reviews — only `ordering` and pagination are
  honoured (unknown parameters are ignored, never an error).
- Each item:

  ```json
  {
    "id": 1,
    "rating": 4,
    "content": "Solid game with great bosses.",
    "author": { "id": 3, "first_name": "Ada", "last_name": "Lovelace" },
    "game": { "id": 1, "slug": "elden-ring", "name": "Elden Ring" },
    "created_at": "2026-10-09T10:00:00Z",
    "updated_at": "2026-10-09T10:00:00Z"
  }
  ```

- **Author safety:** only `id`, `first_name`, `last_name` are exposed —
  never `email`.
- Same visibility rules as games: an `INACTIVE` game's reviews are `404` for
  anonymous and non-staff requests; staff see them.
- Unknown game slug → `404`.

### Create review (authenticated)

```http
POST /api/v1/games/{slug}/reviews/
Authorization: Bearer <access_token>

{ "rating": 4, "content": "Solid game with great bosses." }
```

- `201 Review created successfully`; the response data is the serialized
  review (with nested `author` and `game`).
- Anonymous → `401`. The target game must be visible to the caller
  (inactive → `404`), except staff.
- `rating` is required, integer **1–5** — `0`, `6`, or a missing value →
  `400` with `errors.rating`.
- `content` is required and cannot be empty or whitespace-only → `400` with
  `errors.content`.
- **Duplicate** (same user + game) → **`409`**
  `"You have already reviewed this game."` (unique DB constraint).
- `user`, `game`, `id`, `created_at`, `updated_at` are read-only: the user
  comes from the token, the game from the URL, and forged IDs in the payload
  are ignored.

### Update review (owner or admin)

```http
PATCH /api/v1/reviews/{id}/

{ "rating": 2 }              // and/or { "content": "..." }
```

- `200 Review updated successfully`. Partial update — unsupplied fields stay.
- Owner or admin only: another user → `403`
  `"You do not have permission to perform this action."`; anonymous → `401`.
- Reassigning `user` / `game` via the payload is ignored (read-only).
- Invalid rating/content → `400`. Unknown id → `404`.

### Delete review (owner or admin)

```http
DELETE /api/v1/reviews/{id}/
```

- `200` with envelope
  `{"success": true, "message": "Review deleted successfully", "data": {}}`
  (no `204`). Permissions identical to update. Unknown id → `404`.

## Comment API

Comments are flat replies on a review (no nested replies in this phase).
A comment's visibility follows its review's game.

### List comments for a review (public)

```http
GET /api/v1/reviews/{review_id}/comments/
GET /api/v1/reviews/{review_id}/comments/?page=2&page_size=20
```

- `200 Comments retrieved successfully` with standard pagination, ordered
  **newest first** (`-created_at`).
- Each item:

  ```json
  {
    "id": 1,
    "content": "Great analysis of the boss patterns.",
    "author": { "id": 3, "first_name": "Ada", "last_name": "Lovelace" },
    "review": 7,
    "is_hidden": false,
    "created_at": "2026-10-09T10:00:00Z",
    "updated_at": "2026-10-09T10:00:00Z"
  }
  ```

- **Safe author fields only** — same shape as review authors
  (`{id, first_name, last_name}`); never email/password/tokens.
- Visibility follows the game: unknown review → `404`; a review on an
  `INACTIVE` game → `404` for anonymous and non-staff, `200` for staff.
- **Moderation:** hidden comments (`is_hidden: true`) are never returned to
  anonymous or ordinary users. Staff receive them and may filter with
  `?is_hidden=true|false` (an unrecognised value yields an empty page).
- `select_related` is used so the query count does not grow with data.

### Create comment (authenticated)

```http
POST /api/v1/reviews/{review_id}/comments/
Authorization: Bearer <access_token>

{ "content": "Great analysis of the boss patterns." }
```

- `201 Comment created successfully`.
- Anonymous → `401`. Unknown review → `404`. Ordinary users cannot comment
  on reviews of inactive (invisible) games → `404`; staff can.
- `content` is required and cannot be empty or whitespace-only → `400` with
  `errors.content` (also enforced by a DB `CheckConstraint`
  `comment_content_not_blank`).
- `content` is capped at **2000 characters** → `400` with `errors.content`
  (also enforced by a DB `CheckConstraint` `comment_content_max_length`).
- `content` is scanned by a configurable banned-word filter (case- and
  accent-insensitive, whole-word; see `COMMENT_BANNED_WORDS`) → `400` with a
  generic `errors.content` message that never echoes the matched word.
- `is_hidden` is read-only here — only staff can change it via the moderate
  endpoint.
- `user` / `review` / timestamps are read-only: the author comes from the
  token, the review from the URL — client-supplied `user_id`, `review_id`,
  etc. are ignored.

### Update comment (owner or admin)

```http
PATCH /api/v1/comments/{id}/

{ "content": "Updated comment." }
```

- `200 Comment updated successfully`. Partial update.
- Owner or admin only: another user → `403`
  `"You do not have permission to perform this action."`; anonymous → `401`;
  unknown id → `404`.
- Blank content → `400`. Reassigning `user`/`review` via the payload is
  ignored (read-only); `is_hidden` is likewise read-only here.

### Delete comment (owner or admin)

```http
DELETE /api/v1/comments/{id}/
```

- `200` with envelope
  `{"success": true, "message": "Comment deleted successfully", "data": {}}`
  (no `204`). Permissions identical to update.

### Moderate comment — hide/unhide (admin)

```http
POST /api/v1/comments/{id}/moderate/
Authorization: Bearer <staff_access_token>

{ "is_hidden": true }
```

- `200 Comment hidden successfully` (or `Comment unhidden successfully`) with
  the updated comment.
- Staff only: anonymous → `401`; authenticated non-staff → `403`; unknown id →
  `404`. `is_hidden` is required and must be a boolean → `400`.
- Hiding is a soft flag — the row and its content are preserved; hidden
  comments are simply filtered out of public lists (see above).

## Favorite API

A favorite is the current user's bookmark of a game: one row per
`(user, game)`, no history, no soft delete.

### Add favorite (authenticated)

```http
POST /api/v1/games/{slug}/favorite/
Authorization: Bearer <access_token>

{}
```

- `201 Favorite added successfully` → `data`:
  `{id, created_at, game}` where `game` is
  `{id, name, slug, cover_image, release_date, status, category}` (category
  nested as `{id, name, slug}`).
- Anonymous → `401`. Unknown slug → `404`; inactive game → `404` for
  non-staff (staff may favorite it) — same visibility rule as the Game
  module.
- **Duplicate → `409`** `"You have already favorited this game."` The
  conflict is derived from the `UNIQUE(user, game)` constraint inside an
  atomic savepoint, so both a duplicate request and a concurrency race
  return the same clean `409` — an `IntegrityError` is never exposed.
- The `user` comes from the token and the `game` from the URL;
  client-supplied `user` / `user_id` fields are ignored.

### Remove favorite (authenticated)

```http
DELETE /api/v1/games/{slug}/favorite/
```

- `200 Favorite removed successfully` — **idempotent**: removing a favorite
  that does not exist also returns `200` (documented behaviour; there is
  nothing to distinguish, and the desired end state is "not favorited").
- Scoped strictly to `request.user`: another user's favorite is **never**
  removed — the caller's delete only affects their own row.
- Anonymous → `401`. Unknown slug → `404`; inactive game → `404` for
  non-staff (same visibility rule as add).

### List my favorites (authenticated)

```http
GET /api/v1/me/favorites/
GET /api/v1/me/favorites/?page=2&page_size=20
```

- `200 Favorites retrieved successfully` with standard pagination, ordered
  newest favorite first (`-created_at`).
- Returns **only the current user's** favorites — the query scope comes from
  `request.user`; client-supplied `user`/`user_id` query params are ignored
  (they are never read).
- Each item: `{id, created_at, game}` with the same safe game shape as add.
- Inactive games are filtered out for non-staff (a favorite of a game that
  later became `INACTIVE` is hidden from its owner until staff visibility
  applies); staff see them.
- `select_related("game", "game__category")` keeps query counts flat.

## Report API (authenticated)

Users flag a review or comment they believe breaks the rules. The report
**target always comes from the URL** — the body carries only the reason and an
optional note, so a crafted payload can never point the report at other
content or change its status.

### Report a review

```http
POST /api/v1/reviews/{id}/report/
Authorization: Bearer <access_token>

{ "reason": "SPAM", "details": "optional, max 500 chars" }
```

- `201 Report submitted successfully` with the stored report (payload below).
- `reason` is required and allowlisted: `SPAM`, `HARASSMENT`, `OFF_TOPIC`,
  `MISLEADING`, `OTHER` (unknown/missing → `400`); `details` is optional,
  ≤ 500 characters (`400` when longer).
- **One report per account per target:** a duplicate → `409`
  `"You have already reported this content."` (DB conditional unique
  constraint, race-safe — the create path maps `IntegrityError` to `409`).
- Visibility follows the game: reporting a review of an `INACTIVE` game as a
  non-staff user → `404` (staff may report it). Unknown id → `404`;
  unauthenticated → `401`.
- Unrecognized body fields (`reporter`, `status`, …) are ignored, never
  trusted — identity comes from the token.

### Report a comment

```http
POST /api/v1/comments/{id}/report/
```

Same contract as reviews, with comment visibility applied: hidden comments
are `404` for non-staff (they cannot see them anywhere) and reportable by
staff.

### Report payload

```json
{
  "id": 7,
  "reason": "SPAM",
  "details": "Bot links everywhere",
  "status": "PENDING",
  "reporter": { "id": 3, "first_name": "Ada", "last_name": "Lovelace" },
  "review": {
    "id": 12,
    "rating": 5,
    "content": "…",
    "created_at": "2026-10-20T07:00:00Z",
    "game": { "id": 1, "slug": "elden-ring", "name": "Elden Ring" }
  },
  "comment": null,
  "resolved_by": null,
  "resolved_at": null,
  "created_at": "2026-10-20T07:10:00Z",
  "updated_at": "2026-10-20T07:10:00Z"
}
```

- Exactly one of `review`/`comment` is non-null (DB `CHECK
  report_exactly_one_target`); the other is `null`.
- `reporter`/`resolved_by` are the safe author shape — never email or tokens.
- Deleting the reported content cascades its reports away.

## Admin user API (staff only)

All endpoints below require an `is_staff` token: anonymous → `401`, authenticated
non-staff → `403`. The UI gates are UX only; this is the authoritative check.

### List users (staff)

```http
GET /api/v1/admin/users/
GET /api/v1/admin/users/?search=ada&page=2&page_size=20
GET /api/v1/admin/users/?ordering=email
```

- `200 Users retrieved successfully` with standard pagination, ordered
  `-created_at` by default.
- Query parameters: `search` matches `email`, `first_name`, `last_name`;
  `ordering` allowlist `email`, `first_name`, `created_at` (plus `-` forms);
  `page`, `page_size` (default 12, max 100).
- Each item contains **safe fields only**:
  `{id, email, first_name, last_name, is_staff, is_active, created_at}` —
  never `password`, `is_superuser` or token material.

### Lock/unlock a user (staff)

```http
POST /api/v1/admin/users/{id}/status/
Authorization: Bearer <staff_access_token>

{ "is_active": false }
```

- `200 User locked successfully` (or `User unlocked successfully`) with the
  updated user.
- `is_active` is required and must be a boolean → `400`.
- **Locking is immediate and global:** a deactivated user is rejected `401`
  on every subsequent authenticated request (the JWT auth class checks
  `is_active`) and `POST /auth/login/` keeps returning the generic
  `401 Invalid email or password`.
- Guards: unknown id → `404`; a staff user cannot lock **their own**
  account → `400` `"You cannot lock your own account."`.
- Content update: only `is_active` changes — `is_staff` / `is_superuser` /
  `email` are never writable through this endpoint.

## Admin moderation API (staff only)

All endpoints below require an `is_staff` token (anonymous → `401`,
authenticated non-staff → `403`) — same authoritative check as the admin
user API.

### Dashboard summary (staff)

```http
GET /api/v1/admin/summary/
```

- `200 Summary retrieved successfully` with live counters:
  - `games {total, active, inactive}`
  - `categories` (count)
  - `users {total, active, locked, staff}`
  - `reviews` (count)
  - `comments {total, visible, hidden}`
  - `favorites` (count)
  - `reports {total, pending, resolved}`
- One `aggregate()` per model (7 count queries in one request); totals are
  computed at read time — no cached or denormalized figures.

### List reports (staff)

```http
GET /api/v1/admin/reports/
GET /api/v1/admin/reports/?status=PENDING&search=elden&page=1
```

- `200 Reports retrieved successfully` with standard pagination, ordered
  `-created_at` by default (`ordering` allowlist: `created_at`, `status`).
- Filters: `status` = `PENDING` | `RESOLVED` (an unknown value returns an
  empty list); `search` matches the reporter's name/email and the reported
  review/comment content.
- Each item is the full report payload above (nested target + safe reporter).

### Resolve a report (staff)

```http
POST /api/v1/admin/reports/{id}/resolve/
Authorization: Bearer <staff_access_token>
```

- `200 Report resolved successfully` — flips `status` to `RESOLVED` and sets
  `resolved_by` (safe shape) + `resolved_at`.
- Already resolved → `409 "Report is already resolved."`; unknown id → `404`.
- The body is ignored (resolution state is server-owned).

### List reviews across games (staff)

```http
GET /api/v1/admin/reviews/
GET /api/v1/admin/reviews/?search=elden&ordering=rating
```

- `200 Reviews retrieved successfully` — every review regardless of game
  status (the public list only exists per visible game); default
  `-created_at`, `ordering` allowlist `created_at`, `rating`.
- `search` matches content, game name, and the author's email/first/last
  name. Items use the standard review payload (safe `author`, nested `game`).

### List comments across games (staff)

```http
GET /api/v1/admin/comments/
GET /api/v1/admin/comments/?search=elden&is_hidden=true
```

- `200 Comments retrieved successfully` — every comment **including hidden
  ones**; default `-created_at`.
- `search` matches content, game name, and the author's email/first/last
  name.
- `is_hidden` accepts `true`/`false` (also `1`/`0`, `yes`/`no`,
  case-insensitive) to narrow the list; **any other value returns an empty
  list** (a typo must never widen a moderation view); absent → all comments.
- Items add the parent `game {id, slug, name}` next to the public comment
  fields (comments have no page of their own).

## Endpoint Inventory (current)

| Method | Path                   | Auth    | Description            |
| ------ | ---------------------- | ------- | ---------------------- |
| GET    | `/health/`             | Public  | Health check           |
| POST   | `/auth/register/`      | Public  | Create account         |
| POST   | `/auth/login/`         | Public  | Get JWT pair           |
| POST   | `/auth/refresh/`       | Public  | Rotate refresh token   |
| POST   | `/auth/logout/`        | Public  | Blacklist refresh      |
| GET    | `/auth/me/`            | Bearer  | Current user           |
| PATCH  | `/auth/me/`            | Bearer  | Update profile (first/last name) |
| GET    | `/admin/users/`        | Staff   | List users (search)    |
| POST   | `/admin/users/{id}/status/` | Staff | Lock/unlock user    |
| GET    | `/admin/summary/`      | Staff   | Dashboard counters     |
| GET    | `/admin/reports/`      | Staff   | Report queue (search/status) |
| POST   | `/admin/reports/{id}/resolve/` | Staff | Resolve report |
| GET    | `/admin/reviews/`      | Staff   | Reviews across all games |
| GET    | `/admin/comments/`     | Staff   | Comments across all games |
| GET    | `/games/`              | Public  | List games (search/filter) |
| GET    | `/games/{slug}/`       | Public  | Game detail by slug    |
| POST   | `/games/`              | Admin   | Create game            |
| PATCH  | `/games/{id}/`         | Admin   | Update game            |
| DELETE | `/games/{id}/`         | Admin   | Delete game            |
| GET    | `/categories/`         | Public  | List categories        |
| POST   | `/categories/`         | Admin   | Create category        |
| PATCH  | `/categories/{id}/`    | Admin   | Update category        |
| DELETE | `/categories/{id}/`    | Admin   | Delete category        |
| GET    | `/games/{slug}/reviews/` | Public | List reviews for game  |
| POST   | `/games/{slug}/reviews/` | Bearer | Create review          |
| PATCH  | `/reviews/{id}/`       | Bearer  | Update review (owner/admin) |
| DELETE | `/reviews/{id}/`       | Bearer  | Delete review (owner/admin) |
| GET    | `/reviews/{id}/comments/` | Public | List comments for review |
| POST   | `/reviews/{id}/comments/` | Bearer | Create comment         |
| PATCH  | `/comments/{id}/`      | Bearer  | Update comment (owner/admin) |
| DELETE | `/comments/{id}/`      | Bearer  | Delete comment (owner/admin) |
| POST   | `/comments/{id}/moderate/` | Staff | Hide/unhide comment     |
| POST   | `/games/{slug}/favorite/` | Bearer | Add favorite          |
| DELETE | `/games/{slug}/favorite/` | Bearer | Remove favorite (idempotent) |
| GET    | `/me/favorites/`       | Bearer  | My favorites           |
| POST   | `/reviews/{id}/report/` | Bearer | Report review          |
| POST   | `/comments/{id}/report/` | Bearer | Report comment        |
| GET    | `/admin/`              | Staff   | Django admin (HTML)    |

All roadmap endpoints (Phases 00–11, including the Phase E moderation and
reporting API above) are implemented.

Rate limiting is implemented as scoped DRF throttles on `login` (`10/min`) and
`register` (`5/min`), configurable via `AUTH_LOGIN_THROTTLE_RATE` /
`AUTH_REGISTER_THROTTLE_RATE` (over-limit → `429`). There is no global throttle
class.
