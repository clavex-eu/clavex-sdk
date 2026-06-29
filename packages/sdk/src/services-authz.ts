import { HttpClient } from "./client.js";
import {
  FGATuple,
  FGAStoreInfo,
  FGAReadResult,
  FGAReadParams,
  FGATemplate,
  PAMListResult,
  PAMPage,
  CreateAccessRequestParams,
  CreateCredentialParams,
  UpdateCredentialParams,
  CheckoutResult,
  SSHCAParams,
  SignSSHKeyResult,
  StartSessionParams,
  BreakGlassConfigParams,
} from "./types.js";

function pageQuery(p?: PAMPage): string {
  if (!p) return "";
  const q = new URLSearchParams();
  if (p.page) q.set("page", String(p.page));
  if (p.per_page) q.set("per_page", String(p.per_page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ── FGA (fine-grained authorization, ReBAC) ───────────────────────────────────

/** FGAService manages the relationship-based authorization store and checks. */
export class FGAService {
  constructor(private readonly c: HttpClient) {}

  initStore(orgID: string): Promise<FGAStoreInfo> {
    return this.c.post(this.c.orgPath(orgID, "/fga/stores"));
  }

  getStore(orgID: string): Promise<FGAStoreInfo> {
    return this.c.get(this.c.orgPath(orgID, "/fga/stores"));
  }

  /** Returns the authorization model as a raw JSON document. */
  getModel(orgID: string): Promise<unknown> {
    return this.c.get(this.c.orgPath(orgID, "/fga/model"));
  }

  /** Replaces the authorization model. Returns the new model ID. */
  async writeModel(orgID: string, model: unknown): Promise<string> {
    const res = await this.c.put<{ authorization_model_id: string }>(this.c.orgPath(orgID, "/fga/model"), model);
    return res.authorization_model_id;
  }

  async check(orgID: string, t: FGATuple): Promise<boolean> {
    const res = await this.c.post<{ allowed: boolean }>(this.c.orgPath(orgID, "/fga/check"), t);
    return res.allowed;
  }

  write(orgID: string, writes: FGATuple[], deletes: FGATuple[] = []): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, "/fga/write"), { writes, deletes });
  }

  read(orgID: string, p: FGAReadParams = {}): Promise<FGAReadResult> {
    const q = new URLSearchParams();
    if (p.user) q.set("user", p.user);
    if (p.relation) q.set("relation", p.relation);
    if (p.object) q.set("object", p.object);
    if (p.page_size) q.set("page_size", String(p.page_size));
    if (p.continuation_token) q.set("continuation_token", p.continuation_token);
    const s = q.toString();
    return this.c.get(this.c.orgPath(orgID, "/fga/read") + (s ? `?${s}` : ""));
  }

  async listTemplates(orgID: string): Promise<FGATemplate[]> {
    const res = await this.c.get<{ templates: FGATemplate[] }>(this.c.orgPath(orgID, "/fga/templates"));
    return res.templates;
  }

  getTemplate(orgID: string, templateID: string): Promise<FGATemplate> {
    return this.c.get(this.c.orgPath(orgID, `/fga/templates/${templateID}`));
  }

  async importTemplate(orgID: string, templateID: string): Promise<string> {
    const res = await this.c.post<{ model_id: string }>(this.c.orgPath(orgID, `/fga/templates/${templateID}/import`));
    return res.model_id;
  }
}

// ── PAM (privileged access management) ────────────────────────────────────────

/**
 * PAMService manages JIT access requests, the credential vault, an SSH CA, and
 * recorded privileged sessions.
 *
 * SECURITY: checkout() and createCredential() return one-time plaintext
 * secrets — store them securely and never log them.
 */
export class PAMService {
  constructor(private readonly c: HttpClient) {}

