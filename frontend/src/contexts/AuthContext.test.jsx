import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import * as authApi from "../api/auth";
import { clearSession, getRefreshToken, onSessionCleared, refreshTokens } from "../api/client";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRefreshToken: vi.fn(() => null),
    refreshTokens: vi.fn(),
    clearSession: vi.fn(),
    onSessionCleared: vi.fn(() => () => {}),
  };
});

vi.mock("../api/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
  fetchMe: vi.fn(),
  logout: vi.fn(),
}));

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  getRefreshToken.mockReturnValue(null);
  onSessionCleared.mockReturnValue(() => {});
});

describe("AuthProvider", () => {
  it("starts unauthenticated when no refresh token is stored", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("sets the user after a successful login", async () => {
    authApi.login.mockResolvedValue({ user: { id: 1, email: "player@example.com" } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login("player@example.com", "pw");
    });

    expect(authApi.login).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "pw",
    });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toEqual({ id: 1, email: "player@example.com" });
  });

  it("propagates login errors and stays unauthenticated", async () => {
    authApi.login.mockRejectedValue(new Error("Invalid credentials."));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(result.current.login("a@b.c", "bad")).rejects.toThrow("Invalid credentials.");
    expect(result.current.status).toBe("unauthenticated");
  });

  it("clears the session on logout even if the server call fails", async () => {
    authApi.logout.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(clearSession).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("restores the session from a stored refresh token", async () => {
    getRefreshToken.mockReturnValue("refresh-1");
    refreshTokens.mockResolvedValue({ access: "access-1" });
    authApi.fetchMe.mockResolvedValue({ id: 2, email: "restored@example.com" });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(refreshTokens).toHaveBeenCalled();
    expect(result.current.user).toEqual({ id: 2, email: "restored@example.com" });
  });

  it("clears the session when restore fails", async () => {
    getRefreshToken.mockReturnValue("dead-refresh");
    refreshTokens.mockRejectedValue(new Error("expired"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(clearSession).toHaveBeenCalled();
  });
});
