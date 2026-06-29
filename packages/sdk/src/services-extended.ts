import { HttpClient } from "./client.js";
import {
  PolicyRule,
  CreatePolicyRuleParams,
  UpdatePolicyRuleParams,
  SimulateParams,
  SimulateResult,
  SSFStream,
  CreateSSFStreamParams,
  UpdateSSFStreamParams,
  EvaluateRequest,
  EvaluateResponse,
  BatchEvaluateResponse,
  APIKey,
  CreateAPIKeyParams,
  CreateAPIKeyResult,
  CrossOrgTrust,
  CreateCrossOrgTrustParams,
  OrgUsage,
  CIBADeviceToken,
  RegisterPushTokenParams,
  AdminRegisterPushTokenParams,
  CIBARequest,
  CIBANotificationConfig,
  UpsertCIBANotificationConfigParams,
  LoginHistoryEntry,
  RateLimitConfig,
  TrustedDevice,
  Page,
  ListOptions,
} from "./types.js";

// withQuery appends ListOptions as URL query parameters.
function withQuery(path: string, opts?: ListOptions): string {
  if (!opts) return path;
  const q = new URLSearchParams();
  if (opts.cursor) q.set("cursor", opts.cursor);
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.page) q.set("page", String(opts.page));
  if (opts.per_page) q.set("per_page", String(opts.per_page));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

// ── Auth-flow Policy Rules ────────────────────────────────────────────────────

/**
 * PolicyService manages auth-flow policy rules for an organisation.
 *
 * Rules are evaluated in priority order (lowest number first) during every
 * authentication event. The first matching rule's action is applied.
 *
 * @example
 * ```ts
 * const rule = await client.policies.create(orgID, {
 *   name: "block-russia",
 *   priority: 10,
 *   action: "deny",
 *   conditions: { country_not: ["RU"] },
 * });
 * ```
 */
export class PolicyService {
  constructor(private readonly c: HttpClient) {}

  /** List all auth-flow policy rules for orgID. */
  list(orgID: string): Promise<PolicyRule[]> {
    return this.c.get(this.c.orgPath(orgID, "/auth-policies"));
  }

  /** Create a new policy rule. */
  create(orgID: string, p: CreatePolicyRuleParams): Promise<PolicyRule> {
    return this.c.post(this.c.orgPath(orgID, "/auth-policies"), p);
  }

  /** Update an existing policy rule. */
  update(orgID: string, ruleID: string, p: UpdatePolicyRuleParams): Promise<PolicyRule> {
    return this.c.put(this.c.orgPath(orgID, `/auth-policies/${ruleID}`), p);
  }

