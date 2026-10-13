import axios from "axios";

/**
 * Single Axios client for the GameReview API.
 *
 * Backend contract (docs/API.md):
 *   success → { success: true,  message, data }
 *   error   → { success: false, message, errors }
 *
 * Strategy:
 *  - success responses are unwrapped: callers receive `data` directly
 *  - failures are normalized to a single `ApiError { status, message, errors }`
 *    so UI code never touches Axios internals, stack traces, or raw payloads
 *  - the access token lives in memory only (never persisted to storage)
 *  - the refresh token is kept in sessionStorage (see docs/FRONTEND.md for the
 *    security trade-off: the backend only returns tokens in JSON — there is no
 *    HttpOnly cookie support in this phase)
 *  - concurrent 401s share one single-flight refresh; every original request
 *    is retried at most once (no infinite retry loops)
 */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const REFRESH_STORAGE_KEY = "gamereview.refresh";

/** In-memory access token — deliberately never written to storage. */
let accessToken = null;
/** Callback registered by AuthContext to reset user state when the session dies. */
let sessionClearedListener = null;

export class ApiError extends Error {
  constructor({ status, message, errors = {} }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

/* ------------------------------------------------------------------ */
/* Token storage                                                       */
/* ------------------------------------------------------------------ */

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  try {
    return sessionStorage.getItem(REFRESH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(REFRESH_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable (private mode) — session simply won't persist */
  }
}

/** Wipe all client auth state and notify the AuthContext listener. */
export function clearSession() {
  accessToken = null;
  setRefreshToken(null);
  sessionClearedListener?.();
}

/** AuthContext subscribes here so a failed refresh logs the user out. */
export function onSessionCleared(callback) {
  sessionClearedListener = callback;
  return () => {
    if (sessionClearedListener === callback) {
      sessionClearedListener = null;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Error normalization                                                 */
/* ------------------------------------------------------------------ */

const NETWORK_ERROR_MESSAGE = "Network error. Please check your connection and try again.";
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

function toApiError(status, data) {
  if (data && typeof data === "object" && "success" in data) {
    return new ApiError({
      status,
      message: data.message || GENERIC_ERROR_MESSAGE,
      errors: data.errors || {},
    });
  }
  return new ApiError({
    status,
    message: status >= 500 ? GENERIC_ERROR_MESSAGE : "Request failed",
    errors: {},
  });
}

function unwrap(response) {
  const body = response.data;
  if (body && typeof body === "object" && "success" in body) {
    if (body.success) {
      return body.data;
    }
    throw toApiError(response.status, body);
  }
  return body;
}

/* ------------------------------------------------------------------ */
/* Client instance                                                     */
/* ------------------------------------------------------------------ */

export const client = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/* Endpoints whose 401 must never trigger an auto-refresh. */
const NO_REFRESH_URLS = ["/auth/login/", "/auth/register/", "/auth/refresh/", "/auth/logout/"];

function shouldAttemptRefresh(config) {
  if (!config || config._retry || config.skipAuthRefresh) return false;
  if (!getRefreshToken()) return false;
  const url = config.url || "";
  return !NO_REFRESH_URLS.some((path) => url.endsWith(path));
}

/* Single-flight refresh: parallel 401s await the same promise. */
let refreshPromise = null;

export function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) {
    throw new ApiError({ status: 401, message: "Session expired. Please sign in again." });
  }
  try {
    const data = await client.post("/auth/refresh/", { refresh }, { skipAuthRefresh: true });
    setAccessToken(data.access);
    if (data.refresh) {
      setRefreshToken(data.refresh);
    }
    return data;
  } catch (error) {
    // Invalid/expired/blacklisted refresh → clear the session so the app
    // never loops on a dead credential. Network failures (status 0) keep the
    // stored refresh token so a later retry can still succeed.
    if (error instanceof ApiError && error.status !== 0) {
      clearSession();
    }
    throw error;
  }
}

client.interceptors.response.use(
  (response) => unwrap(response),
  async (error) => {
    if (!error.response) {
      throw new ApiError({ status: 0, message: NETWORK_ERROR_MESSAGE });
    }

    const { status, data } = error.response;
    const normalized = toApiError(status, data);
    const original = error.config;

    if (status === 401 && shouldAttemptRefresh(original)) {
      original._retry = true;
      try {
        await refreshTokens();
      } catch {
        // Session was cleared (or refresh failed): surface the original 401
        // to the caller — no retry with a dead credential.
        throw normalized;
      }
      return client(original);
    }

    throw normalized;
  },
);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Convert a params object into axios params, dropping empty values. */
export function buildParams(params = {}) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

/**
 * First validation message for a field, or null.
 *
 * Handles both shapes found in this app: DRF errors are arrays of strings
 * (`{ email: ["Already exists."] }`), while client-side validation stores a
 * plain string (`{ email: "Required." }`).
 */
export function fieldError(errors, name) {
  const value = errors?.[name];
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
