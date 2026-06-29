import { HttpClient } from "./client.js";
import {
  VCICredentialConfig,
  CreateVCIConfigParams,
  PatchVCIConfigParams,
  VCIOffer,
  CreateVCIOfferParams,
  CreateVCIOfferResponse,
  SendVCIOfferParams,
  VCIIssuedCredential,
  VPSession,
  BatchVerifyItem,
  BatchVerifyResult,
  MdocIssuer,
  IACARoot,
  GenerateIssuerParams,
  GenerateIssuerResponse,
  CreateMdocIssuerParams,
  CreateIACARootParams,
  FederationSubordinate,
  RegisterSubordinateParams,
  TrustMarkType,
  UpsertTrustMarkTypeParams,
  RevokeTrustMarkParams,
} from "./types.js";

// ── OID4VCI (credential issuance) ─────────────────────────────────────────────

/** OID4VCIService manages credential configs, offers, issued credentials and deferred issuance. */
export class OID4VCIService {
  constructor(private readonly c: HttpClient) {}

  listConfigs(orgID: string): Promise<VCICredentialConfig[]> {
    return this.c.get(this.c.orgPath(orgID, "/oid4vci/configs"));
  }

  createConfig(orgID: string, p: CreateVCIConfigParams): Promise<VCICredentialConfig> {
    return this.c.post(this.c.orgPath(orgID, "/oid4vci/configs"), p);
  }

  patchConfig(orgID: string, configID: string, p: PatchVCIConfigParams): Promise<VCICredentialConfig> {
    return this.c.patch(this.c.orgPath(orgID, `/oid4vci/configs/${configID}`), p);
  }

  deleteConfig(orgID: string, configID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/oid4vci/configs/${configID}`));
  }

  catalog(orgID: string): Promise<Record<string, unknown>> {
    return this.c.get(this.c.orgPath(orgID, "/oid4vci/catalog"));
  }

  /**
   * Seed a built-in catalog template. Pass an empty `variant` for the default
   * set, or one of "mdl", "spid", "it-wallet", "cie", "cie-wallet",
   * "age-over-18", "spid-mdl".
   */
  seedCatalog(orgID: string, variant = ""): Promise<void> {
    const path = variant ? `/oid4vci/catalog/seed-${variant}` : "/oid4vci/catalog/seed";
    return this.c.post(this.c.orgPath(orgID, path));
  }

  analyticsSummary(orgID: string): Promise<Record<string, unknown>> {
    return this.c.get(this.c.orgPath(orgID, "/oid4vci/analytics/summary"));
  }

  listOffers(orgID: string): Promise<VCIOffer[]> {
    return this.c.get(this.c.orgPath(orgID, "/oid4vci/offers"));
  }

  createOffer(orgID: string, p: CreateVCIOfferParams): Promise<CreateVCIOfferResponse> {
    return this.c.post(this.c.orgPath(orgID, "/oid4vci/offers"), p);
  }

  sendOffer(orgID: string, offerID: string, p: SendVCIOfferParams): Promise<Record<string, unknown>> {
    return this.c.post(this.c.orgPath(orgID, `/oid4vci/offers/${offerID}/send`), p);
  }

  listIssued(orgID: string): Promise<VCIIssuedCredential[]> {
    return this.c.get(this.c.orgPath(orgID, "/oid4vci/issued"));
  }

  revokeIssued(orgID: string, credID: string, reason: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/oid4vci/issued/${credID}/revoke`), { reason });
  }

  restoreIssued(orgID: string, credID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/oid4vci/issued/${credID}/restore`));
  }

  listDeferred(orgID: string): Promise<Array<Record<string, unknown>>> {
    return this.c.get(this.c.orgPath(orgID, "/oid4vci/deferred"));
  }

  approveDeferred(orgID: string, txnID: string): Promise<void> {
    return this.c.post(this.c.orgPath(orgID, `/oid4vci/deferred/${txnID}/approve`));
  }
}

// ── OID4VP (credential verification) ──────────────────────────────────────────

/** OID4VPService inspects presentation sessions and batch-verifies vp_tokens. */
export class OID4VPService {
  constructor(private readonly c: HttpClient) {}

  listSessions(orgID: string): Promise<VPSession[]> {
    return this.c.get(this.c.orgPath(orgID, "/oid4vp/sessions"));
  }

  getSession(orgID: string, sessionID: string): Promise<VPSession> {
    return this.c.get(this.c.orgPath(orgID, `/oid4vp/sessions/${sessionID}`));
  }

  async batchVerify(orgID: string, items: BatchVerifyItem[]): Promise<BatchVerifyResult[]> {
    const res = await this.c.post<{ results: BatchVerifyResult[] }>(
      this.c.orgPath(orgID, "/oid4vp/batch-verify"),
      { items },
    );
    return res.results;
  }
}

// ── mdoc (ISO 18013-5) ────────────────────────────────────────────────────────

/** MdocService manages mdoc issuers and IACA trust roots. */
export class MdocService {
  constructor(private readonly c: HttpClient) {}

  listIssuers(orgID: string): Promise<MdocIssuer[]> {
    return this.c.get(this.c.orgPath(orgID, "/mdoc/issuers"));
  }

  generateIssuer(orgID: string, p: GenerateIssuerParams): Promise<GenerateIssuerResponse> {
    return this.c.post(this.c.orgPath(orgID, "/mdoc/issuers/generate"), p);
  }

  createIssuer(orgID: string, p: CreateMdocIssuerParams): Promise<MdocIssuer> {
    return this.c.post(this.c.orgPath(orgID, "/mdoc/issuers"), p);
  }

  deleteIssuer(orgID: string, issuerID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/mdoc/issuers/${issuerID}`));
  }

  listIACARoots(orgID: string): Promise<IACARoot[]> {
    return this.c.get(this.c.orgPath(orgID, "/mdoc/iaca-roots"));
  }

  createIACARoot(orgID: string, p: CreateIACARootParams): Promise<IACARoot> {
    return this.c.post(this.c.orgPath(orgID, "/mdoc/iaca-roots"), p);
  }

  deleteIACARoot(orgID: string, rootID: string): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, `/mdoc/iaca-roots/${rootID}`));
  }

  listSessions(orgID: string): Promise<Array<Record<string, unknown>>> {
    return this.c.get(this.c.orgPath(orgID, "/mdoc/sessions"));
  }

  getSession(orgID: string, sessionID: string): Promise<Record<string, unknown>> {
    return this.c.get(this.c.orgPath(orgID, `/mdoc/sessions/${sessionID}`));
  }
}

