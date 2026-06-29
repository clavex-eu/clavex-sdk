import { HttpClient } from "./client.js";
import {
  CreateServiceAccountParams,
  UpdateServiceAccountParams,
  ServiceAccountWithSecret,
  CreateLoginFlowParams,
  UpdateLoginFlowParams,
  LoginFlowStep,
  LifecycleRuleParams,
  CreateScimPushParams,
  UpdateScimPushParams,
  CreateSamlSpParams,
  WsfedRpParams,
  AppFamilyParams,
  IssueAgentTokenParams,
  CreateAccessReviewParams,
  CreateEntityReviewParams,
  ProcessingRecordParams,
  RetentionPolicyParams,
  UpsertActionTargetParams,
  CreateActionExecutionParams,
  CreateElevateParams,
  VerifyElevateParams,
} from "./types.js";

type Obj = Record<string, unknown>;

// ── Service accounts ───────────────────────────────────────────────────────────

export class ServiceAccountService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/service-accounts"));
  }
  get(orgID: string, id: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/service-accounts/${id}`));
  }
  create(orgID: string, p: CreateServiceAccountParams): Promise<ServiceAccountWithSecret> {
    return this.c.post(this.c.orgPath(orgID, "/service-accounts"), p);
  }
  update(orgID: string, id: string, p: UpdateServiceAccountParams): Promise<Obj> {
    return this.c.patch(this.c.orgPath(orgID, `/service-accounts/${id}`), p);
  }
  delete(orgID: string, id: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/service-accounts/${id}`));
  }
  /** Rotate the client secret (shown only once). */
  rotateSecret(orgID: string, id: string): Promise<ServiceAccountWithSecret> {
    return this.c.post(this.c.orgPath(orgID, `/service-accounts/${id}/secret`));
  }
}

// ── Login flows ────────────────────────────────────────────────────────────────

export class LoginFlowService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/login-flows"));
  }
  get(orgID: string, flowID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/login-flows/${flowID}`));
  }
  create(orgID: string, p: CreateLoginFlowParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/login-flows"), p);
  }
  update(orgID: string, flowID: string, p: UpdateLoginFlowParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, `/login-flows/${flowID}`), p);
  }
  delete(orgID: string, flowID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/login-flows/${flowID}`));
  }
  replaceSteps(orgID: string, flowID: string, steps: LoginFlowStep[]): Promise<Obj[]> {
    return this.c.put(this.c.orgPath(orgID, `/login-flows/${flowID}/steps`), steps);
  }
  listClients(orgID: string, flowID: string): Promise<string[]> {
    return this.c.get(this.c.orgPath(orgID, `/login-flows/${flowID}/clients`));
  }
  assignClient(orgID: string, flowID: string, clientID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/login-flows/${flowID}/clients`), { client_id: clientID });
  }
  unassignClient(orgID: string, flowID: string, clientID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/login-flows/${flowID}/clients/${clientID}`));
  }
}

// ── Lifecycle rules ────────────────────────────────────────────────────────────

export class LifecycleRuleService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/lifecycle-rules"));
  }
  get(orgID: string, ruleID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/lifecycle-rules/${ruleID}`));
  }
  create(orgID: string, p: LifecycleRuleParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/lifecycle-rules"), p);
  }
  update(orgID: string, ruleID: string, p: LifecycleRuleParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, `/lifecycle-rules/${ruleID}`), p);
  }
  delete(orgID: string, ruleID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/lifecycle-rules/${ruleID}`));
  }
}

// ── SCIM push ──────────────────────────────────────────────────────────────────

export class ScimPushService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/scim-push"));
  }
  create(orgID: string, p: CreateScimPushParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/scim-push"), p);
  }
  update(orgID: string, id: string, p: UpdateScimPushParams): Promise<Obj> {
    return this.c.patch(this.c.orgPath(orgID, `/scim-push/${id}`), p);
  }
  delete(orgID: string, id: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/scim-push/${id}`));
  }
  listDeliveries(orgID: string, id: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, `/scim-push/${id}/deliveries`));
  }
  retryDelivery(orgID: string, id: string, deliveryID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/scim-push/${id}/deliveries/${deliveryID}/retry`));
  }
}

// ── SAML SP ────────────────────────────────────────────────────────────────────

export class SamlSpService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/saml/sps"));
  }
  create(orgID: string, p: CreateSamlSpParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/saml/sps"), p);
  }
  delete(orgID: string, spID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/saml/sps/${spID}`));
  }
}

// ── WS-Fed RP ──────────────────────────────────────────────────────────────────

export class WsfedRpService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/wsfed/relying-parties"));
  }
  get(orgID: string, rpID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/wsfed/relying-parties/${rpID}`));
  }
  create(orgID: string, p: WsfedRpParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/wsfed/relying-parties"), p);
  }
  update(orgID: string, rpID: string, p: WsfedRpParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, `/wsfed/relying-parties/${rpID}`), p);
  }
  delete(orgID: string, rpID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/wsfed/relying-parties/${rpID}`));
  }
}

// ── App families ───────────────────────────────────────────────────────────────

export class AppFamilyService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/app-families"));
  }
  get(orgID: string, familyID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/app-families/${familyID}`));
  }
  create(orgID: string, p: AppFamilyParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/app-families"), p);
  }
  update(orgID: string, familyID: string, p: AppFamilyParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, `/app-families/${familyID}`), p);
  }
  delete(orgID: string, familyID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/app-families/${familyID}`));
  }
  addMember(orgID: string, familyID: string, clientID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/app-families/${familyID}/members`), { client_id: clientID });
  }
  removeMember(orgID: string, familyID: string, clientID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/app-families/${familyID}/members/${clientID}`));
  }
}

// ── Agent tokens ───────────────────────────────────────────────────────────────

export class AgentTokenService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/agent-tokens"));
  }
  /** Issue a scoped agent token (shown only once). */
  issue(orgID: string, p: IssueAgentTokenParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/agent-tokens"), p);
  }
  delete(orgID: string, id: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/agent-tokens/${id}`));
  }
  mcpScopes(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/agent-tokens/mcp-scopes"));
  }
}

