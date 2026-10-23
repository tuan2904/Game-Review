import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { setAccessToken, setRefreshToken } from "../api/client";

// The client keeps the access token and the cleared-session listener in
// module scope, so each test must start from a clean slate or state leaks.
beforeEach(() => {
  setAccessToken(null);
  setRefreshToken(null);
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});
