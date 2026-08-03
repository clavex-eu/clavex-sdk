/**
 * @clavex/sdk — Official TypeScript SDK for the Clavex Identity Platform
 *
 * @example
 * ```ts
 * import { ClavexClient } from "@clavex/sdk";
 *
 * // Token-based (recommended for server-to-server)
 * const client = new ClavexClient("https://auth.example.com", {
 *   token: process.env.CLAVEX_TOKEN,
 * });
 *
 * // Password-based (auto-login on first call)
 * const client = new ClavexClient("https://auth.example.com", {
 *   email: process.env.CLAVEX_EMAIL,
 *   password: process.env.CLAVEX_PASSWORD,
 *   orgSlug: process.env.CLAVEX_ORG_SLUG, // omit for superadmin
 * });
 *
 * const users = await client.users.list(orgID);
 * ```
 */

export { ClavexError } from "./client.js";
export type { ClientOptions } from "./client.js";
export * from "./types.js";
export * from "./services-core.js";
export * from "./services-extended.js";
export * from "./services-eudi.js";
export * from "./services-authz.js";
export * from "./services-governance.js";

import { HttpClient, ClavexError, ClientOptions } from "./client.js";
import {
  OrgService,
  UserService,
  RoleService,
  GroupService,
  ClientService,
  IDPService,
  WebhookService,
  InvitationService,
  BrandingService,
  PasswordPolicyService,
  SMTPService,
  LDAPService,
  ClientScopeService,
  ProtocolMapperService,
  MFAService,
  AuditService,
  SCIMService,
  CaptchaService,
  SessionService,
} from "./services-core.js";
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
} from "./services-extended.js";
import {
  OID4VCIService,
  OID4VPService,
  MdocService,
  FederationService,
} from "./services-eudi.js";
import { FGAService, PAMService, DevicePKIService } from "./services-authz.js";
import {
  ServiceAccountService,
  LoginFlowService,
  LifecycleRuleService,
  ScimPushService,
  SamlSpService,
  WsfedRpService,
  AppFamilyService,
  AgentTokenService,
  AccessReviewService,
  EntityReviewService,
  ComplianceService,
  GdprService,
  ActionsService,
  AIService,
  ElevateService,
} from "./services-governance.js";
import { LoginParams, LoginResponse } from "./types.js";

/**
 * ClavexClient is the root of the Clavex management SDK.
 * All services are accessible as properties.
 */
export class ClavexClient {
  private readonly http: HttpClient;

  // ── Core services ────────────────────────────────────────────────────────────
  readonly orgs: OrgService;
  readonly users: UserService;
  readonly roles: RoleService;
  readonly groups: GroupService;
  readonly clients: ClientService;
  readonly idps: IDPService;
  readonly webhooks: WebhookService;
  readonly invitations: InvitationService;
  readonly branding: BrandingService;
  readonly passwordPolicy: PasswordPolicyService;
  readonly smtp: SMTPService;
  readonly ldap: LDAPService;
  readonly clientScopes: ClientScopeService;
  readonly protocolMappers: ProtocolMapperService;
  readonly mfa: MFAService;
  readonly audit: AuditService;
  readonly scim: SCIMService;
  readonly captcha: CaptchaService;
  readonly sessions: SessionService;

  // ── Extended services ────────────────────────────────────────────────────────
  readonly policies: PolicyService;
  readonly ssf: SSFService;
  readonly authzen: AuthZenService;
  readonly apiKeys: APIKeyService;
  readonly crossOrgTrust: CrossOrgTrustService;
  readonly usage: UsageService;
  readonly ciba: CIBAService;
  readonly loginHistory: LoginHistoryService;
  readonly rateLimits: RateLimitService;
  readonly deviceTrust: DeviceTrustService;

  // ── EUDI wallet services ─────────────────────────────────────────────────────
  readonly oid4vci: OID4VCIService;
  readonly oid4vp: OID4VPService;
  readonly mdoc: MdocService;
  readonly federation: FederationService;

  // ── Authorization & privileged access ────────────────────────────────────────
  readonly fga: FGAService;
  readonly pam: PAMService;
  readonly devicePKI: DevicePKIService;

