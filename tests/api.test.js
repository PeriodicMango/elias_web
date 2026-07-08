// ---------------------------------------------------------------------------
// API client tests — tests the real api.js module
// @vitest-environment jsdom
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("API client — request methods", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("getJSON sends GET with auth headers and credentials", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "ok" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getJSON } = await import("../../app/frontend/js/api.js");
    const result = await getJSON("/api/test");

    expect(result).toEqual({ data: "ok" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/test");
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("include");
  });

  it("postJSON sends POST with stringified body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { postJSON } = await import("../../app/frontend/js/api.js");
    await postJSON("/api/test", { key: "value" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe('{"key":"value"}');
  });

  it("putJSON sends PUT", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { putJSON } = await import("../../app/frontend/js/api.js");
    await putJSON("/api/test", { x: 1 });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("PUT");
  });

  it("deleteJSON sends DELETE", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { deleteJSON } = await import("../../app/frontend/js/api.js");
    await deleteJSON("/api/test", {});

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("DELETE");
  });

  it("handles 401 by calling handleAuthError and throwing", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);
    localStorage.setItem("elias-auth-token", "expired");

    const { getJSON } = await import("../../app/frontend/js/api.js");

    await expect(getJSON("/api/test")).rejects.toThrow("Unauthorized");
    // Should have cleared the token
    expect(localStorage.getItem("elias-auth-token")).toBeNull();
  });

  it("throws parsed error body for non-401 non-ok responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getJSON } = await import("../../app/frontend/js/api.js");

    await expect(getJSON("/api/test")).rejects.toThrow("Server error");
  });

  it("falls back to HTTP status string when no error body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getJSON } = await import("../../app/frontend/js/api.js");

    await expect(getJSON("/api/test")).rejects.toThrow("HTTP 503");
  });

  it("sends Bearer token from localStorage", async () => {
    localStorage.setItem("elias-auth-token", "my-token-123");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { getJSON } = await import("../../app/frontend/js/api.js");
    await getJSON("/api/test");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer my-token-123");
  });
});
