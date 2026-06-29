import { HttpClient } from "./client.js";
import {
  Organization,
  CreateOrgParams,
  UpdateOrgParams,
  User,
  CreateUserParams,
  UpdateUserParams,
  Role,
  CreateRoleParams,
  Group,
  CreateGroupParams,
  OIDCClient,
  CreateClientParams,
  UpdateClientParams,
  CreateClientResponse,
  IdentityProvider,
  Webhook,
  CreateWebhookParams,
  Invitation,
  CreateInvitationParams,
  Branding,
  PasswordPolicy,
  SMTPConfig,
  LDAPConnection,
  ClientScope,
  CreateClientScopeParams,
  ProtocolMapper,
  CreateProtocolMapperParams,
  MFACredential,
  AuditLogEntry,
  AuditSink,
  CreateSinkParams,
  SCIMToken,
  CreateSCIMTokenResult,
  CaptchaSettings,
  ActiveSession,
} from "./types.js";

// ── Organizations ─────────────────────────────────────────────────────────────

export class OrgService {
  constructor(private readonly c: HttpClient) {}

  /** Create a new organisation. Requires superadmin. */
  create(p: CreateOrgParams): Promise<Organization> {
    return this.c.post("/api/v1/organizations", p);
  }

  /** List all organisations. Requires superadmin. */
  list(): Promise<Organization[]> {
    return this.c.get("/api/v1/organizations");
  }

  /** Get an organisation by ID. */
  get(orgID: string): Promise<Organization> {
    return this.c.get(`/api/v1/organizations/${orgID}`);
  }

  /** Update an organisation. */
  update(orgID: string, p: UpdateOrgParams): Promise<Organization> {
    return this.c.patch(`/api/v1/organizations/${orgID}`, p);
  }

  /** Delete an organisation. Requires superadmin. */
  delete(orgID: string): Promise<void> {
    return this.c.delete(`/api/v1/organizations/${orgID}`);
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export class UserService {
  constructor(private readonly c: HttpClient) {}

  create(orgID: string, p: CreateUserParams): Promise<User> {
    return this.c.post(this.c.orgPath(orgID, "/users"), p);
  }

  list(orgID: string): Promise<User[]> {
    return this.c.get(this.c.orgPath(orgID, "/users"));
  }

  get(orgID: string, userID: string): Promise<User> {
    return this.c.get(this.c.orgPath(orgID, `/users/${userID}`));
  }

  update(orgID: string, userID: string, p: UpdateUserParams): Promise<User> {
    return this.c.patch(this.c.orgPath(orgID, `/users/${userID}`), p);
  }

  delete(orgID: string, userID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/users/${userID}`));
  }

  /** Trigger a password-reset email for the user. */
  sendPasswordReset(orgID: string, userID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/users/${userID}/send-password-reset`));
  }

  /** List all roles assigned to a user. */
  listRoles(orgID: string, userID: string): Promise<Role[]> {
    return this.c.get(this.c.orgPath(orgID, `/users/${userID}/roles`));
  }