  /** Delete a policy rule. */
  delete(orgID: string, ruleID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/auth-policies/${ruleID}`));
  }

  /**
   * Dry-run policy evaluation without side effects.
   * Returns the outcome and a full trace of all rule evaluations.
   *
   * @example
   * ```ts
   * const result = await client.policies.simulate(orgID, {
   *   user_id: "550e8400-...",
   *   ip_address: "1.2.3.4",
   *   country: "CN",
   * });
   * console.log(result.outcome.action, result.mfa_required);
   * ```
   */
  simulate(orgID: string, p: SimulateParams): Promise<SimulateResult> {
    return this.c.post(this.c.orgPath(orgID, "/auth-policies/simulate"), p);
  }
}

// ── Shared Signals Framework ──────────────────────────────────────────────────

/**
 * SSFService manages Shared Signals Framework (RFC 8935/8936) streams.
 *
 * SSF lets your application receive real-time security events
 * (session revocation, credential changes, account compromise) via push
 * or poll delivery.
 *
 * @example
 * ```ts
 * const stream = await client.ssf.create(orgID, {
 *   event_types: ["https://schemas.openid.net/secevent/risc/event-type/session-revoked"],
 *   delivery_method: "https://schemas.openid.net/secevent/risc/delivery-method/push",
 *   endpoint_url: "https://app.example.com/ssf/events",
 * });
 * ```
 */
export class SSFService {
  constructor(private readonly c: HttpClient) {}

  create(orgID: string, p: CreateSSFStreamParams): Promise<SSFStream> {
    return this.c.post(this.c.orgPath(orgID, "/ssf/streams"), p);
  }

  list(orgID: string): Promise<SSFStream[]> {
    return this.c.get(this.c.orgPath(orgID, "/ssf/streams"));
  }

  get(orgID: string, streamID: string): Promise<SSFStream> {
    return this.c.get(this.c.orgPath(orgID, `/ssf/streams/${streamID}`));
  }

  update(orgID: string, streamID: string, p: UpdateSSFStreamParams): Promise<SSFStream> {
    return this.c.patch(this.c.orgPath(orgID, `/ssf/streams/${streamID}`), p);
  }

  delete(orgID: string, streamID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/ssf/streams/${streamID}`));
  }

  /**
   * Fetch pending SETs from a poll-delivery stream (max `maxEvents`).
   * Call `acknowledge()` after processing to remove them from the queue.
   */
  poll(orgID: string, streamID: string, maxEvents = 100): Promise<Array<{ jti: string; event_type: string; payload: string }>> {
    return this.c.post(this.c.orgPath(orgID, `/ssf/streams/${streamID}/poll`), { max_events: maxEvents });
  }

  /** Remove processed JTIs from the poll queue. */
  acknowledge(orgID: string, streamID: string, jtis: string[]): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/ssf/streams/${streamID}/ack`), { jtis });
  }

  /** Send a test SET to verify push endpoint connectivity. */
  verify(orgID: string, streamID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/ssf/streams/${streamID}/verify`));
  }
}

// ── AuthZen PDP ───────────────────────────────────────────────────────────────

/**
 * AuthZenService exposes the OpenID AuthZen 1.0 authorization evaluation API.
 *
 * The orgSlug is the tenant identifier (e.g. "acme"). The client must carry
 * a valid access token issued by the same org (use machine-to-machine
 * client credentials and cache the token until expiry).
 *
 * @example
 * ```ts
 * const resp = await client.authzen.evaluate("acme", {
 *   subject:  { type: "user", id: "alice@example.com" },
 *   resource: { type: "invoice", id: "inv-9001" },
 *   action:   { name: "approve" },
 *   context:  { ip: "1.2.3.4" },
 * });
 * if (!resp.decision) throw new Error("Forbidden");
 * ```
 */
export class AuthZenService {
  constructor(private readonly c: HttpClient) {}

  /** Single authorization evaluation (POST /access/v1/evaluation). */
  evaluate(orgSlug: string, req: EvaluateRequest): Promise<EvaluateResponse> {
    return this.c.post(`/${orgSlug}/access/v1/evaluation`, req);
  }

  /**
   * Batch evaluation (POST /access/v1/evaluations).
   * Up to 100 items per call; results are order-matched to the input.
   */
  batchEvaluate(orgSlug: string, reqs: EvaluateRequest[]): Promise<BatchEvaluateResponse> {
    return this.c.post(`/${orgSlug}/access/v1/evaluations`, { evaluations: reqs });
  }

  /**
   * Policy Information Point (GET /access/v1/subject/:sub/attributes).
   * Returns all authorisation-relevant attributes for the given subject.
   * `:sub` may be a UUID or email address.
   */
  subjectAttributes(orgSlug: string, sub: string): Promise<Record<string, unknown>> {
    return this.c.get(`/${orgSlug}/access/v1/subject/${encodeURIComponent(sub)}/attributes`);
  }
}

// ── API Keys ──────────────────────────────────────────────────────────────────

/**
 * APIKeyService manages superadmin API keys.
 *
 * API keys are used instead of JWT bearer tokens for machine-to-machine
 * integrations. The plaintext secret is only available at creation time.
 *
 * @example
 * ```ts
 * const { api_key, secret } = await client.apiKeys.create({ name: "terraform" });
 * // Store secret securely — it will never be returned again.
 * ```
 */
export class APIKeyService {
  constructor(private readonly c: HttpClient) {}