  // ── Governance & lifecycle ───────────────────────────────────────────────────
  readonly serviceAccounts: ServiceAccountService;
  readonly loginFlows: LoginFlowService;
  readonly lifecycleRules: LifecycleRuleService;
  readonly scimPush: ScimPushService;
  readonly samlSps: SamlSpService;
  readonly wsfedRps: WsfedRpService;
  readonly appFamilies: AppFamilyService;
  readonly agentTokens: AgentTokenService;
  readonly accessReviews: AccessReviewService;
  readonly entityReviews: EntityReviewService;
  readonly compliance: ComplianceService;
  readonly gdpr: GdprService;
  readonly actions: ActionsService;
  readonly ai: AIService;
  readonly elevate: ElevateService;

  /**
   * @param baseURL - Base URL of the Clavex server (e.g. "https://auth.example.com")
   * @param opts    - Authentication options (token or email+password)
   */
  constructor(baseURL: string, opts: ClientOptions = {}) {
    this.http = new HttpClient(baseURL, opts);

    // Core
    this.orgs            = new OrgService(this.http);
    this.users           = new UserService(this.http);
    this.roles           = new RoleService(this.http);
    this.groups          = new GroupService(this.http);
    this.clients         = new ClientService(this.http);
    this.idps            = new IDPService(this.http);
    this.webhooks        = new WebhookService(this.http);
    this.invitations     = new InvitationService(this.http);
    this.branding        = new BrandingService(this.http);
    this.passwordPolicy  = new PasswordPolicyService(this.http);
    this.smtp            = new SMTPService(this.http);
    this.ldap            = new LDAPService(this.http);
    this.clientScopes    = new ClientScopeService(this.http);
    this.protocolMappers = new ProtocolMapperService(this.http);
    this.mfa             = new MFAService(this.http);
    this.audit           = new AuditService(this.http);
    this.scim            = new SCIMService(this.http);
    this.captcha         = new CaptchaService(this.http);
    this.sessions        = new SessionService(this.http);

    // Extended
    this.policies        = new PolicyService(this.http);
    this.ssf             = new SSFService(this.http);
    this.authzen         = new AuthZenService(this.http);
    this.apiKeys         = new APIKeyService(this.http);
    this.crossOrgTrust   = new CrossOrgTrustService(this.http);
    this.usage           = new UsageService(this.http);
    this.ciba            = new CIBAService(this.http);
    this.loginHistory    = new LoginHistoryService(this.http);
    this.rateLimits      = new RateLimitService(this.http);
    this.deviceTrust     = new DeviceTrustService(this.http);

    // EUDI
    this.oid4vci         = new OID4VCIService(this.http);
    this.oid4vp          = new OID4VPService(this.http);
    this.mdoc            = new MdocService(this.http);
    this.federation      = new FederationService(this.http);

    // Authorization & privileged access
    this.fga             = new FGAService(this.http);
    this.pam             = new PAMService(this.http);
    this.devicePKI       = new DevicePKIService(this.http);

    // Governance & lifecycle
    this.serviceAccounts = new ServiceAccountService(this.http);
    this.loginFlows      = new LoginFlowService(this.http);
    this.lifecycleRules  = new LifecycleRuleService(this.http);
    this.scimPush        = new ScimPushService(this.http);
    this.samlSps         = new SamlSpService(this.http);
    this.wsfedRps        = new WsfedRpService(this.http);
    this.appFamilies     = new AppFamilyService(this.http);
    this.agentTokens     = new AgentTokenService(this.http);
    this.accessReviews   = new AccessReviewService(this.http);
    this.entityReviews   = new EntityReviewService(this.http);
    this.compliance      = new ComplianceService(this.http);
    this.gdpr            = new GdprService(this.http);
    this.actions         = new ActionsService(this.http);
    this.ai              = new AIService(this.http);
    this.elevate         = new ElevateService(this.http);
  }

  /**
   * Authenticate with email and password. Stores the token for subsequent calls.
   * When `ClientOptions.email` and `ClientOptions.password` are set, this is
   * called automatically on the first API request.
   */
  login(p: LoginParams): Promise<LoginResponse> {
    return this.http.login(p);
  }

  /**
   * Override the bearer token (e.g. after external rotation or token exchange).
   */
  setToken(token: string): void {
    this.http.setToken(token);
  }
}
