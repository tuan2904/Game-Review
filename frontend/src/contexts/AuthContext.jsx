import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";
import { clearSession, getRefreshToken, onSessionCleared, refreshTokens } from "../api/client";

/**
 * Lightweight auth state for the app.
 *
 * status: "loading" → restore in progress
 *         "authenticated" → user present
 *         "unauthenticated" → no valid session
 *
 * login/register/logout reject with ApiError on failure — pages render the
 * message. Tokens are handled exclusively by the api/client module; this
 * context only owns the `user` object and the lifecycle around it.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Derived from storage on first render — avoids a synchronous setState
  // inside the mount effect (no extra render pass, no flash of "loading"
  // when there is no session to restore).
  const [status, setStatus] = useState(() => (getRefreshToken() ? "loading" : "unauthenticated"));

  /* A failed refresh anywhere in the app clears the session → log out. */
  useEffect(
    () =>
      onSessionCleared(() => {
        setUser(null);
        setStatus("unauthenticated");
      }),
    [],
  );

  /* Restore the session on startup: refresh token → new access → /auth/me. */
  useEffect(() => {
    if (!getRefreshToken()) return undefined;

    let alive = true;

    async function restore() {
      try {
        await refreshTokens();
        const me = await authApi.fetchMe();
        if (!alive) return;
        setUser(me);
        setStatus("authenticated");
      } catch {
        if (!alive) return;
        // refreshTokens() already cleared an invalid session; network
        // failures simply leave the user signed out for now.
        clearSession();
        setUser(null);
        setStatus("unauthenticated");
      }
    }

    restore();

    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const register = useCallback(async ({ email, password, firstName, lastName }) => {
    await authApi.register({ email, password, firstName, lastName });
    // The backend issues no tokens on register — sign in right away so the
    // user lands authenticated. If this fails, the account still exists and
    // the page can fall back to /login.
    const data = await authApi.login({ email, password });
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* Server unreachable / token already invalid — still clear locally. */
    }
    clearSession();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      isLoading: status === "loading",
      login,
      register,
      logout,
    }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