  /** Create a new API key. Requires superadmin. */
  create(p: CreateAPIKeyParams): Promise<CreateAPIKeyResult> {
    return this.c.post("/api/v1/superadmin/api-keys", p);
  }

  /** List all API keys. Requires superadmin. */
  list(): Promise<APIKey[]> {
    return this.c.get("/api/v1/superadmin/api-keys");
  }

  /** Permanently revoke an API key. Requires superadmin. */
  revoke(keyID: string): Promise<void> {
    return this.c.delete(`/api/v1/superadmin/api-keys/${keyID}`);
  }
}

// ── Cross-org Trust ───────────────────────────────────────────────────────────

/**
 * CrossOrgTrustService manages RFC 8693 token-exchange trust relationships.
 *
 * Once established, users authenticated in org A can obtain tokens valid in
 * org B without re-authenticating.
 *
 * @example
 * ```ts
 * const trust = await client.crossOrgTrust.create(orgID, {
 *   trusted_org_slug: "partner-corp",
 *   allowed_scopes: ["openid", "profile"],
 * });
 * ```
 */
export class CrossOrgTrustService {
  constructor(private readonly c: HttpClient) {}

  create(orgID: string, p: CreateCrossOrgTrustParams): Promise<CrossOrgTrust> {
    return this.c.post(this.c.orgPath(orgID, "/cross-org-trusts"), p);
  }

  /** List outbound trusts (orgs that this org trusts). */
  list(orgID: string): Promise<CrossOrgTrust[]> {
    return this.c.get(this.c.orgPath(orgID, "/cross-org-trusts"));
  }

  /** List inbound trusts (orgs that trust this org). */
  listInbound(orgID: string): Promise<CrossOrgTrust[]> {
    return this.c.get(this.c.orgPath(orgID, "/cross-org-trusts/inbound"));
  }

  /** Revoke a cross-org trust. */
  revoke(orgID: string, trustID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/cross-org-trusts/${trustID}`));
  }
}

// ── Usage Analytics ───────────────────────────────────────────────────────────

export class UsageService {
  constructor(private readonly c: HttpClient) {}

  /** Get aggregated authentication metrics for the current 30-day window. */
  get(orgID: string): Promise<OrgUsage> {
    return this.c.get(this.c.orgPath(orgID, "/usage"));
  }
}

// ── CIBA push device tokens ───────────────────────────────────────────────────

/**
 * CIBAService manages CIBA push device token registration.
 *
 * Mobile apps call `registerSelf()` after a successful login to register
 * their APNs (iOS) or FCM (Android) push token. Clavex uses the registered
 * tokens to deliver native push notifications when a CIBA authentication
 * request is created for the user.
 *
 * Admin operations (list / register for a specific user / delete) require
 * a management API token with sessions resource permission.
 *
 * @example
 * ```ts
 * // Mobile app — register own device after login
 * await client.ciba.registerSelf("acme", {
 *   platform: "apns",
 *   device_token: deviceToken,
 * });
 *
 * // Admin — list all push tokens for an org
 * const tokens = await client.ciba.listDeviceTokens(orgID);
 * ```
 */
export class CIBAService {
  constructor(private readonly c: HttpClient) {}

  // ── Pending requests (admin) ─────────────────────────────────────────────────

  /** List pending CIBA requests for an org. */
  listPending(orgID: string): Promise<CIBARequest[]> {
    return this.c.get(this.c.orgPath(orgID, "/ciba/pending"));
  }

  /** Approve a pending CIBA request. The approved user cannot be substituted. */
  approve(orgID: string, authReqID: string): Promise<{ status: string }> {
    return this.c.post(this.c.orgPath(orgID, `/ciba/${authReqID}/approve`));
  }

  /** Deny a pending CIBA request. */
  deny(orgID: string, authReqID: string): Promise<{ status: string }> {
    return this.c.post(this.c.orgPath(orgID, `/ciba/${authReqID}/deny`));
  }

  // ── Notification config (admin) ──────────────────────────────────────────────

  getNotificationConfig(orgID: string): Promise<CIBANotificationConfig> {
    return this.c.get(this.c.orgPath(orgID, "/ciba/notification-config"));
  }

  putNotificationConfig(orgID: string, p: UpsertCIBANotificationConfigParams): Promise<CIBANotificationConfig> {
    return this.c.put(this.c.orgPath(orgID, "/ciba/notification-config"), p);
  }

  deleteNotificationConfig(orgID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, "/ciba/notification-config"));
  }

  // ── Device tokens (admin) ─────────────────────────────────────────────────────

  /** List all registered push tokens for an org. Pass `userID` to filter by user. */
  listDeviceTokens(orgID: string, userID?: string): Promise<CIBADeviceToken[]> {
    const path = this.c.orgPath(orgID, "/ciba/device-tokens");
    return this.c.get(userID ? `${path}?user_id=${encodeURIComponent(userID)}` : path);
  }

  /** Register a push token on behalf of a specific user (admin). */
  registerDeviceToken(orgID: string, p: AdminRegisterPushTokenParams): Promise<CIBADeviceToken> {
    return this.c.post(this.c.orgPath(orgID, "/ciba/device-tokens"), p);
  }

  /** Delete a push token by its UUID (admin). */
  deleteDeviceToken(orgID: string, tokenID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/ciba/device-tokens/${tokenID}`));
  }

  // ── Self-service (mobile app, bearer token) ─────────────────────────────────

  /**
   * Register the calling user's own push token.
   * The `Authorization: Bearer <access_token>` header must carry a valid
   * access token issued by Clavex for the given org slug.
   *
   * @param orgSlug - The organisation slug (e.g. "acme").
   */
  registerSelf(orgSlug: string, p: RegisterPushTokenParams): Promise<CIBADeviceToken> {
    return this.c.post(`/${orgSlug}/push/device-token`, p);
  }

  /**
   * Unregister the calling user's own push token.
   *
   * @param orgSlug - The organisation slug (e.g. "acme").
   */
  deleteSelf(orgSlug: string, p: RegisterPushTokenParams): Promise<void> {
    return this.c.delete(`/${orgSlug}/push/device-token`, p);
  }
}

