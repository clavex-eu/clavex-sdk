/**
 * @clavex/sdk — HttpClient unit tests
 *
 * Uses the `fetch` override in ClientOptions to inject a mock so no
 * network requests are made. Covers:
 *   - bearer token injection
 *   - auto-login deduplication
 *   - error mapping (ClavexError, isNotFound)
 *   - JSON / 204 / non-JSON responses
 *   - HTTP verb helpers (get/post/put/patch/delete)
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { HttpClient, ClavexError } from "../client.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

type FetchLike = typeof fetch;

/** Build a fetch mock that always returns the given status + JSON body. */
function mockFetch(status: number, body: unknown, ct = "application/json"): jest.Mock<FetchLike> {
  return jest.fn(async () => {
    const text = JSON.stringify(body);
    return new Response(text, {
      status,
      headers: { "Content-Type": ct },
    });
  }) as jest.Mock<FetchLike>;
}

/** Build a fetch mock that returns 204 No Content. */
function mock204(): jest.Mock<FetchLike> {
  return jest.fn(async () => new Response(null, { status: 204 })) as jest.Mock<FetchLike>;
}

const BASE = "https://id.example.com";
const TOKEN = "test-jwt";
const ORG = "550e8400-e29b-41d4-a716-446655440000";

// ── ClavexError ───────────────────────────────────────────────────────────────

describe("ClavexError", () => {
  it("carries status and body", () => {
    const err = new ClavexError(403, { error: "forbidden" }, "forbidden");
    expect(err.status).toBe(403);
    expect(err.body).toEqual({ error: "forbidden" });
    expect(err.name).toBe("ClavexError");
  });

  it("isNotFound() returns true only for 404", () => {
    expect(new ClavexError(404, {}, "not found").isNotFound()).toBe(true);
    expect(new ClavexError(403, {}, "forbidden").isNotFound()).toBe(false);
  });
});

// ── Request basics ────────────────────────────────────────────────────────────

describe("HttpClient.request", () => {
  it("sends Authorization header when token is set", async () => {
    const fetch = mockFetch(200, { ok: true });
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await c.get("/some/path");
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TOKEN}`);
  });

  it("sends request to correct URL", async () => {
    const fetch = mockFetch(200, {});
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await c.get("/api/v1/test");
    const [url] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/v1/test`);
  });

  it("strips trailing slash from baseURL", async () => {
    const fetch = mockFetch(200, {});
    const c = new HttpClient(`${BASE}/`, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await c.get("/ping");
    const [url] = (fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe(`${BASE}/ping`);
  });

  it("returns undefined for 204 No Content", async () => {
    const fetch = mock204();
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    const result = await c.delete("/some/path");
    expect(result).toBeUndefined();
  });

  it("throws ClavexError for 4xx responses", async () => {
    const fetch = mockFetch(403, { error: "forbidden" });
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(c.get("/admin")).rejects.toBeInstanceOf(ClavexError);
  });

  it("throws ClavexError with correct status for 404", async () => {
    const fetch = mockFetch(404, { error: "not found" });
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    try {
      await c.get("/missing");
      throw new Error("should have thrown");
    } catch (e) {
      if ((e as Error).message === "should have thrown") throw e;
      expect(e instanceof ClavexError).toBe(true);
      expect((e as ClavexError).status).toBe(404);
      expect((e as ClavexError).isNotFound()).toBe(true);
    }
  });

  it("handles non-JSON error responses gracefully", async () => {
    const fetch = mockFetch(500, "Internal Server Error", "text/plain");
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(c.get("/boom")).rejects.toBeInstanceOf(ClavexError);
  });

  it("serialises request body as JSON", async () => {
    const fetch = mockFetch(200, {});
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await c.post("/api/v1/things", { name: "test", value: 42 });
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ name: "test", value: 42 });
  });

  it("sets Content-Type: application/json", async () => {
    const fetch = mockFetch(200, {});
    const c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await c.post("/api/v1/things", {});
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});

// ── HTTP verb helpers ─────────────────────────────────────────────────────────

describe("HttpClient verb helpers", () => {
  let fetch: jest.Mock<FetchLike>;
  let c: HttpClient;

  beforeEach(() => {
    fetch = mockFetch(200, { result: "ok" });
    c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
  });

  it("get() uses GET method", async () => {
    await c.get("/path");
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
  });

  it("post() uses POST method", async () => {
    await c.post("/path", {});
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
  });

  it("put() uses PUT method", async () => {
    await c.put("/path", {});
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
  });

  it("patch() uses PATCH method", async () => {
    await c.patch("/path", {});
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });

  it("delete() uses DELETE method", async () => {
    fetch = mock204();
    c = new HttpClient(BASE, { token: TOKEN, fetch: fetch as unknown as typeof globalThis.fetch });
    await c.delete("/path");
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

// ── orgPath helper ────────────────────────────────────────────────────────────

describe("HttpClient.orgPath", () => {
  it("produces /api/v1/organizations/:id<suffix>", () => {
    const c = new HttpClient(BASE, { token: TOKEN });
    expect(c.orgPath(ORG, "/users")).toBe(`/api/v1/organizations/${ORG}/users`);
    expect(c.orgPath(ORG, "/clients/app-id")).toBe(`/api/v1/organizations/${ORG}/clients/app-id`);
  });
});

// ── Auto-login ────────────────────────────────────────────────────────────────

describe("HttpClient auto-login", () => {
  it("calls login once and deduplicates concurrent calls", async () => {
    let loginCallCount = 0;
    const fetchMock = jest.fn(async (url: string) => {
      if (typeof url === "string" && url.endsWith("/auth/login")) {
        loginCallCount++;
        return new Response(JSON.stringify({ token: "auto-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as jest.Mock<FetchLike>;

    const c = new HttpClient(BASE, {
      email: "admin@example.com",
      password: "secret",
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });

    // Fire 3 concurrent requests — only 1 login should happen.
    await Promise.all([c.get("/api/v1/orgs"), c.get("/api/v1/orgs"), c.get("/api/v1/orgs")]);
    expect(loginCallCount).toBe(1);
  });

  it("setToken() overrides auto-login", async () => {
    const fetch = mockFetch(200, {});
    const c = new HttpClient(BASE, { fetch: fetch as unknown as typeof globalThis.fetch });
    c.setToken("manually-set-token");
    await c.get("/api/v1/test");
    const [, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer manually-set-token");
  });
});
