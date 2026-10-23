import { buildParams, client } from "./client";

/**
 * Staff moderation (docs/API.md — Admin moderation API), verified against the
 * backend views (all staff-only: 401 anon / 403 non-admin):
 *
 *  - GET  /admin/summary/          dashboard counters in one request:
 *    `{games, categories, users, reviews, comments, favorites, reports}`
 *  - GET  /admin/reports/          report queue; `?status=PENDING|RESOLVED`,
 *    `?search=` (reporter / reported content), ordered `-created_at`;
 *    items nest the safe reporter and the reported review/comment + its game
 *  - POST /admin/reports/{id}/resolve/  200 "Report resolved successfully";
 *    resolving twice → 409
 *  - GET  /admin/reviews/          every review incl. inactive games;
 *    `?search=` content/author/game, `?ordering=created_at|rating`
 *  - GET  /admin/comments/         every comment incl. hidden;
 *    `?search=`, `?is_hidden=true|false`
 */

/**
 * Dashboard counters (staff only).
 *
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 * @returns {Promise<import("../types").AdminSummary>}
 */
export function fetchAdminSummary(config) {
  return client.get("/admin/summary/", config);
}

/**
 * List reports (staff only, paginated).
 *
 * @param {Object} [params] `search`, `page`, `page_size`, `status`
 * @param {import("axios").AxiosRequestConfig} [config]
 * @returns {Promise<import("../types").PaginatedReports>}
 */
export function listAdminReports(params, config) {
  return client.get("/admin/reports/", { ...config, params: buildParams(params) });
}

/**
 * Mark a pending report as resolved (staff only).
 *
 * @param {number} id report id
 * @returns {Promise<import("../types").Report>} 200 with the updated report
 */
export function resolveReport(id) {
  return client.post(`/admin/reports/${id}/resolve/`, {});
}

/**
 * List every review across games (staff only, paginated).
 *
 * @param {Object} [params] `search`, `page`, `page_size`, `ordering`
 * @param {import("axios").AxiosRequestConfig} [config]
 * @returns {Promise<import("../types").PaginatedReviews>}
 */
export function listAdminReviews(params, config) {
  return client.get("/admin/reviews/", { ...config, params: buildParams(params) });
}

/**
 * List every comment across games (staff only, paginated).
 *
 * @param {Object} [params] `search`, `page`, `page_size`, `is_hidden`
 * @param {import("axios").AxiosRequestConfig} [config]
 * @returns {Promise<import("../types").PaginatedAdminComments>}
 */
export function listAdminComments(params, config) {
  return client.get("/admin/comments/", { ...config, params: buildParams(params) });
}
