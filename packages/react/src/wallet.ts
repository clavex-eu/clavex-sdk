/**
 * @clavex/react — Verifiable Credential Web Wallet
 *
 * Provides `useWallet()`, `useCredentialOffer()`, and the types that back
 * the `<ClavexWallet />` embeddable component.
 *
 * Architecture
 * ────────────
 * The web wallet stores issued VCs in localStorage under the key
 * `clavex:wallet:<issuer>:<userId>`. Each entry is a `StoredCredential`
 * serialised as JSON.  The server-side `/api/v1/me/credentials` endpoint
 * is polled on mount to reconcile revocation status.
 *
 * SD-JWT decoding is done locally — no raw token leaves the browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useClavexContext } from "./context.js";
import { decodeJwtPayload, base64urlDecode, orgSlugFromIssuer, baseUrlFromIssuer } from "./oidc.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Display metadata for a credential type, sourced from the issuer's
 * `/.well-known/openid-credential-issuer` metadata.
 */
export interface CredentialDisplay {
  name: string;
  description?: string;
  /** CSS background color string, e.g. `"#1D3557"`. */
  backgroundColor?: string;
  textColor?: string;
  logo?: string;
}

/**
 * A Verifiable Credential stored in the browser.
 * The `raw` field holds the full SD-JWT (or base64url-encoded mDoc).
 * Claims are eagerly decoded from the SD-JWT disclosures for display.
 */
export interface StoredCredential {
  /** UUID generated locally at storage time. */
  id: string;
  vct: string;
  format: "dc+sd-jwt" | "mso_mdoc" | string;
  /** The raw SD-JWT token or base64url-encoded mDoc bytes. */
  raw: string;
  /** Decoded, disclosed claims — what the holder chose to reveal at issuance. */
  claims: Record<string, unknown>;
  issuedAt: number; // unix epoch seconds
  expiresAt?: number;
  issuer: string;
  display?: CredentialDisplay;
}

/**
 * Server-side credential metadata from `GET /api/v1/me/credentials`.
 * Used to reconcile revocation status without exposing the raw token.
 */
export interface CredentialServerRecord {
  id: string;
  vct: string;
  issued_at: string;
  expires_at?: string;
  is_revoked: boolean;
  revocation_reason?: string;
}

/** Return value of `useWallet()`. */
export interface UseWalletReturn {
  /** All credentials stored locally (live, non-revoked first). */
  credentials: StoredCredential[];
  /** Server-side revocation records keyed by `vct`. */
  serverRecords: CredentialServerRecord[];
  isLoading: boolean;
  error: string | null;
  /** Add a credential from a raw SD-JWT string. */
  addCredential: (raw: string, display?: CredentialDisplay) => StoredCredential | null;
  /** Remove a locally stored credential by its local `id`. */
  removeCredential: (localId: string) => void;
  /** Force-refresh the server revocation status. */
  refresh: () => void;
}

/** Return value of `useCredentialOffer()`. */
export interface UseCredentialOfferReturn {
  isPending: boolean;
  isSuccess: boolean;
  error: string | null;
  /** Parse and accept an `openid-credential-offer://` URI. */
  accept: (offerUri: string, txCode?: string) => Promise<StoredCredential[]>;
}

// ── SD-JWT helpers ────────────────────────────────────────────────────────────

/**
 * Parse an SD-JWT string into its header, payload, signature, and disclosures.
 * Format: `<header>.<payload>.<signature>~<disc1>~<disc2>~…`
 */
function parseSdJwt(raw: string): {
  payload: Record<string, unknown>;
  disclosures: Array<[string, string, unknown]>; // [salt, name, value]
} | null {
  try {
    const parts = raw.split("~");
    const jwt = parts[0];
    const disclosureB64 = parts.slice(1).filter(Boolean);

    const jwtParts = jwt.split(".");
    if (jwtParts.length < 3) return null;
    const payload = decodeJwtPayload(jwt) as Record<string, unknown>;

    const disclosures = disclosureB64
      .map((d) => {
        try {
          const bytes = base64urlDecode(d);
          const text = new TextDecoder().decode(bytes);
          const arr = JSON.parse(text) as [string, string, unknown];
          return arr;
        } catch {
          return null;
        }
      })
      .filter((d): d is [string, string, unknown] => d !== null && d.length === 3);

    return { payload, disclosures };
  } catch {
    return null;
  }
}

/**
 * Extract human-readable claims from an SD-JWT.
 * Combines top-level non-`_sd` fields with disclosed `_sd` values.
 */
