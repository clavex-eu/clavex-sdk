/**
 * @clavex/nextauth-provider — unit tests
 *
 * Tests ClavexProvider() factory, profile mapping, and clavexCallbacks
 * without importing next-auth at runtime (pure function logic only).
 */

import { describe, it, expect } from "@jest/globals";
import { ClavexProvider, clavexCallbacks, ClavexTokenClaims } from "../index.js";

const BASE_CONFIG = {
  issuer: "https://id.example.com/acme",
  clientId: "my-client",
  clientSecret: "my-secret",
};

// ── ClavexProvider factory ────────────────────────────────────────────────────

describe("ClavexProvider()", () => {
  it("returns id='clavex' and type='oidc'", () => {
    const p = ClavexProvider(BASE_CONFIG);
    expect(p.id).toBe("clavex");
    expect(p.type).toBe("oidc");
  });

  it("default name is 'Clavex'", () => {
    const p = ClavexProvider(BASE_CONFIG);
    expect(p.name).toBe("Clavex");
  });

  it("custom name is forwarded", () => {
    const p = ClavexProvider({ ...BASE_CONFIG, name: "Acme SSO" });
    expect(p.name).toBe("Acme SSO");
  });

  it("normalizes trailing slash on issuer", () => {
    const p = ClavexProvider({ ...BASE_CONFIG, issuer: "https://id.example.com/acme/" });
    expect(p.issuer).toBe("https://id.example.com/acme");
    expect(p.wellKnown).toBe("https://id.example.com/acme/.well-known/openid-configuration");
  });

  it("sets wellKnown to issuer + /.well-known/openid-configuration", () => {
    const p = ClavexProvider(BASE_CONFIG);
    expect(p.wellKnown).toBe("https://id.example.com/acme/.well-known/openid-configuration");
  });

  it("passes clientId and clientSecret through", () => {
    const p = ClavexProvider(BASE_CONFIG);
    expect(p.clientId).toBe("my-client");
    expect(p.clientSecret).toBe("my-secret");
  });

  it("default scope is 'openid email profile'", () => {
    const p = ClavexProvider(BASE_CONFIG);
    expect(p.authorization.params.scope).toBe("openid email profile");
  });

  it("custom scope is forwarded", () => {
    const p = ClavexProvider({ ...BASE_CONFIG, scope: "openid email profile offline_access" });
    expect(p.authorization.params.scope).toBe("openid email profile offline_access");
  });

  it("extra authorization params are merged", () => {
    const p = ClavexProvider({ ...BASE_CONFIG, authorization: { acr_values: "2" } });
    expect((p.authorization.params as Record<string, string>).acr_values).toBe("2");
    expect(p.authorization.params.scope).toBe("openid email profile");
  });

  it("checks includes pkce, state, nonce", () => {
    const p = ClavexProvider(BASE_CONFIG);
    expect(p.checks).toContain("pkce");
    expect(p.checks).toContain("state");
    expect(p.checks).toContain("nonce");
  });
});

// ── profile() mapping ─────────────────────────────────────────────────────────

