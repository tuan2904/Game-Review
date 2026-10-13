import { buildParams, client } from "./client";

/**
 * Favorite endpoints (docs/API.md — Favorite API), verified against the
 * backend views/tests:
 *  - POST   /games/{slug}/favorite/  auth required (401 anon); empty body
 *    `{}`; 201 "Favorite added successfully" with
 *    `{id, created_at, game: {id, name, slug, cover_image, release_date,
 *    status, category}}`. Duplicate → 409 "You have already favorited this
 *    game."; unknown/hidden slug → 404; forged `user`/`user_id` ignored
 *    (identity comes from the token).
 *  - DELETE /games/{slug}/favorite/  auth required; **idempotent** 200
 *    "Favorite removed successfully" (removing a missing favorite still
 *    returns 200 and only ever affects the caller's own row); unknown/hidden
 *    slug → 404.
 *  - GET    /me/favorites/           auth required (401 anon); only the
 *    current user's favorites, newest first (`-created_at`), standard
 *    pagination (`page`, `page_size` max 100; past the last page → 404);
 *    items `{id, created_at, game}`; inactive games hidden from non-staff.
 *    There is **no** favorite-status field on the public game serializer and
 *    no single-game status endpoint — callers derive status from this list.
 */

/**
 * Add the current user's favorite for a game (duplicate → 409 ApiError).
 *
 * @param {string} gameSlug
 * @returns {Promise<import("../types").Favorite>} 201 "Favorite added successfully"
 */
export function addFavorite(gameSlug) {
  return client.post(`/games/${gameSlug}/favorite/`, {});
}

/**
 * Remove the current user's favorite for a game (idempotent — a missing
 * favorite still resolves with 200).
 *
 * @param {string} gameSlug
 * @returns {Promise<void>} 200 "Favorite removed successfully"
 */
export function removeFavorite(gameSlug) {
  return client.delete(`/games/${gameSlug}/favorite/`);
}

/**
 * List the current user's favorites (newest first, paginated).
 *
 * @param {Object} [params] `page`, `page_size` (backend max 100)
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 *   (e.g. `signal` so callers can cancel and drop stale responses)
 * @returns {Promise<import("../types").PaginatedFavorites>}
 */
export function listMyFavorites(params, config) {
  return client.get("/me/favorites/", { ...config, params: buildParams(params) });
}