  /** List all groups a user belongs to. */
  listGroups(orgID: string, userID: string): Promise<Group[]> {
    return this.c.get(this.c.orgPath(orgID, `/users/${userID}/groups`));
  }
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export class RoleService {
  constructor(private readonly c: HttpClient) {}

  create(orgID: string, p: CreateRoleParams): Promise<Role> {
    return this.c.post(this.c.orgPath(orgID, "/roles"), p);
  }

  list(orgID: string): Promise<Role[]> {
    return this.c.get(this.c.orgPath(orgID, "/roles"));
  }

  delete(orgID: string, roleID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/roles/${roleID}`));
  }

  /** Assign a role to a user. */
  assignToUser(orgID: string, roleID: string, userID: string): Promise<void> {
    return this.c.put(this.c.orgPath(orgID, `/roles/${roleID}/users/${userID}`));
  }

  /** Revoke a role from a user. */
  unassignFromUser(orgID: string, roleID: string, userID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/roles/${roleID}/users/${userID}`));
  }

  /** List child roles (composite role hierarchy). */
  listChildren(orgID: string, roleID: string): Promise<Role[]> {
    return this.c.get(this.c.orgPath(orgID, `/roles/${roleID}/children`));
  }

  addChild(orgID: string, roleID: string, childID: string): Promise<void> {
    return this.c.put(this.c.orgPath(orgID, `/roles/${roleID}/children/${childID}`));
  }

  removeChild(orgID: string, roleID: string, childID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/roles/${roleID}/children/${childID}`));
  }
}

// ── Groups ────────────────────────────────────────────────────────────────────

export class GroupService {
  constructor(private readonly c: HttpClient) {}

  create(orgID: string, p: CreateGroupParams): Promise<Group> {
    return this.c.post(this.c.orgPath(orgID, "/groups"), p);
  }

  list(orgID: string): Promise<Group[]> {
    return this.c.get(this.c.orgPath(orgID, "/groups"));
  }

  delete(orgID: string, groupID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/groups/${groupID}`));
  }

  /** Add a member to a group. */
  addMember(orgID: string, groupID: string, userID: string): Promise<void> {
    return this.c.put(this.c.orgPath(orgID, `/groups/${groupID}/members/${userID}`));
  }

  /** Remove a member from a group. */
  removeMember(orgID: string, groupID: string, userID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/groups/${groupID}/members/${userID}`));
  }

  /** List all members of a group. */
  listMembers(orgID: string, groupID: string): Promise<User[]> {
    return this.c.get(this.c.orgPath(orgID, `/groups/${groupID}/members`));
  }
}

// ── OIDC Clients ──────────────────────────────────────────────────────────────

export class ClientService {
  constructor(private readonly c: HttpClient) {}

  /**
   * Create a new OIDC/OAuth2 client.
   * The response includes `client_secret` (only available at creation time).
   */
  create(orgID: string, p: CreateClientParams): Promise<CreateClientResponse> {
    return this.c.post(this.c.orgPath(orgID, "/clients"), p);
  }

  list(orgID: string): Promise<OIDCClient[]> {
    return this.c.get(this.c.orgPath(orgID, "/clients"));
  }

  get(orgID: string, clientID: string): Promise<OIDCClient> {
    return this.c.get(this.c.orgPath(orgID, `/clients/${clientID}`));
  }

  update(orgID: string, clientID: string, p: UpdateClientParams): Promise<OIDCClient> {
    return this.c.patch(this.c.orgPath(orgID, `/clients/${clientID}`), p);
  }

  delete(orgID: string, clientID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/clients/${clientID}`));
  }

  /** Rotate the client secret. Returns the new plaintext secret. */
  rotateSecret(orgID: string, clientID: string): Promise<{ client_secret: string }> {
    return this.c.post(this.c.orgPath(orgID, `/clients/${clientID}/rotate-secret`));
  }
}

// ── Identity Providers ────────────────────────────────────────────────────────

export class IDPService {
  constructor(private readonly c: HttpClient) {}

  list(orgID: string): Promise<IdentityProvider[]> {
    return this.c.get(this.c.orgPath(orgID, "/identity-providers"));
  }

  get(orgID: string, idpID: string): Promise<IdentityProvider> {
    return this.c.get(this.c.orgPath(orgID, `/identity-providers/${idpID}`));
  }

  delete(orgID: string, idpID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/identity-providers/${idpID}`));
  }
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export class WebhookService {
  constructor(private readonly c: HttpClient) {}

  create(orgID: string, p: CreateWebhookParams): Promise<Webhook> {
    return this.c.post(this.c.orgPath(orgID, "/webhooks"), p);
  }

  list(orgID: string): Promise<Webhook[]> {
    return this.c.get(this.c.orgPath(orgID, "/webhooks"));
  }

  update(orgID: string, webhookID: string, p: CreateWebhookParams): Promise<Webhook> {
    return this.c.put(this.c.orgPath(orgID, `/webhooks/${webhookID}`), p);
  }

  delete(orgID: string, webhookID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/webhooks/${webhookID}`));
  }
}

// ── Invitations ───────────────────────────────────────────────────────────────

export class InvitationService {
  constructor(private readonly c: HttpClient) {}

  create(orgID: string, p: CreateInvitationParams): Promise<Invitation> {
    return this.c.post(this.c.orgPath(orgID, "/invitations"), p);
  }

  list(orgID: string): Promise<Invitation[]> {
    return this.c.get(this.c.orgPath(orgID, "/invitations"));
  }

