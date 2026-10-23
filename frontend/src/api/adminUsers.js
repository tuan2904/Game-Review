import { buildParams, client } from "./client";

/**
 * Staff-only user administration (docs/API.md — Admin user API), verified
 * against the backend views:
 *
 *  - GET  /admin/users/             staff only (401 anon, 403 non-staff);
 *    paginated, ordered `-created_at`; `?search=` matches email/first/last
 *    name; items carry safe fields only:
 *    `{id, email, first_name, last_name, is_staff, is_active, created_at}`.
 *  - POST /admin/users/{id}/status/  staff only; body `{is_active: boolean}`;
 *    `true` unlocks, `false` locks (deactivated users are rejected 401 on
 *    every subsequent request). 200 "User locked/unlocked successfully".
 */

/**
 * List users (staff only, paginated).
 *
 * @param {Object} [params] `search`, `page`, `page_size` (backend max 100),
 *   `ordering` (`email`/`first_name`/`created_at`)
 * @param {import("axios").AxiosRequestConfig} [config] optional request config
 *   (e.g. `signal` so callers can cancel and drop stale responses)
 * @returns {Promise<import("../types").PaginatedAdminUsers>}
 */
export function listAdminUsers(params, config) {
  return client.get("/admin/users/", { ...config, params: buildParams(params) });
}

/**
 * Lock (`isActive === false`) or unlock (`isActive === true`) an account.
 *
 * @param {number} id user id
 * @param {boolean} isActive
 * @returns {Promise<import("../types").AdminUser>} 200 with the updated user
 */
export function setUserActive(id, isActive) {
  return client.post(`/admin/users/${id}/status/`, { is_active: isActive });
}
