/**
 * @clavex/sdk — Service class tests
 *
 * Each test mounts a mock fetch, calls one service method, and verifies:
 *   - correct HTTP method + URL path
 *   - correct request body (for write operations)
 *   - response deserialization
 */

import { describe, it, expect, jest } from "@jest/globals";
import { HttpClient } from "../client.js";
import { UserService } from "../services-core.js";
import { OrgService } from "../services-core.js";
import { ClientService } from "../services-core.js";
import {
  ClientScopeService,
  ProtocolMapperService,
  MFAService,
  AuditService,
  SCIMService,
  CaptchaService,
  SessionService,
} from "../services-core.js";
import {
  PolicyService,
  SSFService,
  AuthZenService,
  APIKeyService,
  CrossOrgTrustService,
  UsageService,
  CIBAService,
  LoginHistoryService,
  RateLimitService,
  DeviceTrustService,
} from "../services-extended.js";

// ── Mock factory ──────────────────────────────────────────────────────────────

type FetchLike = typeof fetch;

function mockFetch(status: number, body: unknown): jest.Mock<FetchLike> {
  return jest.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as jest.Mock<FetchLike>;
}

function mock204(): jest.Mock<FetchLike> {
  return jest.fn(async () => new Response(null, { status: 204 })) as jest.Mock<FetchLike>;
}