// ── Access-review campaigns ────────────────────────────────────────────────────

export class AccessReviewService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/access-reviews"));
  }
  get(orgID: string, campaignID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/access-reviews/${campaignID}`));
  }
  create(orgID: string, p: CreateAccessReviewParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/access-reviews"), p);
  }
  delete(orgID: string, campaignID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/access-reviews/${campaignID}`));
  }
  launch(orgID: string, campaignID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/access-reviews/${campaignID}/launch`));
  }
  listItems(orgID: string, campaignID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, `/access-reviews/${campaignID}/items`));
  }
  report(orgID: string, campaignID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/access-reviews/${campaignID}/report`));
  }
}

// ── Entity-review campaigns ────────────────────────────────────────────────────

export class EntityReviewService {
  constructor(private readonly c: HttpClient) {}
  list(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/entity-review-campaigns"));
  }
  get(orgID: string, campaignID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/entity-review-campaigns/${campaignID}`));
  }
  create(orgID: string, p: CreateEntityReviewParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/entity-review-campaigns"), p);
  }
  delete(orgID: string, campaignID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/entity-review-campaigns/${campaignID}`));
  }
  activate(orgID: string, campaignID: string, reviewerID: string): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, `/entity-review-campaigns/${campaignID}/activate`), { reviewer_id: reviewerID });
  }
  listItems(orgID: string, campaignID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, `/entity-review-campaigns/${campaignID}/items`));
  }
}

// ── Compliance & GDPR ──────────────────────────────────────────────────────────

export class ComplianceService {
  constructor(private readonly c: HttpClient) {}
  score(orgID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, "/compliance/score"));
  }
  scoreHistory(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/compliance/score/history"));
  }
  gdprReport(orgID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, "/compliance/gdpr"));
  }
  nis2Report(orgID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, "/compliance/nis2"));
  }
  dsar(orgID: string, userID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/compliance/dsar/${userID}`));
  }
  listProcessingRecords(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/compliance/processing-records"));
  }
  createProcessingRecord(orgID: string, p: ProcessingRecordParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/compliance/processing-records"), p);
  }
  updateProcessingRecord(orgID: string, recordID: string, p: ProcessingRecordParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, `/compliance/processing-records/${recordID}`), p);
  }
  deleteProcessingRecord(orgID: string, recordID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/compliance/processing-records/${recordID}`));
  }
  auditPack(orgID: string): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/compliance/audit-pack"));
  }
  gdprExport(orgID: string): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/compliance/gdpr/export"));
  }
  gdprErasure(orgID: string, userID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/compliance/gdpr-erasure/${userID}`));
  }
}

export class GdprService {
  constructor(private readonly c: HttpClient) {}
  getRetentionPolicy(orgID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, "/gdpr/retention-policy"));
  }
  putRetentionPolicy(orgID: string, p: RetentionPolicyParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, "/gdpr/retention-policy"), p);
  }
  deleteRetentionPolicy(orgID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, "/gdpr/retention-policy"));
  }
}

// ── Event actions ──────────────────────────────────────────────────────────────

export class ActionsService {
  constructor(private readonly c: HttpClient) {}
  listTargets(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/actions/targets"));
  }
  upsertTarget(orgID: string, name: string, p: UpsertActionTargetParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, `/actions/targets/${name}`), p);
  }
  deleteTarget(orgID: string, targetID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/actions/targets/${targetID}`));
  }
  listExecutions(orgID: string): Promise<Obj[]> {
    return this.c.get(this.c.orgPath(orgID, "/actions/executions"));
  }
  createExecution(orgID: string, p: CreateActionExecutionParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/actions/executions"), p);
  }
  updateExecution(orgID: string, executionID: string, p: CreateActionExecutionParams): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, `/actions/executions/${executionID}`), p);
  }
  deleteExecution(orgID: string, executionID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/actions/executions/${executionID}`));
  }
}

// ── AI copilot ─────────────────────────────────────────────────────────────────

export class AIService {
  constructor(private readonly c: HttpClient) {}
  getConfig(orgID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, "/ai/config"));
  }
  putConfig(orgID: string, cfg: Obj): Promise<Obj> {
    return this.c.put(this.c.orgPath(orgID, "/ai/config"), cfg);
  }
  /**
   * Invoke an AI suggestion/analysis endpoint by kind, e.g. "suggest-policy",
   * "suggest-dcql", "explain-anomaly", "audit-copilot", "nl-audit-query".
   */
  suggest(orgID: string, kind: string, body?: unknown): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, `/ai/${kind}`), body);
  }
}

// ── Step-up (elevate) ──────────────────────────────────────────────────────────

export class ElevateService {
  constructor(private readonly c: HttpClient) {}
  create(orgID: string, p: CreateElevateParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, "/elevate"), p);
  }
  get(orgID: string, challengeID: string): Promise<Obj> {
    return this.c.get(this.c.orgPath(orgID, `/elevate/${challengeID}`));
  }
  verify(orgID: string, challengeID: string, p: VerifyElevateParams): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, `/elevate/${challengeID}/verify`), p);
  }
  webauthnBegin(orgID: string, challengeID: string): Promise<Obj> {
    return this.c.post(this.c.orgPath(orgID, `/elevate/${challengeID}/webauthn/begin`));
  }
}
