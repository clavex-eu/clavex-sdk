// Core types mirroring the Clavex server models and Go SDK types.

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  settings?: Record<string, string>;
  is_active: boolean;
  mfa_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  is_active: boolean;
  is_email_verified: boolean;
  mfa_required: boolean;
  required_actions?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface Role {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

export interface OIDCClient {
  client_id: string;
  org_id: string;
  name: string;
  redirect_uris: string[];
  post_logout_redirect_uris?: string[];
  grant_types?: string[];
  is_public: boolean;
  is_active: boolean;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClientResponse {
  client: OIDCClient;
  client_secret?: string;
}

export interface IdentityProvider {
  id: string;
  org_id: string;
  name: string;
  provider_type: string;
  client_id: string;
  authorization_url: string;
  token_url: string;
  userinfo_url?: string;
  scopes: string;
  email_claim: string;
  first_name_claim: string;
  last_name_claim: string;
  is_active: boolean;
  allow_jit: boolean;
  roles_claim?: string;
  role_claim_mappings?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Webhook {
  id: string;
  org_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role_ids?: string[];
  expires_at: string;
  created_at: string;
}

export interface Branding {
  org_id: string;
  primary_color?: string;
  background_color?: string;
  logo_url?: string;
  favicon_url?: string;
  custom_css?: string;
}

export interface PasswordPolicy {
  org_id: string;
  min_length: number;
  require_upper: boolean;
  require_lower: boolean;
  require_number: boolean;
  require_special: boolean;
  max_age_days: number;
  history_count: number;
}

export interface SMTPConfig {
  org_id: string;
  host: string;
  port: number;
  username: string;
  use_tls: boolean;
  from_name: string;
  from_addr: string;
}

export interface LDAPConnection {
  id: string;
  org_id: string;
  name: string;
  host: string;
  port: number;
  use_tls: boolean;
  bind_dn?: string;
  base_dn: string;
  user_filter: string;
  is_active: boolean;
  last_sync_at?: string;
  created_at: string;
}

// ── Policy types ──────────────────────────────────────────────────────────────

export interface HourRange {
  from: number;
  to: number;
}

export interface PolicyConditions {
  ip_cidr?: string[];
  country?: string[];
  country_not?: string[];
  client_id?: string[];
  mfa_enrolled?: boolean;
  new_country?: boolean;
  day_of_week?: string[];
  hour_range?: HourRange;
  last_login_before?: string;
}

export interface PolicyRule {
  id: string;
  org_id: string;
  name: string;
  priority: number;
  /** "allow" | "deny" | "require_mfa" | "step_up" */
  action: string;
  conditions: PolicyConditions;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SimulateParams {
  user_id?: string;
  client_id?: string;
  ip_address?: string;
  country?: string;
  user_agent?: string;
  request_time?: string;
}

export interface PolicyOutcome {
  action: string;
  rule_name?: string;
  reason?: string;
  mfa_forced?: boolean;
}

export interface SimulateResult {
  outcome: PolicyOutcome;
  mfa_required: boolean;
  trace: Array<{ rule_name: string; priority: number; enabled: boolean; matched: boolean; action: string }>;
  evaluated_at: string;
}

// ── SSF types ─────────────────────────────────────────────────────────────────

export interface SSFStream {
  id: string;
  org_id: string;
  description?: string;
  /** "enabled" | "paused" | "disabled" */
  status: string;
  delivery_method: string;
  endpoint_url?: string;
  event_types: string[];
  created_at: string;
  updated_at: string;
  last_delivered_at?: string;
}

// ── AuthZen types ─────────────────────────────────────────────────────────────

export interface AZSubject {
  type: string;
  id: string;
  properties?: Record<string, unknown>;
}

export interface AZResource {
  type?: string;
  id?: string;
  properties?: Record<string, unknown>;
}

export interface AZAction {
  name?: string;
  properties?: Record<string, unknown>;
}

export interface AZContext {
  ip?: string;
  country?: string;
  user_agent?: string;
  /** ISO 8601 time override for testing */
  time?: string;
}

export interface EvaluateRequest {
  subject: AZSubject;
  resource?: AZResource;
  action?: AZAction;
  context?: AZContext;
}

export interface EvaluateResponse {
  decision: boolean;
  context?: Record<string, unknown>;
}

export interface BatchEvaluateResponse {
  evaluations: EvaluateResponse[];
}

// ── API key types ─────────────────────────────────────────────────────────────

export interface APIKey {
  id: string;
  name: string;
  /** Display prefix, safe to log */
  prefix: string;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

export interface CreateAPIKeyResult {
  api_key: APIKey;
  /** Plaintext secret — only available at creation time */
  secret: string;
}

// ── Cross-org trust ───────────────────────────────────────────────────────────

export interface CrossOrgTrust {
  id: string;
  org_id: string;
  trusted_org_slug: string;
  trusted_org_id: string;
  allowed_scopes?: string[];
  created_at: string;
}

// ── Usage ─────────────────────────────────────────────────────────────────────

export interface ClientUsage {
  client_id: string;
  client_name: string;
  logins: number;
}

export interface OrgUsage {
  org_id: string;
  window_start: string;
  window_end: string;
  mau: number;
  dau: number;
  total_logins: number;
  success_logins: number;
  failed_logins: number;
  new_users: number;
  logins_by_method: Record<string, number>;
  top_clients?: ClientUsage[];
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface CreateOrgParams {
  name: string;
  slug: string;
  logo_url?: string;
}

export interface UpdateOrgParams {
  name?: string;
  logo_url?: string;
  is_active?: boolean;
  mfa_required?: boolean;
}

export interface CreateUserParams {
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  is_active?: boolean;
  role_ids?: string[];
  group_ids?: string[];
  attributes?: Record<string, string>;
}

export interface UpdateUserParams {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  attributes?: Record<string, string>;
}

export interface CreateRoleParams {
  name: string;
  description?: string;
}

export interface CreateGroupParams {
  name: string;
}

export interface CreateClientParams {
  name: string;
  redirect_uris: string[];
  post_logout_redirect_uris?: string[];
  grant_types?: string[];
  is_public?: boolean;
}

export interface UpdateClientParams {
  name?: string;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  grant_types?: string[];
  is_active?: boolean;
}

export interface CreateWebhookParams {
  url: string;
  events: string[];
  secret?: string;
  is_active?: boolean;
}

export interface CreateInvitationParams {
  email: string;
  role_ids?: string[];
  expires_in_hours?: number;
}

export interface CreatePolicyRuleParams {
  name: string;
  priority?: number;
  /** "allow" | "deny" | "require_mfa" | "step_up" */
  action: string;
  conditions?: PolicyConditions;
}

export interface UpdatePolicyRuleParams {
  name?: string;
  priority?: number;
  action?: string;
  enabled?: boolean;
  conditions?: PolicyConditions;
}

export interface CreateSSFStreamParams {
  event_types: string[];
  delivery_method: string;
  endpoint_url?: string;
  description?: string;
}

export interface UpdateSSFStreamParams {
  event_types?: string[];
  endpoint_url?: string;
  status?: string;
  description?: string;
}

export interface CreateAPIKeyParams {
  name: string;
  /** Lifetime in seconds. 0 = no expiry. */
  expires_in?: number;
}

export interface CreateCrossOrgTrustParams {
  trusted_org_slug: string;
  allowed_scopes?: string[];
}

export interface LoginParams {
  org_slug?: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_in: number;
  org_id: string;
  org_slug: string;
  is_super_admin: boolean;
}

// ── CIBA push device tokens ───────────────────────────────────────────────────

/** A mobile push token registered by a user's device for CIBA notifications. */
export interface CIBADeviceToken {
  id: string;
  org_id: string;
  user_id: string;
  /** "apns" (iOS) or "fcm" (Android) */
  platform: "apns" | "fcm";
  device_token: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterPushTokenParams {
  /** "apns" (iOS) or "fcm" (Android) */
  platform: "apns" | "fcm";
  device_token: string;
}

export interface AdminRegisterPushTokenParams extends RegisterPushTokenParams {
  user_id: string;
}

/** A pending (or recently resolved) CIBA backchannel authentication request. */
export interface CIBARequest {
  auth_req_id: string;
  org_id: string;
  client_id: string;
  user_id: string | null;
  scope: string;
  binding_message: string | null;
  login_hint: string | null;
  /** "pending" | "approved" | "denied" */
  status: string;
  interval: number;
  expires_at: string;
  created_at: string;
  vp_claims?: Record<string, unknown>;
  acr?: string;
}

/** Per-org CIBA notification configuration. Secrets are never returned. */
export interface CIBANotificationConfig {
  org_id: string;
  webhook_url: string | null;
  webhook_secret_set: boolean;
  webhook_headers: Record<string, string>;
  email_enabled: boolean;
  sms_enabled: boolean;
  base_url: string | null;
  push_enabled: boolean;
  apns_key_set: boolean;
  apns_key_id: string | null;
  apns_team_id: string | null;
  apns_bundle_id: string | null;
  apns_production: boolean;
  fcm_service_account_set: boolean;
}

export interface UpsertCIBANotificationConfigParams {
  webhook_url?: string;
  webhook_secret?: string;
  webhook_headers?: Record<string, string>;
  email_enabled: boolean;
  sms_enabled: boolean;
  base_url?: string;
  push_enabled: boolean;
  apns_key_p8?: string;
  apns_key_id?: string;
  apns_team_id?: string;
  apns_bundle_id?: string;
  apns_production: boolean;
  fcm_service_account_json?: string;
}

// ── Client scopes & protocol mappers ──────────────────────────────────────────

export interface ClientScope {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  protocol: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClientScopeParams {
  name: string;
  description?: string;
  /** "openid-connect" | "saml" */
  protocol?: string;
}

export interface ProtocolMapper {
  id: string;
  client_id: string;
  name: string;
  protocol: string;
  mapper_type: string;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateProtocolMapperParams {
  name: string;
  /** "openid-connect" | "saml" */
  protocol: string;
  /** e.g. "user-attribute" */
  mapper_type: string;
  config?: Record<string, string>;
}

// ── MFA ───────────────────────────────────────────────────────────────────────

export interface MFACredential {
  id: string;
  user_id: string;
  /** "totp" | "webauthn" */
  type: string;
  name: string;
  is_primary: boolean;
  created_at: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  org_id: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AuditSink {
  id: string;
  org_id: string;
  type: string;
  config?: Record<string, string>;
  events?: string[];
  is_active: boolean;
  created_at: string;
}

export interface CreateSinkParams {
  /** "http" | "syslog" | "s3" | "splunk" */
  type: string;
  config: Record<string, string>;
  /** Allow-list of event types. Empty = all events. */
  events?: string[];
}

// ── Login history & rate limits ───────────────────────────────────────────────

export interface LoginHistoryEntry {
  id: string;
  org_id: string;
  user_id?: string;
  email?: string;
  client_id?: string;
  /** "password" | "totp" | "webauthn" | "oidc" | ... */
  method: string;
  success: boolean;
  ip_address?: string;
  country?: string;
  user_agent?: string;
  fail_reason?: string;
  created_at: string;
}

export interface RateLimitConfig {
  org_id?: string;
  max_attempts_per_minute: number;
  lockout_duration_seconds: number;
  ip_max_attempts_per_minute?: number;
}

// ── SCIM tokens ───────────────────────────────────────────────────────────────

export interface SCIMToken {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

export interface CreateSCIMTokenResult {
  /** The plaintext bearer token — only returned at creation time. */
  token: string;
  scim_token: SCIMToken;
}

// ── CAPTCHA ─────────────────────────────────────────────────────────────────--

export interface CaptchaSettings {
  org_id: string;
  /** "turnstile" | "hcaptcha" | "recaptcha" */
  provider: string;
  site_key: string;
  is_active: boolean;
}

// ── Sessions & trusted devices ────────────────────────────────────────────────

export interface ActiveSession {
  id: string;
  org_id: string;
  client_id: string;
  user_id?: string;
  scope: string;
  expires_at: string;
  created_at: string;
  user_agent?: string;
  ip_address?: string;
  device_name?: string;
  last_seen_at?: string;
}

export interface TrustedDevice {
  id: string;
  user_id: string;
  org_id: string;
  name?: string;
  user_agent?: string;
  ip_address?: string;
  last_seen_at?: string;
  registered_at: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

/** A cursor-paginated page of results. */
export interface Page<T> {
  items: T[];
  total?: number;
  next_cursor?: string;
  prev_cursor?: string;
  has_more?: boolean;
}

/** Query options for cursor/offset-paginated list endpoints. */
export interface ListOptions {
  cursor?: string;
  limit?: number;
  page?: number;
  per_page?: number;
}

// ── EUDI: OID4VCI ──────────────────────────────────────────────────────────────

export interface VCISchemaField {
  name: string;
  label: string;
  /** "string" | "date" | "number" | "url" */
  type: string;
  mandatory: boolean;
}

export interface VCICredentialConfig {
  id: string;
  org_id: string;
  vct: string;
  display_name: string;
  description?: string;
  claims_mapping?: Record<string, unknown>;
  ttl_seconds: number;
  category?: string;
  schema_fields?: VCISchemaField[];
  is_active: boolean;
}

export interface CreateVCIConfigParams {
  vct: string;
  display_name: string;
  description?: string;
  claims_mapping?: Record<string, unknown>;
  ttl_seconds?: number;
  /** identity | training | qualification | badge */
  category?: string;
  schema_fields?: VCISchemaField[];
}

export interface PatchVCIConfigParams {
  pre_issuance_webhook_url?: string;
  pre_issuance_webhook_secret?: string;
  require_vp?: boolean;
  presentation_definition_vpr?: Record<string, unknown>;
  source_idp_type?: string;
  selective_disclosure?: boolean;
  require_key_attestation?: boolean;
  claims_mapping?: Record<string, unknown>;
}

export interface VCIOffer {
  id: string;
  org_id: string;
  user_id?: string;
  vct: string;
  status: string;
  expires_at: string;
  created_at: string;
  payload?: Record<string, unknown>;
}

export interface CreateVCIOfferParams {
  user_id?: string;
  vct: string;
  tx_code?: string;
  ttl_minutes?: number;
  payload?: Record<string, unknown>;
}

export interface CreateVCIOfferResponse {
  offer_id: string;
  credential_offer: Record<string, unknown>;
  credential_offer_uri: string;
  expires_at: string;
}

export interface SendVCIOfferParams {
  /** "sms" | "email" */
  channel: string;
  to?: string;
}

export interface VCIIssuedCredential {
  id: string;
  org_id: string;
  user_id?: string;
  vct: string;
  issued_at: string;
  expires_at?: string;
  is_revoked: boolean;
  revoked_at?: string;
  revocation_reason?: string;
}

// ── EUDI: OID4VP ───────────────────────────────────────────────────────────────

export interface VPSession {
  id: string;
  status: string;
  presentation_definition?: Record<string, unknown>;
  dcql_query?: Record<string, unknown>;
  nonce?: string;
  expires_at: string;
  verified_claims?: Record<string, unknown>;
  created_at: string;
}

export interface BatchVerifyItem {
  id: string;
  vp_token: string;
  nonce: string;
  audience?: string;
  presentation_definition?: Record<string, unknown>;
}

export interface BatchVerifyResult {
  id: string;
  verified: boolean;
  error?: string;
  claims?: Record<string, unknown>;
}

// ── EUDI: mdoc ─────────────────────────────────────────────────────────────────

export interface MdocIssuer {
  id: string;
  org_id: string;
  display_name: string;
  doc_type: string;
  ds_certificate_pem: string;
  iaca_certificate_pem?: string;
  validity_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IACARoot {
  id: string;
  org_id: string;
  label: string;
  subject_dn: string;
  sha256_fingerprint: string;
  pem: string;
  doc_types: string[];
  is_active: boolean;
  created_at: string;
}

export interface GenerateIssuerParams {
  display_name: string;
  doc_type?: string;
}

export interface GenerateIssuerResponse {
  issuer: MdocIssuer;
  ds_certificate: string;
  iaca_certificate: string;
}

export interface CreateMdocIssuerParams {
  display_name: string;
  doc_type: string;
  ds_private_key_pem: string;
  ds_certificate_pem: string;
  iaca_certificate_pem?: string;
  validity_hours?: number;
}

export interface CreateIACARootParams {
  label: string;
  pem: string;
  doc_types?: string[];
}

// ── EUDI: OpenID Federation ────────────────────────────────────────────────────

export interface FederationSubordinate {
  id: string;
  entity_id: string;
  name: string;
  entity_types: string[];
  trust_mark_ids?: string[];
  status: string;
  statement_lifetime_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface RegisterSubordinateParams {
  entity_id: string;
  name: string;
  entity_types: string[];
  jwks?: Record<string, unknown>;
  jwks_uri?: string;
  metadata_override?: Record<string, unknown>;
  metadata_policy?: Record<string, unknown>;
  trust_mark_ids?: string[];
  status?: string;
  statement_lifetime_seconds?: number;
}

export interface TrustMarkType {
  trust_mark_id: string;
  name: string;
  description?: string;
  logo_uri?: string;
  ref_uri?: string;
  lifetime_seconds?: number;
  created_at: string;
}

export interface UpsertTrustMarkTypeParams {
  trust_mark_id: string;
  name: string;
  description?: string;
  logo_uri?: string;
  ref_uri?: string;
  lifetime_seconds?: number;
}

export interface RevokeTrustMarkParams {
  trust_mark_id: string;
  sub: string;
  reason?: string;
}

// ── FGA (fine-grained authorization) ──────────────────────────────────────────

export interface FGATuple {
  user: string;
  relation: string;
  object: string;
}

export interface FGAStoreInfo {
  store_id: string;
  model_id: string | null;
  message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FGAReadResult {
  tuples: FGATuple[];
  continuation_token?: string;
}

export interface FGAReadParams {
  user?: string;
  relation?: string;
  object?: string;
  page_size?: number;
  continuation_token?: string;
}

export interface FGATemplate {
  id: string;
  name: string;
  description?: string;
  use_cases?: string[];
  model?: unknown;
}

// ── PAM (privileged access management) ────────────────────────────────────────

export interface PAMListResult {
  data: Array<Record<string, unknown>>;
  total: number;
  page: number;
  per_page: number;
}

export interface PAMPage {
  page?: number;
  per_page?: number;
}

export interface CreateAccessRequestParams {
  resource_type: string;
  resource_id: string;
  resource_name: string;
  justification: string;
  requested_duration: number;
}

export interface CreateCredentialParams {
  name: string;
  description?: string;
  credential_type: string;
  username?: string;
  secret: string;
  target_host?: string;
  checkout_duration: number;
  require_access_request: boolean;
  rotation_interval_days?: number;
}

export interface UpdateCredentialParams {
  name?: string;
  description?: string;
  username?: string;
  secret?: string;
  target_host?: string;
  checkout_duration?: number;
  require_access_request?: boolean;
  is_active?: boolean;
  rotation_interval_days?: number;
}

export interface CheckoutResult {
  checkout: Record<string, unknown>;
  /** One-time plaintext secret — store securely. */
  secret: string;
  warning?: string;
}

export interface SSHCAParams {
  vault_addr: string;
  vault_token: string;
  vault_mount?: string;
  vault_role: string;
  cert_ttl_seconds?: number;
  require_access_request: boolean;
}

export interface SignSSHKeyResult {
  signed_key: string;
  principals: string[];
  ttl: number;
  expires_at: string;
  instructions?: string;
}

// ── Device CA (mTLS device identity) ──────────────────────────────────────────

export interface DeviceCAParams {
  vault_addr: string;
  vault_token: string;
  vault_mount?: string;
  vault_role: string;
  cert_ttl_seconds?: number;
  renewal_window_seconds?: number;
  bootstrap_secret_ttl_seconds?: number;
}

export interface DeviceCAConfig {
  org_id: string;
  vault_addr: string;
  vault_mount: string;
  vault_role: string;
  ca_certificate_pem?: string;
  cert_ttl_seconds: number;
  renewal_window_seconds: number;
  bootstrap_secret_ttl_seconds: number;
  created_at: string;
  updated_at: string;
}

/** One-time plaintext bootstrap secret — shown only once, store securely. */
export interface EnrollmentSecretResult {
  enrollment_secret_id: string;
  device_id: string;
  bootstrap_secret: string;
  expires_at: string;
}

export interface StartSessionParams {
  access_request_id?: string;
  session_type: string;
  target_host?: string;
  target_port?: number;
  target_user?: string;
}

export interface BreakGlassConfigParams {
  max_uses_per_week: number;
  auto_revoke_hours: number;
  notification_emails: string[];
}

// ── Governance: service accounts ──────────────────────────────────────────────

export interface CreateServiceAccountParams {
  name: string;
  description?: string;
  scopes?: string[];
}

export interface UpdateServiceAccountParams {
  name?: string;
  description?: string;
  scopes?: string[];
  is_active?: boolean;
}

export interface ServiceAccountWithSecret {
  service_account: Record<string, unknown>;
  /** One-time client secret — store securely. */
  client_secret: string;
  secret_note?: string;
}

// ── Governance: login flows ───────────────────────────────────────────────────

export interface CreateLoginFlowParams {
  name: string;
  description?: string;
  is_default: boolean;
}

export interface UpdateLoginFlowParams {
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
}

export interface LoginFlowStep {
  step_type: string;
  position: number;
  config?: Record<string, unknown>;
  is_active?: boolean;
}

// ── Governance: lifecycle rules ───────────────────────────────────────────────

export interface LifecycleRuleParams {
  name: string;
  description?: string;
  /** "joiner" | "mover" | "leaver" */
  trigger: string;
  priority: number;
  conditions: unknown;
  actions: unknown;
  is_active?: boolean;
}

// ── Governance: SCIM push ─────────────────────────────────────────────────────

export interface CreateScimPushParams {
  name: string;
  endpoint_url: string;
  bearer_token: string;
  enabled_events: string[];
}

export interface UpdateScimPushParams {
  name?: string;
  endpoint_url?: string;
  bearer_token?: string;
  enabled_events?: string[];
  is_active?: boolean;
}

// ── Governance: SAML SP / WS-Fed RP ───────────────────────────────────────────

export interface CreateSamlSpParams {
  entity_id: string;
  name: string;
  acs_url: string;
  slo_url?: string;
  metadata_xml?: string;
  name_id_format?: string;
}

export interface WsfedRpParams {
  name: string;
  realm: string;
  wreply_uris?: string[];
  token_lifetime_seconds?: number;
  claims_mapping?: Record<string, string>;
}

// ── Governance: app families & agent tokens ───────────────────────────────────

export interface AppFamilyParams {
  name: string;
  description?: string;
}

export interface IssueAgentTokenParams {
  user_id: string;
  agent_id: string;
  agent_name: string;
  scope?: string;
  ttl_seconds?: number;
  mcp_server_id?: string;
}

// ── Governance: reviews ───────────────────────────────────────────────────────

export interface CreateAccessReviewParams {
  name: string;
  description?: string;
  frequency: string;
  starts_at: string;
  ends_at: string;
  reminder_days?: number[];
  auto_revoke: boolean;
}

export interface CreateEntityReviewParams {
  name: string;
  description?: string;
  entity_type: string;
  reviewer_id: string;
}

// ── Governance: compliance & GDPR ─────────────────────────────────────────────

export interface ProcessingRecordParams {
  activity_name: string;
  purpose: string;
  legal_basis: string;
  data_categories?: string[];
  data_subjects: string;
  retention_period: string;
  recipients?: unknown;
  processors?: unknown;
}

export interface RetentionPolicyParams {
  enabled: boolean;
  retention_days: number;
  activity_field?: string;
  exempt_role_names?: string[];
}

// ── Governance: actions ───────────────────────────────────────────────────────

export interface UpsertActionTargetParams {
  target_type: string;
  url: string;
  sandbox_code?: string;
  timeout_ms?: number;
  signing_secret?: string;
  is_active?: boolean;
}

export interface CreateActionExecutionParams {
  target_id: string;
  name: string;
  event_type: string;
  condition?: unknown;
  mode?: string;
  is_active?: boolean;
}

// ── Governance: elevate (step-up) ─────────────────────────────────────────────

export interface CreateElevateParams {
  bearer_token: string;
  reason: string;
  allowed_methods?: string[];
}

export interface VerifyElevateParams {
  /** "totp" | "webauthn" */
  method: string;
  code?: string;
  credential?: unknown;
}
