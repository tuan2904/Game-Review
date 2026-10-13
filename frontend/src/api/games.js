import { buildParams, client } from "./client";

/**
 * Game & Category endpoints (docs/API.md — Game API / Category API).
 * Reads are public; writes require an admin (is_staff).
 */

/**
 * List games — `?search= ?category= ?ordering= ?page= ?page_size=`
 * (allowlisted server-side; see docs/API.md).
 *
 * @param {Object} [params]
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 *   (e.g. `signal` so callers can cancel and drop stale responses)
 * @returns {Promise<import("../types").PaginatedGames>}
 */
export function listGames(params, config) {
  return client.get("/games/", { ...config, params: buildParams(params) });
}

/**
 * Retrieve one game by slug (404 → ApiError with status 404).
 *
 * @param {string} slug
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 *   (e.g. `signal` for cancellation)
 * @returns {Promise<import("../types").Game>}
 */
export function getGame(slug, config) {
  return client.get(`/games/${slug}/`, config);
}

/**
 * Create a game — admin only (`is_staff`): anonymous → 401, non-admin → 403.
 *
 * Required: `name`, `description`, `developer`, `publisher`, `release_date`,
 * `category_id`. Optional: `slug` (auto-generated when omitted; must be
 * unique and not purely numeric), `cover_image` (URL, `""` allowed),
 * `status` (default `ACTIVE`). Server-controlled fields (`id`,
 * `created_at`, `updated_at`) are read-only and ignored.
 *
 * @param {import("../types").GameWritePayload} payload
 * @returns {Promise<import("../types").Game>} 201 "Game created successfully"
 */
export function createGame(payload) {
  return client.post("/games/", payload);
}

/**
 * Partially update a game — admin only, addressed by **numeric id**
 * (`/games/{slug}/` is the public read route). `200 Game updated
 * successfully`; unknown id → 404; duplicate/numeric slug → 400. The slug
 * stays stable on rename unless sent explicitly.
 *
 * @param {number} id game id
 * @param {Partial<import("../types").GameWritePayload>} patch
 * @returns {Promise<import("../types").Game>}
 */
export function updateGame(id, patch) {
  return client.patch(`/games/${id}/`, patch);
}

/**
 * Delete a game — admin only. `200` "Game deleted successfully" (envelope,
 * no 204). A game referenced by reviews cannot be deleted → 409
 * "Cannot delete game while reviews reference it."; unknown id → 404.
 *
 * @param {number} id game id
 * @returns {Promise<void>}
 */
export function deleteGame(id) {
  return client.delete(`/games/${id}/`);
}

/**
 * List categories (paginated, ordered by name). Use `page_size: 100` (the
 * backend maximum) when the caller needs every option, e.g. a filter.
 *
 * @param {Object} [params]
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 *   (e.g. `signal` for cancellation)
 * @returns {Promise<import("../types").PaginatedCategories>}
 */
export function listCategories(params, config) {
  return client.get("/categories/", { ...config, params: buildParams(params) });
}

/**
 * Create a category — admin only (`is_staff`): anonymous → 401, non-admin →
 * 403. `{name}` required; `slug` optional (auto-generated when omitted,
 * e.g. "Action RPG" → "action-rpg"); duplicates → 400 on `name`/`slug`.
 *
 * @param {{ name: string, slug?: string }} payload
 * @returns {Promise<import("../types").Category>} 201 "Category created successfully"
 */
export function createCategory(payload) {
  return client.post("/categories/", payload);
}

/**
 * Partially update a category — admin only. `200 Category updated
 * successfully`; renaming keeps the slug unless `slug` is sent; duplicates →
 * 400; unknown id → 404.
 *
 * @param {number} id category id
 * @param {{ name?: string, slug?: string }} patch
 * @returns {Promise<import("../types").Category>}
 */
export function updateCategory(id, patch) {
  return client.patch(`/categories/${id}/`, patch);
}

/**
 * Delete a category — admin only. `200` "Category deleted successfully"
 * (envelope, no 204). A category referenced by games cannot be deleted →
 * 409 "Cannot delete category while games reference it."; unknown id → 404.
 *
 * @param {number} id category id
 * @returns {Promise<void>}
 */
export function deleteCategory(id) {
  return client.delete(`/categories/${id}/`);
}