// ── Login history ─────────────────────────────────────────────────────────────

/** LoginHistoryService provides read access to the immutable login event log. */
export class LoginHistoryService {
  constructor(private readonly c: HttpClient) {}

  /** Login history for the entire org (cursor/offset-paginated). */
  listByOrg(orgID: string, opts?: ListOptions): Promise<Page<LoginHistoryEntry>> {
    return this.c.get(withQuery(this.c.orgPath(orgID, "/login-history"), opts));
  }

  /** Login history for a specific user (cursor/offset-paginated). */
  listByUser(orgID: string, userID: string, opts?: ListOptions): Promise<Page<LoginHistoryEntry>> {
    return this.c.get(withQuery(this.c.orgPath(orgID, `/users/${userID}/login-history`), opts));
  }
}

// ── Rate limits ───────────────────────────────────────────────────────────────

/** RateLimitService manages per-org login rate-limit configuration. */
export class RateLimitService {
  constructor(private readonly c: HttpClient) {}

  get(orgID: string): Promise<RateLimitConfig> {
    return this.c.get(this.c.orgPath(orgID, "/rate-limits"));
  }

  update(orgID: string, cfg: RateLimitConfig): Promise<RateLimitConfig> {
    return this.c.put(this.c.orgPath(orgID, "/rate-limits"), cfg);
  }
}

// ── Device trust ──────────────────────────────────────────────────────────────

/** DeviceTrustService manages trusted devices for zero-trust session binding. */
export class DeviceTrustService {
  constructor(private readonly c: HttpClient) {}

  list(orgID: string, userID: string): Promise<TrustedDevice[]> {
    return this.c.get(this.c.orgPath(orgID, `/users/${userID}/trusted-devices`));
  }

  revoke(orgID: string, userID: string, deviceID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/users/${userID}/trusted-devices/${deviceID}`));
  }

  revokeAll(orgID: string, userID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/users/${userID}/trusted-devices`));
  }
}
