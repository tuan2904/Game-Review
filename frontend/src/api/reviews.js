import { buildParams, client } from "./client";

/**
 * Review endpoints (docs/API.md — Review API).
 *
 * Contracts verified against the backend (tests + views):
 *  - GET    /games/{slug}/reviews/  public, paginated, `?ordering=` allowlist
 *    (`-created_at` default, `created_at`, `rating`, `-rating`)
 *  - POST   /games/{slug}/reviews/  auth required; payload `{rating, content}`
 *    only (user/game come from token + URL; forged ids are ignored).
 *    201 created; duplicate → 409 "You have already reviewed this game.";
 *    rating must be 1–5 and content non-blank → 400 `errors.rating` /
 *    `errors.content`; inactive game → 404 for non-staff.
 *  - PATCH  /reviews/{id}/          owner or staff; partial `{rating?, content?}`;
 *    200 envelope "Review updated successfully"; 401 anon / 403 non-owner /
 *    404 unknown; user/game reassignment is ignored server-side.
 *  - DELETE /reviews/{id}/          owner or staff; 200 envelope
 *    "Review deleted successfully" (no 204); same 401/403/404 rules.
 * One review per user per game; the server is authoritative for permission
 * and validation errors — render `ApiError.message` / `ApiError.errors`.
 */

/**
 * List reviews for a game — paginated, sorted by the server-side `ordering`
 * allowlist (default `-created_at`; also `created_at`, `rating`, `-rating`
 * with an `id` tie-break). Any other parameter is ignored by the backend.
 *
 * @param {string} slug game slug
 * @param {Object} [params] `{ page, page_size, ordering }`
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 *   (e.g. `signal` for cancellation)
 * @returns {Promise<import("../types").PaginatedReviews>}
 */
export function listGameReviews(slug, params, config) {
  return client.get(`/games/${slug}/reviews/`, { ...config, params: buildParams(params) });
}

/**
 * Create the current user's review for a game (duplicate → 409 ApiError).
 *
 * @param {string} slug game slug
 * @param {{ rating: number, content: string }} payload rating 1–5, content non-blank
 * @returns {Promise<import("../types").Review>}
 */
export function createGameReview(slug, { rating, content }) {
  return client.post(`/games/${slug}/reviews/`, { rating, content });
}

/**
 * Edit a review (owner or staff; partial payload accepted).
 *
 * @param {number} id review id
 * @param {{ rating?: number, content?: string }} patch
 * @returns {Promise<import("../types").Review>}
 */
export function updateReview(id, patch) {
  return client.patch(`/reviews/${id}/`, patch);
}

/**
 * Delete a review (owner or staff; resolves when the server confirms).
 *
 * @param {number} id review id
 * @returns {Promise<void>}
 */
export function deleteReview(id) {
  return client.delete(`/reviews/${id}/`);
}