describe("ClavexProvider profile()", () => {
  const provider = ClavexProvider(BASE_CONFIG);

  it("maps sub → id", () => {
    const u = provider.profile({ sub: "user-001" });
    expect(u.id).toBe("user-001");
  });

  it("maps email claim", () => {
    const u = provider.profile({ sub: "user-001", email: "alice@example.com" });
    expect(u.email).toBe("alice@example.com");
  });

  it("email_verified: true → emailVerified is a Date", () => {
    const u = provider.profile({ sub: "s", email_verified: true });
    expect(u.emailVerified).toBeInstanceOf(Date);
  });

  it("email_verified: false → emailVerified is null", () => {
    const u = provider.profile({ sub: "s", email_verified: false });
    expect(u.emailVerified).toBeNull();
  });

  it("email_verified absent → emailVerified is null", () => {
    const u = provider.profile({ sub: "s" });
    expect(u.emailVerified).toBeNull();
  });

  it("maps name claim directly", () => {
    const u = provider.profile({ sub: "s", name: "Alice Smith" });
    expect(u.name).toBe("Alice Smith");
  });

  it("builds name from given_name + family_name when name absent", () => {
    const u = provider.profile({ sub: "s", given_name: "Alice", family_name: "Smith" });
    expect(u.name).toBe("Alice Smith");
  });

  it("name is null when no name claims present", () => {
    const u = provider.profile({ sub: "s" });
    expect(u.name).toBeNull();
  });

  it("maps picture → image", () => {
    const u = provider.profile({ sub: "s", picture: "https://cdn.example.com/avatar.png" });
    expect(u.image).toBe("https://cdn.example.com/avatar.png");
  });

  it("image is null when picture absent", () => {
    const u = provider.profile({ sub: "s" });
    expect(u.image).toBeNull();
  });

  it("maps org_id → orgId", () => {
    const u = provider.profile({ sub: "s", org_id: "org-uuid-001" });
    expect(u.orgId).toBe("org-uuid-001");
  });

  it("orgId is null when org_id absent", () => {
    const u = provider.profile({ sub: "s" });
    expect(u.orgId).toBeNull();
  });

  it("maps roles array", () => {
    const u = provider.profile({ sub: "s", roles: ["admin", "viewer"] });
    expect(u.roles).toEqual(["admin", "viewer"]);
  });

  it("roles defaults to empty array when absent", () => {
    const u = provider.profile({ sub: "s" });
    expect(u.roles).toEqual([]);
  });

  it("maps groups array", () => {
    const u = provider.profile({ sub: "s", groups: ["eng", "ops"] });
    expect(u.groups).toEqual(["eng", "ops"]);
  });

  it("maps acr claim", () => {
    const u = provider.profile({ sub: "s", acr: "2" });
    expect(u.acr).toBe("2");
  });

  it("acr is null when absent", () => {
    const u = provider.profile({ sub: "s" });
    expect(u.acr).toBeNull();
  });
});

// ── clavexCallbacks.jwt() ─────────────────────────────────────────────────────

describe("clavexCallbacks.jwt()", () => {
  it("copies Clavex fields to token on initial sign-in", () => {
    const token: Record<string, unknown> = { sub: "user-001" };
    const user = { orgId: "org-001", roles: ["admin"], groups: ["eng"], acr: "2" };
    const account = { provider: "clavex" };
    const result = clavexCallbacks.jwt({ token, user, account });
    expect(result.orgId).toBe("org-001");
    expect(result.roles).toEqual(["admin"]);
    expect(result.groups).toEqual(["eng"]);
    expect(result.acr).toBe("2");
  });

  it("leaves token unchanged on subsequent calls (no account)", () => {
    const token: Record<string, unknown> = { sub: "user-001", orgId: "org-001" };
    const result = clavexCallbacks.jwt({ token, user: null, account: null });
    expect(result.orgId).toBe("org-001");
    expect(result.roles).toBeUndefined();
  });

  it("leaves token unchanged when account is present but user is null", () => {
    const token: Record<string, unknown> = { sub: "user-001" };
    const result = clavexCallbacks.jwt({ token, user: null, account: { provider: "clavex" } });
    expect(result.orgId).toBeUndefined();
  });
});

// ── clavexCallbacks.session() ─────────────────────────────────────────────────

describe("clavexCallbacks.session()", () => {
  it("copies Clavex claims from token to session.user", () => {
    const session: Record<string, unknown> = { user: { name: "Alice" } };
    const token: Record<string, unknown> = {
      orgId: "org-001",
      roles: ["admin"],
      groups: ["eng"],
      acr: "2",
    };
    const result = clavexCallbacks.session({ session, token });
    const user = result.user as Record<string, unknown>;
    expect(user.orgId).toBe("org-001");
    expect(user.roles).toEqual(["admin"]);
    expect(user.groups).toEqual(["eng"]);
    expect(user.acr).toBe("2");
    expect(user.name).toBe("Alice");
  });

  it("handles missing session.user gracefully", () => {
    const session: Record<string, unknown> = {};
    const token: Record<string, unknown> = { orgId: "org-001", roles: [], groups: [], acr: null };
    const result = clavexCallbacks.session({ session, token });
    const user = result.user as Record<string, unknown>;
    expect(user.orgId).toBe("org-001");
  });
});