function httpClient(fetch: jest.Mock<FetchLike>): HttpClient {
  return new HttpClient("https://id.example.com", {
    token: "test-token",
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
}

const ORG = "org-uuid-001";
const USER_ID = "user-uuid-001";
const CLIENT_ID = "client-uuid-001";
const RULE_ID = "rule-uuid-001";
const STREAM_ID = "stream-uuid-001";
const KEY_ID = "key-uuid-001";
const TRUST_ID = "trust-uuid-001";

// ── OrgService ────────────────────────────────────────────────────────────────

describe("OrgService", () => {
  it("list() GET /api/v1/organizations", async () => {
    const f = mockFetch(200, [{ id: ORG, slug: "acme", name: "ACME" }]);
    const svc = new OrgService(httpClient(f));
    const orgs = await svc.list();
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.id).toBe(ORG);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/organizations");
    expect(init.method).toBe("GET");
  });

  it("get() GET /api/v1/organizations/:id", async () => {
    const f = mockFetch(200, { id: ORG, slug: "acme" });
    const svc = new OrgService(httpClient(f));
    const org = await svc.get(ORG);
    expect(org.id).toBe(ORG);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/organizations/${ORG}`);
  });

  it("create() POST with correct body", async () => {
    const f = mockFetch(200, { id: ORG, slug: "acme", name: "ACME Corp" });
    const svc = new OrgService(httpClient(f));
    await svc.create({ name: "ACME Corp", slug: "acme" });
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "ACME Corp", slug: "acme" });
  });

  it("delete() sends DELETE 204", async () => {
    const f = mock204();
    const svc = new OrgService(httpClient(f));
    await svc.delete(ORG);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url).toContain(`/organizations/${ORG}`);
  });
});

// ── UserService ───────────────────────────────────────────────────────────────

describe("UserService", () => {
  const user = { id: USER_ID, org_id: ORG, email: "alice@example.com", is_active: true };

  it("list() includes org in path", async () => {
    const f = mockFetch(200, [user]);
    const svc = new UserService(httpClient(f));
    const users = await svc.list(ORG);
    expect(users).toHaveLength(1);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/organizations/${ORG}/users`);
  });

  it("get() returns correct user", async () => {
    const f = mockFetch(200, user);
    const svc = new UserService(httpClient(f));
    const u = await svc.get(ORG, USER_ID);
    expect(u.id).toBe(USER_ID);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/users/${USER_ID}`);
  });

  it("create() sends POST with email + password", async () => {
    const f = mockFetch(200, user);
    const svc = new UserService(httpClient(f));
    await svc.create(ORG, { email: "alice@example.com", password: "Secret1!" });
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe("alice@example.com");
  });

  it("delete() sends DELETE", async () => {
    const f = mock204();
    const svc = new UserService(httpClient(f));
    await svc.delete(ORG, USER_ID);
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

// ── ClientService ─────────────────────────────────────────────────────────────

describe("ClientService", () => {
  const client = {
    client_id: CLIENT_ID,
    org_id: ORG,
    name: "My App",
    redirect_uris: ["https://app.example.com/callback"],
    is_public: false,
    is_active: true,
  };

  it("list() returns array", async () => {
    const f = mockFetch(200, [client]);
    const svc = new ClientService(httpClient(f));
    const clients = await svc.list(ORG);
    expect(clients).toHaveLength(1);
    expect(clients[0]?.client_id).toBe(CLIENT_ID);
  });

  it("get() uses client_id in path", async () => {
    const f = mockFetch(200, client);
    const svc = new ClientService(httpClient(f));
    const c = await svc.get(ORG, CLIENT_ID);
    expect(c.name).toBe("My App");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/clients/${CLIENT_ID}`);
  });

  it("create() sends POST and returns client + secret", async () => {
    const f = mockFetch(200, { client, client_secret: "super-secret" });
    const svc = new ClientService(httpClient(f));
    const resp = await svc.create(ORG, {
      name: "My App",
      redirect_uris: ["https://app.example.com/callback"],
      grant_types: ["authorization_code"],
    });
    expect(resp.client_secret).toBe("super-secret");
  });

  it("rotateSecret() sends POST to /rotate-secret", async () => {
    const f = mockFetch(200, { client, client_secret: "new-secret" });
    const svc = new ClientService(httpClient(f));
    await svc.rotateSecret(ORG, CLIENT_ID);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("rotate-secret");
  });

  it("delete() sends DELETE", async () => {
    const f = mock204();
    const svc = new ClientService(httpClient(f));
    await svc.delete(ORG, CLIENT_ID);
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

// ── PolicyService ─────────────────────────────────────────────────────────────

describe("PolicyService", () => {
  const rule = { id: RULE_ID, org_id: ORG, name: "block-ru", priority: 10, action: "deny", enabled: true };

  it("list() GET auth-policies", async () => {
    const f = mockFetch(200, [rule]);
    const svc = new PolicyService(httpClient(f));
    const rules = await svc.list(ORG);
    expect(rules[0]?.id).toBe(RULE_ID);
  });

  it("create() POST with action in body", async () => {
    const f = mockFetch(200, rule);
    const svc = new PolicyService(httpClient(f));
    await svc.create(ORG, { name: "block-ru", action: "deny", priority: 10 });
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).action).toBe("deny");
  });

  it("update() PUT to /auth-policies/:id", async () => {
    const updated = { ...rule, action: "allow" };
    const f = mockFetch(200, updated);
    const svc = new PolicyService(httpClient(f));
    const r = await svc.update(ORG, RULE_ID, { action: "allow" });
    expect(r.action).toBe("allow");
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(url).toContain(RULE_ID);
  });

  it("delete() DELETE returns void", async () => {
    const f = mock204();
    const svc = new PolicyService(httpClient(f));
    await svc.delete(ORG, RULE_ID);
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });

  it("simulate() POST to /simulate", async () => {
    const f = mockFetch(200, { outcome: { action: "allow" }, mfa_required: false });
    const svc = new PolicyService(httpClient(f));
    const result = await svc.simulate(ORG, { user_id: USER_ID, ip_address: "1.2.3.4" });
    expect(result.outcome.action).toBe("allow");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("simulate");
  });
});

// ── SSFService ────────────────────────────────────────────────────────────────

describe("SSFService", () => {
  const stream = {
    id: STREAM_ID,
    org_id: ORG,
    delivery_method: "https://schemas.openid.net/secevent/risc/delivery-method/push",
    event_types: ["https://schemas.openid.net/secevent/risc/event-type/session-revoked"],
    status: "enabled",
  };

  it("create() returns stream with id", async () => {
    const f = mockFetch(200, stream);
    const svc = new SSFService(httpClient(f));
    const s = await svc.create(ORG, {
      event_types: stream.event_types,
      delivery_method: stream.delivery_method,
    });
    expect(s.id).toBe(STREAM_ID);
  });

  it("list() GET /ssf/streams", async () => {
    const f = mockFetch(200, [stream]);
    const svc = new SSFService(httpClient(f));
    const streams = await svc.list(ORG);
    expect(streams).toHaveLength(1);
  });

  it("get() includes stream id in path", async () => {
    const f = mockFetch(200, stream);
    const svc = new SSFService(httpClient(f));
    await svc.get(ORG, STREAM_ID);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(STREAM_ID);
  });

  it("update() PATCH stream status", async () => {
    const f = mockFetch(200, { ...stream, status: "paused" });
    const svc = new SSFService(httpClient(f));
    const s = await svc.update(ORG, STREAM_ID, { status: "paused" });
    expect(s.status).toBe("paused");
  });

  it("delete() sends DELETE 204", async () => {
    const f = mock204();
    const svc = new SSFService(httpClient(f));
    await svc.delete(ORG, STREAM_ID);
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });

  it("verify() posts to /verify", async () => {
    const f = mock204();
    const svc = new SSFService(httpClient(f));
    await svc.verify(ORG, STREAM_ID);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("verify");
  });
});

// ── AuthZenService ────────────────────────────────────────────────────────────

describe("AuthZenService", () => {
  const orgSlug = "acme";
  const evalReq = {
    subject: { type: "user" as const, id: "alice@example.com" },
    resource: { type: "invoice", id: "inv-001" },
    action: { name: "read" },
    context: {},
  };

  it("evaluate() posts to /access/v1/evaluation", async () => {
    const f = mockFetch(200, { decision: true, context: {} });
    const svc = new AuthZenService(httpClient(f));
    const resp = await svc.evaluate(orgSlug, evalReq);
    expect(resp.decision).toBe(true);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/access/v1/evaluation");
  });

  it("batchEvaluate() includes evaluations array in body", async () => {
    const f = mockFetch(200, { evaluations: [{ decision: true }, { decision: false }] });
    const svc = new AuthZenService(httpClient(f));
    await svc.batchEvaluate(orgSlug, [evalReq, evalReq]);
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.evaluations).toHaveLength(2);
  });

  it("subjectAttributes() GET with encoded subject", async () => {
    const f = mockFetch(200, { sub: "alice", roles: ["admin"] });
    const svc = new AuthZenService(httpClient(f));
    await svc.subjectAttributes(orgSlug, "alice@example.com");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/access/v1/subject/");
    expect(url).toContain("alice");
  });
});