function extractClaims(raw: string, format: string): Record<string, unknown> {
  if (format === "mso_mdoc") {
    return { _format: "mDL / mDoc", _note: "CBOR document — view on a supporting wallet app" };
  }
  const parsed = parseSdJwt(raw);
  if (!parsed) return {};
  const { payload, disclosures } = parsed;
  const claims: Record<string, unknown> = {};

  // Top-level disclosed claims (not `_sd`, `iss`, `iat`, etc.)
  const skip = new Set(["_sd", "_sd_alg", "iss", "iat", "exp", "cnf", "vct", "status"]);
  for (const [k, v] of Object.entries(payload)) {
    if (!skip.has(k)) claims[k] = v;
  }
  // Selective disclosures
  for (const [, name, value] of disclosures) {
    claims[name] = value;
  }
  return claims;
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const STORAGE_PREFIX = "clavex:wallet";

function storageKey(issuer: string, userId: string): string {
  return `${STORAGE_PREFIX}:${issuer}:${userId}`;
}

function loadCredentials(issuer: string, userId: string): StoredCredential[] {
  try {
    const raw = localStorage.getItem(storageKey(issuer, userId));
    if (!raw) return [];
    return JSON.parse(raw) as StoredCredential[];
  } catch {
    return [];
  }
}

function saveCredentials(issuer: string, userId: string, creds: StoredCredential[]): void {
  try {
    localStorage.setItem(storageKey(issuer, userId), JSON.stringify(creds));
  } catch {
    // Storage quota exceeded — silently ignore.
  }
}

function generateLocalId(): string {
  // Crypto-random UUIDv4
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── useWallet ─────────────────────────────────────────────────────────────────

/**
 * Manages the current user's Verifiable Credentials stored in the browser.
 *
 * Credentials are kept in localStorage and reconciled with server-side
 * revocation records from `GET /api/v1/me/credentials`.
 *
 * @example
 * ```tsx
 * const { credentials, isLoading, acceptOffer } = useWallet();
 * ```
 */
export function useWallet(): UseWalletReturn {
  const { config, status, user, tokens: tokenSet } = useClavexContext();
  const issuer = config.issuer;
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [serverRecords, setServerRecords] = useState<CredentialServerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? "";

  // Load from localStorage on mount / user change.
  useEffect(() => {
    if (!issuer || !userId) return;
    setCredentials(loadCredentials(issuer, userId));
  }, [issuer, userId]);

  const refresh = useCallback(async () => {
    if (status !== "authenticated" || !tokenSet?.accessToken || !issuer || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const base = baseUrlFromIssuer(issuer);
      const res = await fetch(`${base}/api/v1/me/credentials`, {
        headers: { Authorization: `Bearer ${tokenSet.accessToken}` },
      });
      if (!res.ok) throw new Error(`server returned ${res.status}`);
      const data = (await res.json()) as { credentials: CredentialServerRecord[] };
      setServerRecords(data.credentials ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to sync credentials");
    } finally {
      setIsLoading(false);
    }
  }, [issuer, userId, status, tokenSet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persistCreds = useCallback(
    (creds: StoredCredential[]) => {
      if (!issuer || !userId) return;
      setCredentials(creds);
      saveCredentials(issuer, userId, creds);
    },
    [issuer, userId],
  );

  const addCredential = useCallback(
    (raw: string, display?: CredentialDisplay): StoredCredential | null => {
      try {
        const parts = raw.split("~");
        const parsed = parseSdJwt(raw);
        if (!parsed && !raw.includes(".")) return null; // not a JWT-like format

        const payload = parsed?.payload ?? (decodeJwtPayload(parts[0]) as Record<string, unknown>);
        const format = typeof payload?.["format"] === "string"
          ? payload["format"]
          : raw.includes("~") ? "dc+sd-jwt" : "mso_mdoc";

        const credential: StoredCredential = {
          id: generateLocalId(),
          vct: (payload?.["vct"] as string) ?? (payload?.["doctype"] as string) ?? "unknown",
          format,
          raw,
          claims: extractClaims(raw, format),
          issuedAt: typeof payload?.["iat"] === "number" ? payload["iat"] : Math.floor(Date.now() / 1000),
          expiresAt: typeof payload?.["exp"] === "number" ? payload["exp"] : undefined,
          issuer: (payload?.["iss"] as string) ?? issuer,
          display,
        };

        const updated = [credential, ...credentials.filter((c) => c.raw !== raw)];
        persistCreds(updated);
        return credential;
      } catch {
        return null;
      }
    },
    [credentials, issuer, persistCreds],
  );

  const removeCredential = useCallback(
    (localId: string) => {
      persistCreds(credentials.filter((c) => c.id !== localId));
    },
    [credentials, persistCreds],
  );

  return { credentials, serverRecords, isLoading, error, addCredential, removeCredential, refresh };
}

// ── useCredentialOffer ────────────────────────────────────────────────────────

/**
 * Accepts an OID4VCI credential offer and stores all issued VCs locally.
 *
 * Handles both `credential_offer=` (inline) and `credential_offer_uri=`
 * (redirect). Only the pre-authorized code grant is supported — the
 * authorization code grant should fall back to the normal OIDC flow.
 *
 * @example
 * ```tsx
 * const { accept, isPending, error } = useCredentialOffer();
 *
 * // Called from the IDP redirect URL or after scanning a QR:
 * await accept("openid-credential-offer://?credential_offer=...");
 * ```
 */
export function useCredentialOffer(): UseCredentialOfferReturn {
  const { addCredential } = useWallet();
  const { tokens: tokenSet } = useClavexContext();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    async (offerUri: string, txCode?: string): Promise<StoredCredential[]> => {
      setIsPending(true);
      setIsSuccess(false);
      setError(null);
      try {
        // ── 1. Parse offer URI ───────────────────────────────────────────────
        const url = new URL(offerUri.replace(/^openid-credential-offer:\/\//, "https://placeholder/"));
        let offer: CredentialOffer;

        const inlineParam = url.searchParams.get("credential_offer");
        const uriParam = url.searchParams.get("credential_offer_uri");

        if (inlineParam) {
          offer = JSON.parse(inlineParam) as CredentialOffer;
        } else if (uriParam) {
          const resp = await fetch(uriParam);
          if (!resp.ok) throw new Error(`credential_offer_uri fetch failed: ${resp.status}`);
          offer = (await resp.json()) as CredentialOffer;
        } else {
          throw new Error("no credential_offer or credential_offer_uri in the offer URI");
        }

        const credentialIssuer: string = offer.credential_issuer;
        const grants = offer.grants ?? {};

        // ── 2. Obtain an access token ────────────────────────────────────────
        let accessToken: string;

        const preAuth = grants["urn:ietf:params:oauth:grant-type:pre-authorized_code"] as Record<string, unknown> | undefined;
        if (preAuth) {
          const tokenParams = new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code",
            "pre-authorized_code": preAuth["pre-authorized_code"] as string,
          });
          if (txCode) tokenParams.set("tx_code", txCode);

          const tokenRes = await fetch(`${credentialIssuer}/oid4vci/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams.toString(),
          });
          if (!tokenRes.ok) {
            const err = await tokenRes.text();
            throw new Error(`token exchange failed: ${err}`);
          }
          const tokenData = (await tokenRes.json()) as { access_token: string; c_nonce?: string };
          accessToken = tokenData.access_token;
        } else if (tokenSet?.accessToken) {
          // Auth-code offer — reuse the current OIDC access token.
          accessToken = tokenSet.accessToken;
        } else {
          throw new Error("no pre-authorized_code grant and no active session token");
        }

        // ── 3. Request each credential ───────────────────────────────────────
        const configIds: string[] = offer.credential_configuration_ids ?? [];
        const issued: StoredCredential[] = [];

        for (const configId of configIds) {
          const credRes = await fetch(`${credentialIssuer}/oid4vci/credential`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ credential_identifier: configId }),
          });
          if (!credRes.ok) continue;

          const credData = (await credRes.json()) as { credential?: string; credentials?: string[] };
          const raws: string[] = [];
          if (credData.credential) raws.push(credData.credential);
          if (credData.credentials) raws.push(...credData.credentials);

          for (const raw of raws) {
            const stored = addCredential(raw);
            if (stored) issued.push(stored);
          }
        }

        setIsSuccess(true);
        return issued;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "credential offer failed";
        setError(msg);
        return [];
      } finally {
        setIsPending(false);
      }
    },
    [addCredential, tokenSet],
  );

  return { isPending, isSuccess, error, accept };
}

// Internal type for parsing OID4VCI credential offers (RFC-draft)
interface CredentialOffer {
  credential_issuer: string;
  credential_configuration_ids?: string[];
  // legacy field
  credentials?: Array<string | { format: string; types: string[] }>;
  grants?: Record<string, unknown>;
}
