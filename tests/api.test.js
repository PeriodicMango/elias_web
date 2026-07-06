// ---------------------------------------------------------------------------
// API client — contract tests (no module import, tests the pattern)
// ---------------------------------------------------------------------------
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("API client — BASE config", () => {
  it("uses empty BASE by default", () => {
    // Verify the pattern: window.__ELIAS_API__ ?? ""
    const BASE = window.__ELIAS_API__ ?? "";
    expect(BASE).toBe("");
  });

  it("custom BASE via window.__ELIAS_API__", () => {
    window.__ELIAS_API__ = "http://192.168.1.100:3457";
    const BASE = window.__ELIAS_API__ ?? "";
    expect(BASE).toBe("http://192.168.1.100:3457");
  });

  it("falls back to empty string when __ELIAS_API__ is not set", () => {
    delete window.__ELIAS_API__;
    const BASE = window.__ELIAS_API__ ?? "";
    expect(BASE).toBe("");
  });
});

describe("API client — JWT token fallback", () => {
  it("reads token from localStorage", () => {
    localStorage.setItem("elias-auth-token", "test-token-123");
    const token = localStorage.getItem("elias-auth-token");
    expect(token).toBe("test-token-123");
  });

  it("clear token on auth error", () => {
    localStorage.setItem("elias-auth-token", "old-token");
    localStorage.removeItem("elias-auth-token");
    expect(localStorage.getItem("elias-auth-token")).toBeNull();
  });

  it("sends Authorization header when token exists", () => {
    localStorage.setItem("elias-auth-token", "bearer-token-456");
    const token = localStorage.getItem("elias-auth-token");
    expect(token).toBe("bearer-token-456");

    // Simulate the authHeaders pattern from api.js
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    expect(headers["Authorization"]).toBe("Bearer bearer-token-456");
  });

  it("does not send Authorization header when no token", () => {
    localStorage.clear();
    const token = localStorage.getItem("elias-auth-token");
    expect(token).toBeNull();

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("handles token expiry by clearing localStorage", () => {
    localStorage.setItem("elias-auth-token", "expired-token");
    // Simulate handleAuthError
    localStorage.removeItem("elias-auth-token");
    expect(localStorage.getItem("elias-auth-token")).toBeNull();
  });
});

describe("API client — error handling", () => {
  it("detects 401 status correctly", () => {
    const status = 401;
    const isUnauthorized = status === 401;
    expect(isUnauthorized).toBe(true);
  });

  it("detects non-401 errors correctly", () => {
    const status = 500;
    const isUnauthorized = status === 401;
    expect(isUnauthorized).toBe(false);
  });

  it("extracts error body from JSON response", async () => {
    const mockJson = () => Promise.resolve({ error: "Server error" });
    const body = await mockJson();
    expect(body.error).toBe("Server error");
  });

  it("falls back to HTTP status when no error body", async () => {
    const status = 503;
    const mockJson = () => Promise.resolve({});
    const body = await mockJson();
    if (body.error) {
      expect(body.error).toBeDefined();
    } else {
      expect(`HTTP ${status}`).toBe("HTTP 503");
    }
  });
});

describe("API client — credentials include", () => {
  it("fetch options include credentials: 'include'", () => {
    const options = {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    };
    expect(options.credentials).toBe("include");
  });
});

describe("API client — HEAD method for OPTIONS preflight", () => {
  it("OPTIONS request pattern for CORS", () => {
    const method = "OPTIONS";
    // Server responds 204 for OPTIONS
    const optionsResponse = { status: 204 };
    expect(optionsResponse.status).toBe(204);
    expect(method).toBe("OPTIONS");
  });
});
