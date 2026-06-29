/**
 * @clavex/react — unit tests
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { waitFor } from "@testing-library/dom";
import React from "react";
import { ClavexProvider } from "../src/ClavexProvider.js";
import { useUser, useOrg, useSignIn, useSignOut, useAuth, useAccessToken } from "../src/hooks.js";
import {
  generateCodeVerifier,
  computeCodeChallenge,
  generateState,
  decodeJwtPayload,
  base64urlEncode,
  base64urlDecode,
  orgSlugFromIssuer,
  baseUrlFromIssuer,
} from "../src/oidc.js";
import { TokenStore } from "../src/storage.js";

// ── Mock helpers ──────────────────────────────────────────────────────────────

const TEST_ISSUER = "https://id.example.com/acme";
const TEST_CLIENT_ID = "spa-client-id";
const TEST_REDIRECT_URI = "https://app.example.com/callback";

// Minimal valid JWT (header.payload.signature — NOT a real signature)
function makeJwt(payload: Record<string, unknown>): string {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${header}.${body}.fakesig`;
}

const MOCK_USER_CLAIMS = {
  sub: "user-123",
  email: "alice@example.com",
  given_name: "Alice",
  family_name: "Smith",
  org_id: "org-456",
  org_slug: "acme",
  roles: ["admin"],
  groups: ["engineers"],
};

const MOCK_TOKENS = {
  accessToken: makeJwt({ sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 }),
  idToken: makeJwt(MOCK_USER_CLAIMS),
  refreshToken: "rt-token-abc",
  expiresAt: Date.now() + 3600 * 1000,
};

// ── OIDC utility tests ────────────────────────────────────────────────────────

describe("PKCE utilities", () => {
  it("generateCodeVerifier — produces 43-char base64url string", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("generateCodeVerifier — each call produces a unique value", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it("computeCodeChallenge — is deterministic for same verifier", async () => {
    const v = generateCodeVerifier();
    const c1 = await computeCodeChallenge(v);
    const c2 = await computeCodeChallenge(v);
    expect(c1).toBe(c2);
  });

  it("computeCodeChallenge — differs from verifier", async () => {
    const v = generateCodeVerifier();
    const c = await computeCodeChallenge(v);
    expect(c).not.toBe(v);
  });

  it("generateState — produces unique values", () => {
    expect(generateState()).not.toBe(generateState());
  });
});

describe("base64url helpers", () => {
  it("round-trips ASCII strings", () => {
    const input = "hello world 123";
    const encoded = base64urlEncode(new TextEncoder().encode(input));
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    const decoded = new TextDecoder().decode(base64urlDecode(encoded));
    expect(decoded).toBe(input);
  });

  it("round-trips binary data", () => {
    const input = new Uint8Array([0x00, 0xff, 0x80, 0x01, 0xfe]);
    const encoded = base64urlEncode(input);
    const decoded = base64urlDecode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });
});

describe("JWT helpers", () => {
  it("decodeJwtPayload — extracts claims", () => {
    const jwt = makeJwt(MOCK_USER_CLAIMS);
    const claims = decodeJwtPayload(jwt);
    expect(claims["sub"]).toBe("user-123");
    expect(claims["email"]).toBe("alice@example.com");
  });

  it("decodeJwtPayload — throws on malformed JWT", () => {
    expect(() => decodeJwtPayload("not.a.jwt.with.too.many.parts")).toThrow();
    expect(() => decodeJwtPayload("onlyone")).toThrow();
  });
});

describe("Issuer URL utilities", () => {
  it("orgSlugFromIssuer — extracts last segment", () => {
    expect(orgSlugFromIssuer("https://id.example.com/acme")).toBe("acme");
    expect(orgSlugFromIssuer("https://id.example.com/eu/acme")).toBe("acme");
  });

  it("baseUrlFromIssuer — strips org slug", () => {
    expect(baseUrlFromIssuer("https://id.example.com/acme")).toBe("https://id.example.com");
    expect(baseUrlFromIssuer("https://id.example.com/eu/acme")).toBe("https://id.example.com/eu");
  });
});

// ── TokenStore tests ──────────────────────────────────────────────────────────

describe("TokenStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("memory strategy — stores and retrieves tokens", () => {
    const store = new TokenStore("memory");
    store.set(MOCK_TOKENS);
    const got = store.get();
    expect(got?.accessToken).toBe(MOCK_TOKENS.accessToken);
    expect(got?.refreshToken).toBe(MOCK_TOKENS.refreshToken);
  });

  it("memory strategy — persists refresh token to sessionStorage", () => {
    const store = new TokenStore("memory");
    store.set(MOCK_TOKENS);
    const rt = store.getStoredRefreshToken();
    expect(rt).toBe(MOCK_TOKENS.refreshToken);
  });

  it("memory strategy — clear() removes tokens", () => {
    const store = new TokenStore("memory");
    store.set(MOCK_TOKENS);
    store.clear();
    expect(store.get()).toBeNull();
    expect(store.getStoredRefreshToken()).toBeNull();
  });

  it("sessionStorage strategy — survives re-instantiation", () => {
    const store1 = new TokenStore("sessionStorage");
    store1.set(MOCK_TOKENS);

    const store2 = new TokenStore("sessionStorage");
    const got = store2.get();
    expect(got?.accessToken).toBe(MOCK_TOKENS.accessToken);
  });
});

// ── Provider + hook integration tests ────────────────────────────────────────

type ProviderProps = { children: React.ReactNode };

function makeWrapper(overrides: Partial<React.ComponentProps<typeof ClavexProvider>> = {}) {
  return function Wrapper({ children }: ProviderProps) {
    return React.createElement(ClavexProvider, {
      issuer: TEST_ISSUER,
      clientId: TEST_CLIENT_ID,
      redirectUri: TEST_REDIRECT_URI,
      ...overrides,
      children,
    });
  };
}

describe("useUser", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.resetAllMocks();

    // Mock discovery fetch + no existing session
    global.fetch = (() => Promise.reject(new Error("network disabled in tests"))) as unknown as typeof fetch;
  });

  it("resolves to unauthenticated when no session exists", async () => {
    const { result } = renderHook(() => useUser(), { wrapper: makeWrapper() });
    await waitFor(() => result.current.isLoaded === true);
    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });
});

describe("useOrg", () => {
  beforeEach(() => {
    sessionStorage.clear();
    global.fetch = (() => Promise.reject(new Error("network disabled"))) as unknown as typeof fetch;
  });

  it("resolves to null org when not authenticated", async () => {
    const { result } = renderHook(() => useOrg(), { wrapper: makeWrapper() });
    await waitFor(() => result.current.isLoaded === true);
    expect(result.current.org).toBeNull();
  });
});

describe("useAccessToken", () => {
  beforeEach(() => {
    sessionStorage.clear();
    global.fetch = (() => Promise.reject(new Error("network disabled"))) as unknown as typeof fetch;
  });

  it("returns null when unauthenticated", async () => {
    const { result } = renderHook(() => useAccessToken(), { wrapper: makeWrapper() });
    await waitFor(() => result.current === null);
    expect(result.current).toBeNull();
  });
});

describe("useSignIn — redirects browser", () => {
  beforeEach(() => {
    sessionStorage.clear();

    const mockDiscovery = {
      issuer: TEST_ISSUER,
      authorization_endpoint: "https://id.example.com/acme/authorize",
      token_endpoint: "https://id.example.com/acme/token",
      jwks_uri: "https://id.example.com/acme/.well-known/jwks.json",
      response_types_supported: ["code"],
    };
    global.fetch = (() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockDiscovery) })) as unknown as typeof fetch;

    const assignSpy = jest.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });
  });

  it("signIn() calls window.location.assign with authorization URL", async () => {
    const { result } = renderHook(() => useSignIn(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.signIn();
    });

    const assignSpy = window.location.assign as jest.Mock;
    expect(assignSpy).toHaveBeenCalledTimes(1);
    const assignedUrl = (assignSpy.mock.calls[0] as unknown[])[0] as string;
    expect(assignedUrl).toContain("https://id.example.com/acme/authorize");
    expect(assignedUrl).toContain("code_challenge_method=S256");
    expect(assignedUrl).toContain(`client_id=${TEST_CLIENT_ID}`);
    expect(assignedUrl).toContain(`redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}`);
  });
});

describe("ClavexProvider — throws when context missing", () => {
  it("useUser() throws without provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useUser());
    }).toThrow("No <ClavexProvider> found");
    spy.mockRestore();
  });

  it("useAuth() throws without provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow();
    spy.mockRestore();
  });
});
