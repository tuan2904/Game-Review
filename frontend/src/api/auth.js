import { client, getRefreshToken, setAccessToken, setRefreshToken } from "./client";

/**
 * Auth endpoints — paths verified against docs/API.md and backend source
 * (all with trailing slashes):
 *
 *   POST /api/v1/auth/register/  → 201 data: User
 *   POST /api/v1/auth/login/     → 200 data: { access, refresh, user }
 *   POST /api/v1/auth/refresh/   → 200 data: { access, refresh }  (rotated)
 *   POST /api/v1/auth/logout/    → 200 data: {}                   (blacklists refresh)
 *   GET  /api/v1/auth/me/        → 200 data: User
 *
 * Tokens are stored as soon as they are received: access in memory,
 * refresh in sessionStorage (see docs/FRONTEND.md).
 */

/** @returns {Promise<import("../types").User>} */
export async function register({ email, password, firstName, lastName }) {
  return client.post("/auth/register/", {
    email,
    password,
    first_name: firstName,
    last_name: lastName,
  });
}

/** @returns {Promise<{access: string, refresh: string, user: import("../types").User}>} */
export async function login({ email, password }) {
  const data = await client.post("/auth/login/", { email, password });
  setAccessToken(data.access);
  setRefreshToken(data.refresh);
  return data;
}

/** @returns {Promise<import("../types").User>} */
export async function fetchMe() {
  return client.get("/auth/me/");
}

/**
 * Ask the server to blacklist the current refresh token.
 * Throws on failure — the caller decides whether local state still clears.
 */
export async function logout() {
  const refresh = getRefreshToken();
  if (!refresh) return;
  await client.post("/auth/logout/", { refresh });
}
