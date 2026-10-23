import { buildParams, client } from "./client";

/**
 * Comment endpoints (docs/API.md — Comment API), verified against the
 * backend views/tests:
 *  - GET    /reviews/{review_id}/comments/  public, paginated, newest first
 *    (`-created_at`); unknown review or one on a hidden (inactive, non-staff)
 *    game → 404. Hidden (moderated) comments are excluded for non-staff;
 *    staff may pass `is_hidden=true|false` to filter. Items: `{id, content,
 *    author: {id, first_name, last_name}, review, is_hidden, created_at,
 *    updated_at}` — safe author fields only.
 *  - POST   /reviews/{review_id}/comments/  auth required (401 anon); payload
 *    `{content}` only — `user`/`review`/timestamps come from the token/URL
 *    and forged ids are ignored. 201 "Comment created successfully";
 *    blank/missing content → 400 `errors.content`; over-length (> 2000) or a
 *    banned word → 400 `errors.content`; hidden game → 404.
 *  - PATCH  /comments/{id}/                 owner or staff (401 anon,
 *    403 non-owner, 404 unknown); partial `{content}`; 200 "Comment updated
 *    successfully"; blank content → 400 `errors.content`. `is_hidden` is
 *    read-only here.
 *  - DELETE /comments/{id}/                 same permissions; 200 envelope
 *    "Comment deleted successfully" (no 204).
 *  - POST   /comments/{id}/moderate/        staff only (401 anon, 403
 *    non-staff, 404 unknown); payload `{is_hidden: boolean}`; 200
 *    "Comment hidden successfully" / "Comment unhidden successfully".
 * The server is authoritative for validation and permission errors.
 */

/**
 * List the comments for one review (newest first, paginated).
 *
 * @param {number} reviewId
 * @param {Object} [params] `page`, `page_size` (backend max 100),
 *   `is_hidden` (`true`/`false`, staff only — ignored for non-staff clients)
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 *   (e.g. `signal` so callers can cancel and drop stale responses)
 * @returns {Promise<import("../types").PaginatedComments>}
 */
export function listReviewComments(reviewId, params, config) {
  return client.get(`/reviews/${reviewId}/comments/`, {
    ...config,
    params: buildParams(params),
  });
}

/**
 * Create a comment on a review as the signed-in user.
 *
 * @param {number} reviewId
 * @param {{ content: string }} payload content must be non-blank after trimming
 * @returns {Promise<import("../types").Comment>} 201 "Comment created successfully"
 */
export function createReviewComment(reviewId, { content }) {
  return client.post(`/reviews/${reviewId}/comments/`, { content });
}

/**
 * Edit a comment (owner or staff; partial payload accepted).
 *
 * @param {number} id comment id
 * @param {{ content?: string }} patch
 * @returns {Promise<import("../types").Comment>} 200 "Comment updated successfully"
 */
export function updateComment(id, patch) {
  return client.patch(`/comments/${id}/`, patch);
}

/**
 * Delete a comment (owner or staff; resolves when the server confirms).
 *
 * @param {number} id comment id
 * @returns {Promise<void>} 200 envelope "Comment deleted successfully"
 */
export function deleteComment(id) {
  return client.delete(`/comments/${id}/`);
}

/**
 * Hide or unhide a comment (staff only; server rejects non-staff with 403).
 *
 * @param {number} id comment id
 * @param {boolean} isHidden `true` to hide, `false` to unhide
 * @returns {Promise<import("../types").Comment>} 200 with the updated comment
 */
export function moderateComment(id, isHidden) {
  return client.post(`/comments/${id}/moderate/`, { is_hidden: isHidden });
}