  delete(orgID: string, invitationID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/invitations/${invitationID}`));
  }
}

// ── Branding ──────────────────────────────────────────────────────────────────

export class BrandingService {
  constructor(private readonly c: HttpClient) {}

  get(orgID: string): Promise<Branding> {
    return this.c.get(this.c.orgPath(orgID, "/branding"));
  }

  put(orgID: string, b: Branding): Promise<Branding> {
    return this.c.put(this.c.orgPath(orgID, "/branding"), b);
  }
}

// ── Password Policy ───────────────────────────────────────────────────────────

export class PasswordPolicyService {
  constructor(private readonly c: HttpClient) {}

  get(orgID: string): Promise<PasswordPolicy> {
    return this.c.get(this.c.orgPath(orgID, "/password-policy"));
  }

  put(orgID: string, p: PasswordPolicy): Promise<PasswordPolicy> {
    return this.c.put(this.c.orgPath(orgID, "/password-policy"), p);
  }
}

// ── SMTP ──────────────────────────────────────────────────────────────────────

export class SMTPService {
  constructor(private readonly c: HttpClient) {}

  get(orgID: string): Promise<SMTPConfig> {
    return this.c.get(this.c.orgPath(orgID, "/smtp"));
  }

  put(orgID: string, cfg: SMTPConfig): Promise<SMTPConfig> {
    return this.c.put(this.c.orgPath(orgID, "/smtp"), cfg);
  }

  /** Send a test email using the current SMTP config. */
  test(orgID: string): Promise<{ success: boolean; message?: string }> {
    return this.c.post(this.c.orgPath(orgID, "/smtp/test"));
  }
}

// ── LDAP ──────────────────────────────────────────────────────────────────────

export class LDAPService {
  constructor(private readonly c: HttpClient) {}

  list(orgID: string): Promise<LDAPConnection[]> {
    return this.c.get(this.c.orgPath(orgID, "/ldap"));
  }

  get(orgID: string, connID: string): Promise<LDAPConnection> {
    return this.c.get(this.c.orgPath(orgID, `/ldap/${connID}`));
  }

  delete(orgID: string, connID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/ldap/${connID}`));
  }

  /** Trigger a manual LDAP sync. */
  sync(orgID: string, connID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/ldap/${connID}/sync`));
  }
}

// ── Client scopes ─────────────────────────────────────────────────────────────

/** ClientScopeService manages custom OIDC scopes and their client assignments. */
export class ClientScopeService {
  constructor(private readonly c: HttpClient) {}

  list(orgID: string): Promise<ClientScope[]> {
    return this.c.get(this.c.orgPath(orgID, "/client-scopes"));
  }

  create(orgID: string, p: CreateClientScopeParams): Promise<ClientScope> {
    return this.c.post(this.c.orgPath(orgID, "/client-scopes"), p);
  }

  update(orgID: string, scopeID: string, p: CreateClientScopeParams): Promise<ClientScope> {
    return this.c.patch(this.c.orgPath(orgID, `/client-scopes/${scopeID}`), p);
  }

  delete(orgID: string, scopeID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/client-scopes/${scopeID}`));
  }

  /** List the scopes assigned to a specific client. */
  listByClient(orgID: string, clientID: string): Promise<ClientScope[]> {
    return this.c.get(this.c.orgPath(orgID, `/clients/${clientID}/scopes`));
  }

  /** Attach a scope to a client. */
  assignToClient(orgID: string, clientID: string, scopeID: string): Promise<void> {
    return this.c.put(this.c.orgPath(orgID, `/clients/${clientID}/scopes/${scopeID}`));
  }

  /** Detach a scope from a client. */
  unassignFromClient(orgID: string, clientID: string, scopeID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/clients/${clientID}/scopes/${scopeID}`));
  }
}

// ── Protocol mappers ──────────────────────────────────────────────────────────

/** ProtocolMapperService manages protocol mappers attached to a client. */
export class ProtocolMapperService {
  constructor(private readonly c: HttpClient) {}

  list(orgID: string, clientID: string): Promise<ProtocolMapper[]> {
    return this.c.get(this.c.orgPath(orgID, `/clients/${clientID}/mappers`));
  }

  create(orgID: string, clientID: string, p: CreateProtocolMapperParams): Promise<ProtocolMapper> {
    return this.c.post(this.c.orgPath(orgID, `/clients/${clientID}/mappers`), p);
  }

  update(orgID: string, clientID: string, mapperID: string, p: CreateProtocolMapperParams): Promise<ProtocolMapper> {
    return this.c.patch(this.c.orgPath(orgID, `/clients/${clientID}/mappers/${mapperID}`), p);
  }

  delete(orgID: string, clientID: string, mapperID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/clients/${clientID}/mappers/${mapperID}`));
  }
}

