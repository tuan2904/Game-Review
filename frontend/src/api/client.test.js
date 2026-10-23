import { beforeEach, describe, expect, it } from "vitest";
import {
  ApiError,
  buildParams,
  client,
  fieldError,
  getAccessToken,
  getRefreshToken,
  refreshTokens,
  setAccessToken,
  setRefreshToken,
} from "./client";

/**
 * Fake axios adapter: lets us drive the real interceptor pipeline without any
 * network. `handler(config, n)` returns a response body `{ data, status }` or
 * `{ response: {...} }` to simulate a failed request.
 */
function useAdapter(handler) {
  const calls = [];
  const adapter = async (config) => {
    calls.push({ url: config.url, headers: { ...config.headers } });
    const result = await handler(config, calls.length);
    if (result && result.response) {
      const error = new Error("Request failed");
      error.config = config;
      error.response = result.response;
      throw error;
    }
    return {
      data: result.data,
      status: result.status ?? 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  client.defaults.adapter = adapter;
  return calls;
}

const ok = (data) => ({ data: { success: true, message: "ok", data }, status: 200 });
const fail = (status, body) => ({ response: { status, data: body, headers: {}, config: {} } });

beforeEach(() => {
  setAccessToken(null);
  setRefreshToken(null);
});

describe("response unwrapping", () => {
  it("returns the envelope's data payload directly", async () => {
    useAdapter(() => ok({ id: 7, slug: "celeste" }));

    const result = await client.get("/games/celeste/");

    expect(result).toEqual({ id: 7, slug: "celeste" });
  });

  it("passes through bodies that are not an API envelope", async () => {
    useAdapter(() => ({ data: { raw: true }, status: 200 }));

    await expect(client.get("/ping/")).resolves.toEqual({ raw: true });
  });
});

describe("error normalization", () => {
  it("maps an error envelope to an ApiError with status, message and errors", async () => {
    useAdapter(() =>
      fail(400, { success: false, message: "Validation failed.", errors: { email: ["Taken."] } }),
    );

    const error = await client.post("/auth/register/", {}).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("Validation failed.");
    expect(error.errors).toEqual({ email: ["Taken."] });
  });

  it("uses a generic message for 5xx responses without an envelope", async () => {
    useAdapter(() => fail(500, "<html>boom</html>"));

    const error = await client.get("/games/").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toBe("Something went wrong. Please try again.");
  });

  it("maps transport failures (no response) to a status-0 network ApiError", async () => {
    useAdapter(() => {
      throw new Error("ECONNREFUSED");
    });

    const error = await client.get("/games/").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/network error/i);
  });
});

describe("access token header", () => {
  it("attaches the in-memory access token as a Bearer header", async () => {
    const calls = useAdapter(() => ok({}));
    setAccessToken("access-123");

    await client.get("/me/");

    expect(calls[0].headers.Authorization).toBe("Bearer access-123");
  });

  it("sends no Authorization header when there is no access token", async () => {
    const calls = useAdapter(() => ok({}));

    await client.get("/games/");

    expect(calls[0].headers.Authorization).toBeUndefined();
  });
});

describe("401 refresh and retry", () => {
  it("refreshes once and retries the original request with the new token", async () => {
    setAccessToken("old-access");
    setRefreshToken("refresh-1");
    let refreshCalls = 0;
    let protectedCalls = 0;

    useAdapter((config) => {
      if (config.url === "/auth/refresh/") {
        refreshCalls += 1;
        return ok({ access: "new-access", refresh: "refresh-2" });
      }
      protectedCalls += 1;
      if (config.headers.Authorization === "Bearer new-access") {
        return ok({ ok: true });
      }
      return fail(401, { success: false, message: "Unauthorized", errors: {} });
    });

    await expect(client.get("/protected/")).resolves.toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2);
    expect(getAccessToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("shares a single refresh between concurrent 401s", async () => {
    setAccessToken("old-access");
    setRefreshToken("refresh-1");
    let refreshCalls = 0;

    useAdapter(async (config) => {
      if (config.url === "/auth/refresh/") {
        refreshCalls += 1;
        return ok({ access: "new-access", refresh: "refresh-1" });
      }
      if (config.headers.Authorization === "Bearer new-access") {
        return ok({ ok: true });
      }
      return fail(401, { success: false, message: "Unauthorized", errors: {} });
    });

    const [a, b] = await Promise.all([client.get("/one/"), client.get("/two/")]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it("does not attempt a refresh for auth endpoints", async () => {
    setAccessToken("old-access");
    setRefreshToken("refresh-1");
    const calls = useAdapter((config) => {
      if (config.url === "/auth/login/") {
        return fail(401, { success: false, message: "Invalid credentials.", errors: {} });
      }
      throw new Error(`unexpected request to ${config.url}`);
    });

    const error = await client.post("/auth/login/", {}).catch((e) => e);

    expect(error.status).toBe(401);
    expect(calls.map((c) => c.url)).toEqual(["/auth/login/"]);
  });

  it("does not refresh when there is no stored refresh token", async () => {
    setAccessToken("old-access");
    const calls = useAdapter((config) => {
      if (config.url === "/auth/refresh/") {
        throw new Error("refresh must not be called without a stored token");
      }
      return fail(401, { success: false, message: "Unauthorized", errors: {} });
    });

    const error = await client.get("/protected/").catch((e) => e);

    expect(error.status).toBe(401);
    expect(calls.map((c) => c.url)).toEqual(["/protected/"]);
  });

  it("clears the session when the refresh token is rejected", async () => {
    setAccessToken("old-access");
    setRefreshToken("dead-refresh");
    useAdapter((config) => {
      if (config.url === "/auth/refresh/") {
        return fail(401, { success: false, message: "Token is invalid or expired.", errors: {} });
      }
      return fail(401, { success: false, message: "Unauthorized", errors: {} });
    });

    const error = await client.get("/protected/").catch((e) => e);

    expect(error.status).toBe(401);
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe("refreshTokens", () => {
  it("rejects with a 401 ApiError when no refresh token is stored", async () => {
    await expect(refreshTokens()).rejects.toMatchObject({ name: "ApiError", status: 401 });
  });

  it("keeps the stored refresh token on network failure", async () => {
    setRefreshToken("keep-me");
    useAdapter((config) => {
      if (config.url === "/auth/refresh/") {
        throw new Error("offline");
      }
      throw new Error(`unexpected request to ${config.url}`);
    });

    await expect(refreshTokens()).rejects.toMatchObject({ status: 0 });
    expect(getRefreshToken()).toBe("keep-me");
  });
});

describe("helpers", () => {
  it("buildParams drops empty values", () => {
    expect(buildParams({ page: 1, q: "", tag: null, id: undefined, active: false })).toEqual({
      page: 1,
      active: false,
    });
  });

  it("fieldError reads DRF arrays and plain strings", () => {
    expect(fieldError({ email: ["Taken."] }, "email")).toBe("Taken.");
    expect(fieldError({ email: "Required." }, "email")).toBe("Required.");
    expect(fieldError({}, "email")).toBeNull();
    expect(fieldError(undefined, "email")).toBeNull();
  });
});