// ── APIKeyService ─────────────────────────────────────────────────────────────

describe("APIKeyService", () => {
  const apiKey = { id: KEY_ID, name: "terraform", prefix: "cvx_sk_", expires_at: null };

  it("create() returns api_key + secret", async () => {
    const f = mockFetch(200, { api_key: apiKey, secret: "cvx_sk_supersecret" });
    const svc = new APIKeyService(httpClient(f));
    const res = await svc.create({ name: "terraform" });
    expect(res.secret).toBe("cvx_sk_supersecret");
    expect(res.api_key.id).toBe(KEY_ID);
  });

  it("list() GET /superadmin/api-keys", async () => {
    const f = mockFetch(200, [apiKey]);
    const svc = new APIKeyService(httpClient(f));
    const keys = await svc.list();
    expect(keys).toHaveLength(1);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/superadmin/api-keys");
  });

  it("revoke() sends DELETE", async () => {
    const f = mock204();
    const svc = new APIKeyService(httpClient(f));
    await svc.revoke(KEY_ID);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url).toContain(KEY_ID);
  });
});

// ── CrossOrgTrustService ──────────────────────────────────────────────────────

describe("CrossOrgTrustService", () => {
  const trust = {
    id: TRUST_ID,
    org_id: ORG,
    trusted_org_slug: "partner",
    trusted_org_id: "partner-uuid",
    allowed_scopes: ["openid"],
  };

  it("create() returns trust with id", async () => {
    const f = mockFetch(200, trust);
    const svc = new CrossOrgTrustService(httpClient(f));
    const t = await svc.create(ORG, { trusted_org_slug: "partner" });
    expect(t.id).toBe(TRUST_ID);
  });

  it("list() GET /cross-org-trusts", async () => {
    const f = mockFetch(200, [trust]);
    const svc = new CrossOrgTrustService(httpClient(f));
    const trusts = await svc.list(ORG);
    expect(trusts).toHaveLength(1);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("cross-org-trusts");
  });

  it("listInbound() GET /cross-org-trusts/inbound", async () => {
    const f = mockFetch(200, [trust]);
    const svc = new CrossOrgTrustService(httpClient(f));
    await svc.listInbound(ORG);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("inbound");
  });

  it("revoke() sends DELETE", async () => {
    const f = mock204();
    const svc = new CrossOrgTrustService(httpClient(f));
    await svc.revoke(ORG, TRUST_ID);
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

// ── UsageService ──────────────────────────────────────────────────────────────

describe("UsageService", () => {
  it("get() returns usage object", async () => {
    const usage = { mau: 1234, dau: 89, total_logins: 45678, logins_by_method: {} };
    const f = mockFetch(200, usage);
    const svc = new UsageService(httpClient(f));
    const result = await svc.get(ORG);
    expect(result.mau).toBe(1234);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/usage");
  });
});

// ── Fase 1 parity: newly added services ────────────────────────────────────────

describe("ClientScopeService", () => {
  it("list() GET /client-scopes", async () => {
    const f = mockFetch(200, [{ id: "sc-1", org_id: ORG, name: "profile", protocol: "openid-connect", is_default: false }]);
    const svc = new ClientScopeService(httpClient(f));
    const scopes = await svc.list(ORG);
    expect(scopes[0]?.id).toBe("sc-1");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/client-scopes");
  });

  it("assignToClient() PUT to /clients/:id/scopes/:sid", async () => {
    const f = mock204();
    const svc = new ClientScopeService(httpClient(f));
    await svc.assignToClient(ORG, CLIENT_ID, "sc-1");
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(url).toContain(`/clients/${CLIENT_ID}/scopes/sc-1`);
  });
});

describe("ProtocolMapperService", () => {
  it("create() POST to /clients/:id/mappers", async () => {
    const f = mockFetch(200, { id: "m-1", client_id: CLIENT_ID, name: "email", protocol: "openid-connect", mapper_type: "user-attribute" });
    const svc = new ProtocolMapperService(httpClient(f));
    await svc.create(ORG, CLIENT_ID, { name: "email", protocol: "openid-connect", mapper_type: "user-attribute" });
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain(`/clients/${CLIENT_ID}/mappers`);
  });
});

describe("MFAService", () => {
  it("list() GET /users/:id/mfa", async () => {
    const f = mockFetch(200, [{ id: "cr-1", user_id: USER_ID, type: "totp", name: "Authenticator", is_primary: true }]);
    const svc = new MFAService(httpClient(f));
    const creds = await svc.list(ORG, USER_ID);
    expect(creds[0]?.type).toBe("totp");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/users/${USER_ID}/mfa`);
  });
});

describe("AuditService", () => {
  it("list() GET /audit", async () => {
    const f = mockFetch(200, [{ id: "a-1", org_id: ORG, action: "user.create", created_at: "2026-01-01T00:00:00Z" }]);
    const svc = new AuditService(httpClient(f));
    const entries = await svc.list(ORG);
    expect(entries[0]?.action).toBe("user.create");
  });

  it("createSink() POST to /audit/sinks", async () => {
    const f = mockFetch(200, { id: "sink-1", org_id: ORG, type: "http", is_active: true, created_at: "2026-01-01T00:00:00Z" });
    const svc = new AuditService(httpClient(f));
    await svc.createSink(ORG, { type: "http", config: { url: "https://siem.example.com" } });
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain("/audit/sinks");
  });
});

describe("SCIMService", () => {
  it("createToken() POST returns plaintext token", async () => {
    const f = mockFetch(200, { token: "scim-secret", scim_token: { id: "t-1", org_id: ORG, name: "default", created_at: "2026-01-01T00:00:00Z" } });
    const svc = new SCIMService(httpClient(f));
    const res = await svc.createToken(ORG);
    expect(res.token).toBe("scim-secret");
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain("/scim/tokens");
  });
});

describe("CaptchaService", () => {
  it("put() PUT /captcha", async () => {
    const cfg = { org_id: ORG, provider: "turnstile", site_key: "key", is_active: true };
    const f = mockFetch(200, cfg);
    const svc = new CaptchaService(httpClient(f));
    const out = await svc.put(ORG, cfg);
    expect(out.provider).toBe("turnstile");
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
  });
});

describe("SessionService", () => {
  it("listByUser() GET /users/:id/sessions", async () => {
    const f = mockFetch(200, [{ id: "s-1", org_id: ORG, client_id: CLIENT_ID, scope: "openid", expires_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" }]);
    const svc = new SessionService(httpClient(f));
    const sessions = await svc.listByUser(ORG, USER_ID);
    expect(sessions).toHaveLength(1);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/users/${USER_ID}/sessions`);
  });

  it("revokeAllByUser() DELETE", async () => {
    const f = mock204();
    const svc = new SessionService(httpClient(f));
    await svc.revokeAllByUser(ORG, USER_ID);
    const [, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
  });
});

describe("LoginHistoryService", () => {
  it("listByOrg() GET with query params", async () => {
    const f = mockFetch(200, { items: [{ id: "lh-1", org_id: ORG, method: "password", success: true, created_at: "2026-01-01T00:00:00Z" }], has_more: false });
    const svc = new LoginHistoryService(httpClient(f));
    const page = await svc.listByOrg(ORG, { limit: 50 });
    expect(page.items).toHaveLength(1);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/login-history");
    expect(url).toContain("limit=50");
  });
});

describe("RateLimitService", () => {
  it("update() PUT /rate-limits", async () => {
    const cfg = { max_attempts_per_minute: 10, lockout_duration_seconds: 300 };
    const f = mockFetch(200, cfg);
    const svc = new RateLimitService(httpClient(f));
    const out = await svc.update(ORG, cfg);
    expect(out.max_attempts_per_minute).toBe(10);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(url).toContain("/rate-limits");
  });
});

describe("DeviceTrustService", () => {
  it("list() GET /users/:id/trusted-devices", async () => {
    const f = mockFetch(200, [{ id: "d-1", user_id: USER_ID, org_id: ORG, registered_at: "2026-01-01T00:00:00Z" }]);
    const svc = new DeviceTrustService(httpClient(f));
    const devices = await svc.list(ORG, USER_ID);
    expect(devices[0]?.id).toBe("d-1");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain(`/users/${USER_ID}/trusted-devices`);
  });
});

describe("CIBAService (admin parity)", () => {
  it("listPending() GET /ciba/pending", async () => {
    const f = mockFetch(200, [{ auth_req_id: "req-1", org_id: ORG, client_id: CLIENT_ID, status: "pending", scope: "openid", interval: 5, expires_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", user_id: null, binding_message: null, login_hint: null }]);
    const svc = new CIBAService(httpClient(f));
    const pending = await svc.listPending(ORG);
    expect(pending[0]?.auth_req_id).toBe("req-1");
  });

  it("approve() POST /ciba/:id/approve", async () => {
    const f = mockFetch(200, { status: "approved" });
    const svc = new CIBAService(httpClient(f));
    const res = await svc.approve(ORG, "req-1");
    expect(res.status).toBe("approved");
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain("/ciba/req-1/approve");
  });

  it("getNotificationConfig() GET /ciba/notification-config", async () => {
    const f = mockFetch(200, { org_id: ORG, webhook_url: null, webhook_secret_set: false, webhook_headers: {}, email_enabled: true, sms_enabled: false, base_url: null, push_enabled: false, apns_key_set: false, apns_key_id: null, apns_team_id: null, apns_bundle_id: null, apns_production: false, fcm_service_account_set: false });
    const svc = new CIBAService(httpClient(f));
    const cfg = await svc.getNotificationConfig(ORG);
    expect(cfg.email_enabled).toBe(true);
  });
});

// ── Fase 2: EUDI services ──────────────────────────────────────────────────────

import { OID4VCIService, OID4VPService, MdocService, FederationService } from "../services-eudi.js";

describe("OID4VCIService", () => {
  it("listConfigs() GET /oid4vci/configs", async () => {
    const f = mockFetch(200, [{ id: "cfg-1", org_id: ORG, vct: "https://x/d", display_name: "D", ttl_seconds: 86400, is_active: true }]);
    const svc = new OID4VCIService(httpClient(f));
    const cfgs = await svc.listConfigs(ORG);
    expect(cfgs[0]?.id).toBe("cfg-1");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/oid4vci/configs");
  });

  it("createOffer() POST returns offer uri", async () => {
    const f = mockFetch(201, { offer_id: "of-1", credential_offer: {}, credential_offer_uri: "openid-credential-offer://x", expires_at: "2026-01-01T00:00:00Z" });
    const svc = new OID4VCIService(httpClient(f));
    const res = await svc.createOffer(ORG, { vct: "https://x/d" });
    expect(res.offer_id).toBe("of-1");
  });

  it("revokeIssued() POST with reason body", async () => {
    const f = mock204();
    const svc = new OID4VCIService(httpClient(f));
    await svc.revokeIssued(ORG, "ic-1", "compromised");
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/oid4vci/issued/ic-1/revoke");
    expect(JSON.parse(init.body as string).reason).toBe("compromised");
  });
});

describe("OID4VPService", () => {
  it("batchVerify() unwraps results array", async () => {
    const f = mockFetch(200, { results: [{ id: "a", verified: true }] });
    const svc = new OID4VPService(httpClient(f));
    const res = await svc.batchVerify(ORG, [{ id: "a", vp_token: "t", nonce: "n" }]);
    expect(res).toHaveLength(1);
    expect(res[0]?.verified).toBe(true);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/oid4vp/batch-verify");
  });
});

describe("MdocService", () => {
  it("generateIssuer() POST returns certs", async () => {
    const f = mockFetch(201, { issuer: { id: "is-1" }, ds_certificate: "PEM", iaca_certificate: "PEM" });
    const svc = new MdocService(httpClient(f));
    const res = await svc.generateIssuer(ORG, { display_name: "PID" });
    expect(res.issuer.id).toBe("is-1");
    expect(res.ds_certificate).toBe("PEM");
  });

  it("createIACARoot() POST to /mdoc/iaca-roots", async () => {
    const f = mockFetch(200, { id: "r-1", org_id: ORG, label: "root", pem: "PEM", doc_types: [], subject_dn: "CN=x", sha256_fingerprint: "ab", is_active: true, created_at: "2026-01-01T00:00:00Z" });
    const svc = new MdocService(httpClient(f));
    await svc.createIACARoot(ORG, { label: "root", pem: "PEM" });
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/mdoc/iaca-roots");
  });
});

describe("FederationService", () => {
  it("listSubordinates() unwraps subordinates with status query", async () => {
    const f = mockFetch(200, { subordinates: [{ id: "s-1", entity_id: "https://sub", name: "Sub", entity_types: [], status: "active" }], count: 1 });
    const svc = new FederationService(httpClient(f));
    const subs = await svc.listSubordinates(ORG, "active");
    expect(subs).toHaveLength(1);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/federation/subordinates");
    expect(url).toContain("status=active");
  });

  it("registerSubordinate() POST", async () => {
    const f = mockFetch(200, { id: "s-1", entity_id: "https://sub", name: "Sub", entity_types: ["openid_relying_party"], status: "active" });
    const svc = new FederationService(httpClient(f));
    const sub = await svc.registerSubordinate(ORG, { entity_id: "https://sub", name: "Sub", entity_types: ["openid_relying_party"] });
    expect(sub.id).toBe("s-1");
  });
});

// ── Fase 3: FGA + PAM ──────────────────────────────────────────────────────────

import { FGAService, PAMService } from "../services-authz.js";

describe("FGAService", () => {
  it("check() unwraps allowed boolean", async () => {
    const f = mockFetch(200, { allowed: true });
    const svc = new FGAService(httpClient(f));
    const allowed = await svc.check(ORG, { user: "user:alice", relation: "viewer", object: "doc:1" });
    expect(allowed).toBe(true);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/fga/check");
  });

  it("write() POST writes+deletes", async () => {
    const f = mock204();
    const svc = new FGAService(httpClient(f));
    await svc.write(ORG, [{ user: "user:bob", relation: "editor", object: "doc:2" }]);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/fga/write");
    expect(JSON.parse(init.body as string).writes).toHaveLength(1);
  });

  it("read() GET with object filter", async () => {
    const f = mockFetch(200, { tuples: [{ user: "user:alice", relation: "viewer", object: "doc:1" }] });
    const svc = new FGAService(httpClient(f));
    const res = await svc.read(ORG, { object: "doc:1", page_size: 50 });
    expect(res.tuples).toHaveLength(1);
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("object=doc%3A1");
  });
});

describe("PAMService", () => {
  it("checkout() returns one-time secret", async () => {
    const f = mockFetch(200, { checkout: { id: "co-1" }, secret: "s3cr3t", warning: "once" });
    const svc = new PAMService(httpClient(f));
    const co = await svc.checkout(ORG, "cred-1", "deploy");
    expect(co.secret).toBe("s3cr3t");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/pam/credentials/cred-1/checkout");
  });

  it("listCredentials() unwraps data array", async () => {
    const f = mockFetch(200, { data: [{ id: "cred-1", name: "db-root" }] });
    const svc = new PAMService(httpClient(f));
    const creds = await svc.listCredentials(ORG);
    expect(creds).toHaveLength(1);
  });

  it("signSSHKey() POST returns signed_key", async () => {
    const f = mockFetch(200, { signed_key: "ssh-cert", principals: ["root"], ttl: 3600, expires_at: "2026-01-01T00:00:00Z" });
    const svc = new PAMService(httpClient(f));
    const res = await svc.signSSHKey(ORG, "ssh-ed25519 AAA", "root");
    expect(res.signed_key).toBe("ssh-cert");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/pam/ssh-ca/sign");
  });
});

// ── Fase 4: governance services ────────────────────────────────────────────────

import {
  ServiceAccountService,
  LoginFlowService,
  LifecycleRuleService,
  ComplianceService,
  GdprService,
  AIService,
  ElevateService,
  AgentTokenService,
} from "../services-governance.js";

describe("ServiceAccountService", () => {
  it("create() returns client_secret", async () => {
    const f = mockFetch(201, { service_account: { id: "sa-1" }, client_secret: "sek", secret_note: "once" });
    const svc = new ServiceAccountService(httpClient(f));
    const sa = await svc.create(ORG, { name: "ci" });
    expect(sa.client_secret).toBe("sek");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/service-accounts");
  });
});

describe("LoginFlowService", () => {
  it("assignClient() POST client_id body", async () => {
    const f = mock204();
    const svc = new LoginFlowService(httpClient(f));
    await svc.assignClient(ORG, "lf-1", CLIENT_ID);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/login-flows/lf-1/clients");
    expect(JSON.parse(init.body as string).client_id).toBe(CLIENT_ID);
  });
});

describe("LifecycleRuleService", () => {
  it("create() POST", async () => {
    const f = mockFetch(201, { id: "lr-1" });
    const svc = new LifecycleRuleService(httpClient(f));
    const r = await svc.create(ORG, { name: "joiner", trigger: "joiner", priority: 1, conditions: [], actions: [] });
    expect(r.id).toBe("lr-1");
  });
});

describe("ComplianceService", () => {
  it("score() GET /compliance/score", async () => {
    const f = mockFetch(200, { score: 87 });
    const svc = new ComplianceService(httpClient(f));
    const sc = await svc.score(ORG);
    expect(sc.score).toBe(87);
  });
});

describe("GdprService", () => {
  it("putRetentionPolicy() PUT", async () => {
    const f = mockFetch(200, { enabled: true });
    const svc = new GdprService(httpClient(f));
    const r = await svc.putRetentionPolicy(ORG, { enabled: true, retention_days: 365 });
    expect(r.enabled).toBe(true);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(url).toContain("/gdpr/retention-policy");
  });
});

describe("AIService", () => {
  it("suggest() POST to /ai/:kind", async () => {
    const f = mockFetch(200, { suggestion: "deny RU" });
    const svc = new AIService(httpClient(f));
    const r = await svc.suggest(ORG, "suggest-policy", { goal: "block ru" });
    expect(r.suggestion).toBe("deny RU");
    const [url] = (f as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain("/ai/suggest-policy");
  });
});

describe("ElevateService", () => {
  it("create() POST /elevate", async () => {
    const f = mockFetch(201, { challenge_id: "ch-1" });
    const svc = new ElevateService(httpClient(f));
    const e = await svc.create(ORG, { bearer_token: "b", reason: "delete" });
    expect(e.challenge_id).toBe("ch-1");
  });
});

describe("AgentTokenService", () => {
  it("issue() POST /agent-tokens", async () => {
    const f = mockFetch(201, { id: "at-1", token: "tok" });
    const svc = new AgentTokenService(httpClient(f));
    const at = await svc.issue(ORG, { user_id: "u", agent_id: "a", agent_name: "n" });
    expect(at.token).toBe("tok");
  });
});