// ── MFA (admin) ───────────────────────────────────────────────────────────────

/** MFAService provides the admin view of a user's enrolled MFA credentials. */
export class MFAService {
  constructor(private readonly c: HttpClient) {}

  list(orgID: string, userID: string): Promise<MFACredential[]> {
    return this.c.get(this.c.orgPath(orgID, `/users/${userID}/mfa`));
  }

  delete(orgID: string, userID: string, credID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/users/${userID}/mfa/${credID}`));
  }
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/** AuditService provides read access to the audit log and manages audit sinks. */
export class AuditService {
  constructor(private readonly c: HttpClient) {}

  /** List audit log entries for orgID. */
  list(orgID: string): Promise<AuditLogEntry[]> {
    return this.c.get(this.c.orgPath(orgID, "/audit"));
  }

  listSinks(orgID: string): Promise<AuditSink[]> {
    return this.c.get(this.c.orgPath(orgID, "/audit/sinks"));
  }

  createSink(orgID: string, p: CreateSinkParams): Promise<AuditSink> {
    return this.c.post(this.c.orgPath(orgID, "/audit/sinks"), p);
  }

  updateSink(orgID: string, sinkID: string, p: CreateSinkParams): Promise<AuditSink> {
    return this.c.patch(this.c.orgPath(orgID, `/audit/sinks/${sinkID}`), p);
  }

  deleteSink(orgID: string, sinkID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/audit/sinks/${sinkID}`));
  }

  /** Fire a test event to a sink to verify connectivity. */
  testSink(orgID: string, sinkID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/audit/sinks/${sinkID}/test`));
  }
}

// ── SCIM tokens ───────────────────────────────────────────────────────────────

/** SCIMService manages SCIM 2.0 bearer tokens for an organisation. */
export class SCIMService {
  constructor(private readonly c: HttpClient) {}

  listTokens(orgID: string): Promise<SCIMToken[]> {
    return this.c.get(this.c.orgPath(orgID, "/scim/tokens"));
  }

  /** Generate a new SCIM token. The plaintext token is only returned here. */
  createToken(orgID: string): Promise<CreateSCIMTokenResult> {
    return this.c.post(this.c.orgPath(orgID, "/scim/tokens"));
  }

  deleteToken(orgID: string, tokenID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/scim/tokens/${tokenID}`));
  }
}

// ── CAPTCHA ─────────────────────────────────────────────────────────────────--

/** CaptchaService manages CAPTCHA settings for an organisation. */
export class CaptchaService {
  constructor(private readonly c: HttpClient) {}

  get(orgID: string): Promise<CaptchaSettings> {
    return this.c.get(this.c.orgPath(orgID, "/captcha"));
  }

  put(orgID: string, cfg: CaptchaSettings): Promise<CaptchaSettings> {
    return this.c.put(this.c.orgPath(orgID, "/captcha"), cfg);
  }

  /** Remove the CAPTCHA config, disabling CAPTCHA for orgID. */
  delete(orgID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, "/captcha"));
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

/** SessionService manages active user sessions. */
export class SessionService {
  constructor(private readonly c: HttpClient) {}

  listByOrg(orgID: string): Promise<ActiveSession[]> {
    return this.c.get(this.c.orgPath(orgID, "/sessions"));
  }

  revoke(orgID: string, sessionID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/sessions/${sessionID}`));
  }

  listByUser(orgID: string, userID: string): Promise<ActiveSession[]> {
    return this.c.get(this.c.orgPath(orgID, `/users/${userID}/sessions`));
  }

  revokeAllByUser(orgID: string, userID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/users/${userID}/sessions`));
  }
}