  // Access requests
  createAccessRequest(orgID: string, p: CreateAccessRequestParams): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, "/pam/access-requests"), p);
  }

  listAccessRequests(orgID: string, status = "", page?: PAMPage): Promise<PAMListResult> {
    let q = pageQuery(page);
    if (status) q = q ? `${q}&status=${encodeURIComponent(status)}` : `?status=${encodeURIComponent(status)}`;
    return this.c.get(this.c.orgPath(orgID, "/pam/access-requests") + q);
  }

  getAccessRequest(orgID: string, reqID: string): Promise<Record<string, unknown>> {
    return this.c.get(this.c.orgPath(orgID, `/pam/access-requests/${reqID}`));
  }

  approveAccessRequest(orgID: string, reqID: string, note = ""): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, `/pam/access-requests/${reqID}/approve`), { note });
  }

  denyAccessRequest(orgID: string, reqID: string, note = ""): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, `/pam/access-requests/${reqID}/deny`), { note });
  }

  revokeAccessRequest(orgID: string, reqID: string, reason = ""): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, `/pam/access-requests/${reqID}/revoke`), { reason });
  }

  breakGlass(orgID: string, p: CreateAccessRequestParams): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, "/pam/access-requests/break-glass"), p);
  }

  // Credentials
  async listCredentials(orgID: string): Promise<Array<Record<string, unknown>>> {
    const res = await this.c.get<{ data: Array<Record<string, unknown>> }>(this.c.orgPath(orgID, "/pam/credentials"));
    return res.data;
  }

  createCredential(orgID: string, p: CreateCredentialParams): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, "/pam/credentials"), p);
  }

  updateCredential(orgID: string, credID: string, p: UpdateCredentialParams): Promise<void> {
    return this.c.put(this.c.orgPath(orgID, `/pam/credentials/${credID}`), p);
  }

  deleteCredential(orgID: string, credID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/pam/credentials/${credID}`));
  }

  /** Retrieve the one-time plaintext secret for a credential. */
  checkout(orgID: string, credID: string, reason: string, accessRequestID?: string): Promise<CheckoutResult> {
    const body: Record<string, unknown> = { reason };
    if (accessRequestID) body.access_request_id = accessRequestID;
    return this.c.post(this.c.orgPath(orgID, `/pam/credentials/${credID}/checkout`), body);
  }

  returnCheckout(orgID: string, credID: string, checkoutID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/pam/credentials/${credID}/return`), { checkout_id: checkoutID });
  }

  async listRotationLog(orgID: string, credID: string): Promise<Array<Record<string, unknown>>> {
    const res = await this.c.get<{ data: Array<Record<string, unknown>> }>(this.c.orgPath(orgID, `/pam/credentials/${credID}/rotation-log`));
    return res.data;
  }

  // SSH CA
  getSSHCA(orgID: string): Promise<Record<string, unknown>> {
    return this.c.get(this.c.orgPath(orgID, "/pam/ssh-ca"));
  }

  upsertSSHCA(orgID: string, p: SSHCAParams): Promise<void> {
    return this.c.put(this.c.orgPath(orgID, "/pam/ssh-ca"), p);
  }

  deleteSSHCA(orgID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, "/pam/ssh-ca"));
  }

  /** Returns the SSH CA public key in OpenSSH format (plain text). */
  getCAPublicKey(orgID: string): Promise<string> {
    return this.c.get(this.c.orgPath(orgID, "/pam/ssh-ca/public-key"));
  }

  signSSHKey(orgID: string, publicKey: string, validPrincipals: string, accessRequestID?: string): Promise<SignSSHKeyResult> {
    const body: Record<string, unknown> = { public_key: publicKey, valid_principals: validPrincipals };
    if (accessRequestID) body.access_request_id = accessRequestID;
    return this.c.post(this.c.orgPath(orgID, "/pam/ssh-ca/sign"), body);
  }

  // Sessions
  startSession(orgID: string, p: StartSessionParams): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, "/pam/sessions"), p);
  }

  listSessions(orgID: string, page?: PAMPage): Promise<PAMListResult> {
    return this.c.get(this.c.orgPath(orgID, "/pam/sessions") + pageQuery(page));
  }

  getSession(orgID: string, sessionID: string): Promise<Record<string, unknown>> {
    return this.c.get(this.c.orgPath(orgID, `/pam/sessions/${sessionID}`));
  }

  endSession(orgID: string, sessionID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/pam/sessions/${sessionID}/end`));
  }

  addSessionEvent(orgID: string, sessionID: string, eventType: string, payload?: unknown): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { event_type: eventType };
    if (payload !== undefined) body.payload = payload;
    return this.c.post(this.c.orgPath(orgID, `/pam/sessions/${sessionID}/events`), body);
  }

  async listSessionEvents(orgID: string, sessionID: string): Promise<Array<Record<string, unknown>>> {
    const res = await this.c.get<{ data: Array<Record<string, unknown>> }>(this.c.orgPath(orgID, `/pam/sessions/${sessionID}/events`));
    return res.data;
  }

  // Break-glass config
  getBreakGlassConfig(orgID: string): Promise<Record<string, unknown>> {
    return this.c.get(this.c.orgPath(orgID, "/pam/break-glass/config"));
  }

  putBreakGlassConfig(orgID: string, p: BreakGlassConfigParams): Promise<void> {
    return this.c.put(this.c.orgPath(orgID, "/pam/break-glass/config"), p);
  }
}