// ── OpenID Federation (trust anchor) ──────────────────────────────────────────

/**
 * FederationService manages subordinate entities and trust-mark types.
 * Subordinate operations identify the entity via the `entity_id` query param.
 */
export class FederationService {
  constructor(private readonly c: HttpClient) {}

  /** status: "active" | "suspended" | "revoked" | "all" | "" (default). */
  async listSubordinates(orgID: string, status = ""): Promise<FederationSubordinate[]> {
    let path = this.c.orgPath(orgID, "/federation/subordinates");
    if (status) path += `?status=${encodeURIComponent(status)}`;
    const res = await this.c.get<{ subordinates: FederationSubordinate[]; count: number }>(path);
    return res.subordinates;
  }

  getSubordinate(orgID: string, entityID: string): Promise<FederationSubordinate> {
    const path = this.c.orgPath(orgID, "/federation/subordinates/detail") + `?entity_id=${encodeURIComponent(entityID)}`;
    return this.c.get(path);
  }

  registerSubordinate(orgID: string, p: RegisterSubordinateParams): Promise<FederationSubordinate> {
    return this.c.post(this.c.orgPath(orgID, "/federation/subordinates"), p);
  }

  updateSubordinate(orgID: string, entityID: string, p: RegisterSubordinateParams): Promise<FederationSubordinate> {
    const path = this.c.orgPath(orgID, "/federation/subordinates") + `?entity_id=${encodeURIComponent(entityID)}`;
    return this.c.put(path, p);
  }

  revokeSubordinate(orgID: string, entityID: string): Promise<void> {
    const path = this.c.orgPath(orgID, "/federation/subordinates") + `?entity_id=${encodeURIComponent(entityID)}`;
    return this.c.delete(path);
  }

  listTrustMarkTypes(orgID: string): Promise<TrustMarkType[]> {
    return this.c.get(this.c.orgPath(orgID, "/federation/trust-mark-types"));
  }

  upsertTrustMarkType(orgID: string, p: UpsertTrustMarkTypeParams): Promise<TrustMarkType> {
    return this.c.post(this.c.orgPath(orgID, "/federation/trust-mark-types"), p);
  }

  /** Revoke an issued trust mark. Parameters are sent in the DELETE body. */
  revokeTrustMark(orgID: string, p: RevokeTrustMarkParams): Promise<void> {
    return this.c.delete(this.c.orgPath(orgID, "/federation/trust-marks"), p);
  }
}
