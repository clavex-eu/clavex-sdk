import React from "react";
/**
 * <ClavexWallet />
 *
 * Embeddable web wallet for Verifiable Credentials.
 * Shows the authenticated user's credentials, decoded claims, and lets them
 * initiate OID4VP presentations to a verifier.
 *
 * No external dependencies beyond React — styles are inlined via a `<style>`
 * tag injected once into the document head so the component works in any
 * framework without CSS imports.
 *
 * @example
 * ```tsx
 * import { ClavexProvider, ClavexWallet } from "@clavex/react";
 *
 * function MyPage() {
 *   return (
 *     <ClavexProvider issuer="https://id.example.com/acme" clientId="my-spa">
 *       <ClavexWallet />
 *     </ClavexProvider>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet, useCredentialOffer, StoredCredential, CredentialServerRecord } from "./wallet.js";
import { useClavexContext } from "./context.js";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ClavexWalletProps {
  /**
   * CSS class applied to the root container.
   * Use this to constrain width or embed inside a card.
   */
  className?: string;

  /**
   * Called when the user clicks "Present" on a credential.
   * By default, the built-in QR modal is shown.
   * Override to implement a custom presentation flow.
   */
  onPresent?: (credential: StoredCredential) => void;

  /**
   * Called after a credential offer is accepted.
   */
  onCredentialAdded?: (credential: StoredCredential) => void;

  /**
   * Placeholder text when no credentials exist.
   * Defaults to a friendly "your wallet is empty" message.
   */
  emptyText?: string;

  /**
   * When true, shows the "Add credential" button which opens
   * a text field to paste an `openid-credential-offer://` URI.
   * Defaults to `true`.
   */
  showAddButton?: boolean;
}

// ── Styles (injected once) ────────────────────────────────────────────────────

const STYLE_ID = "__clavex_wallet_styles__";

const WALLET_CSS = `
.clw-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #c4dff0;
  --clw-bg:       #0d1f2d;
  --clw-bg2:      #112233;
  --clw-bg3:      #162b40;
  --clw-rule:     #1e3448;
  --clw-muted:    #3e6070;
  --clw-body:     #7aaabb;
  --clw-text:     #c4dff0;
  --clw-bright:   #e8f4ff;
  --clw-teal:     #5dcaa5;
  --clw-teal-d:   #1d9e75;
  --clw-teal-p:   #0d3028;
  --clw-amber:    #f5c842;
  --clw-red:      #e85a6a;
  --clw-radius:   8px;
}
.clw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px 0;
  border-bottom: 1px solid var(--clw-rule);
  margin-bottom: 16px;
}
.clw-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--clw-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}
.clw-title-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--clw-teal);
}
.clw-btn {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  padding: 6px 14px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: all .15s;
}
.clw-btn-ghost {
  background: transparent;
  border: 1px solid var(--clw-rule);
  color: var(--clw-body);
}
.clw-btn-ghost:hover { border-color: var(--clw-teal); color: var(--clw-teal); }
.clw-btn-primary { background: var(--clw-teal); color: var(--clw-bg); }
.clw-btn-primary:hover { background: #6ed9b5; }
.clw-btn-danger { background: transparent; border: 1px solid var(--clw-red); color: var(--clw-red); }
.clw-btn-danger:hover { background: rgba(232,90,106,.08); }
.clw-btn-sm { padding: 4px 10px; font-size: 11px; }

.clw-cards { display: flex; flex-direction: column; gap: 10px; }

.clw-card {
  background: var(--clw-bg2);
  border: 1px solid var(--clw-rule);
  border-radius: var(--clw-radius);
  overflow: hidden;
  transition: border-color .2s;
}
.clw-card:hover { border-color: var(--clw-teal); }
.clw-card.revoked { opacity: .55; border-color: var(--clw-red) !important; }

.clw-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
}
.clw-card-icon {
  width: 36px; height: 36px; border-radius: 6px;
  background: var(--clw-bg3);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.clw-card-meta { flex: 1; min-width: 0; }
.clw-card-name {
  font-size: 13px; font-weight: 600; color: var(--clw-bright);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.clw-card-vct {
  font-size: 11px; color: var(--clw-muted);
  font-family: 'SFMono-Regular', Consolas, monospace;
  margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.clw-card-status {
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 3px;
}
.clw-status-valid { background: var(--clw-teal-p); color: var(--clw-teal); }
.clw-status-revoked { background: rgba(232,90,106,.15); color: var(--clw-red); }
.clw-status-expired { background: rgba(245,200,66,.12); color: var(--clw-amber); }

.clw-card-body {
  padding: 0 16px 14px;
  border-top: 1px solid var(--clw-rule);
}
.clw-claims {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
  margin: 12px 0;
}
@media (max-width: 480px) { .clw-claims { grid-template-columns: 1fr; } }
.clw-claim { display: flex; flex-direction: column; gap: 2px; }
.clw-claim-key {
  font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
  color: var(--clw-muted);
}
.clw-claim-val {
  font-size: 12px; color: var(--clw-text);
  word-break: break-word;
}
.clw-card-actions {
  display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;
  padding-top: 12px; border-top: 1px solid var(--clw-rule);
}

.clw-empty {
  text-align: center; padding: 40px 16px;
  color: var(--clw-muted); font-size: 13px; line-height: 1.7;
}
.clw-empty-icon { font-size: 32px; margin-bottom: 12px; display: block; }

.clw-add-form {
  margin-top: 16px;
  padding: 14px;
  background: var(--clw-bg3);
  border: 1px solid var(--clw-rule);
  border-radius: var(--clw-radius);
}
.clw-add-form label {
  display: block; font-size: 11px; font-weight: 600;
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--clw-muted); margin-bottom: 6px;
}
.clw-input {
  width: 100%; box-sizing: border-box;
  background: var(--clw-bg2);
  border: 1px solid var(--clw-rule);
  border-radius: 4px;
  color: var(--clw-text);
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  padding: 8px 10px;
  outline: none;
  transition: border-color .15s;
}
.clw-input:focus { border-color: var(--clw-teal); }
.clw-add-actions { display: flex; gap: 8px; margin-top: 8px; }

.clw-error {
  font-size: 12px; color: var(--clw-red);
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(232,90,106,.08);
  border-radius: 4px;
  border: 1px solid rgba(232,90,106,.2);
}

/* ── Presentation modal ─────────────────────────────────────────────────── */
.clw-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.65);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.clw-modal {
  background: var(--clw-bg2);
  border: 1px solid var(--clw-rule);
  border-radius: var(--clw-radius);
  padding: 24px;
  max-width: 420px; width: 100%;
  position: relative;
}
.clw-modal-title {
  font-size: 14px; font-weight: 600; color: var(--clw-bright);
  margin-bottom: 16px;
}
.clw-modal-close {
  position: absolute; top: 12px; right: 14px;
  background: none; border: none; color: var(--clw-muted);
  font-size: 18px; cursor: pointer; line-height: 1;
  padding: 0;
}
.clw-modal-close:hover { color: var(--clw-bright); }
.clw-present-hint {
  font-size: 12px; color: var(--clw-body); line-height: 1.65;
  margin-bottom: 16px;
}
.clw-present-raw {
  background: var(--clw-bg);
  border: 1px solid var(--clw-rule);
  border-radius: 4px;
  padding: 10px;
  font-size: 11px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--clw-muted);
  word-break: break-all;
  max-height: 80px;
  overflow-y: auto;
  margin-bottom: 12px;
}
.clw-copied { color: var(--clw-teal); font-size: 11px; margin-top: 4px; }
`;

function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WALLET_CSS;
  document.head.appendChild(style);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function credentialIcon(vct: string, format: string): string {
  if (format === "mso_mdoc") return "🪪";
  if (vct.includes("mdl") || vct.includes("driving")) return "🪪";
  if (vct.includes("spid") || vct.includes("cie") || vct.includes("pid")) return "🇮🇹";
  if (vct.includes("employee") || vct.includes("badge")) return "💼";
  if (vct.includes("email")) return "📧";
  if (vct.includes("diploma") || vct.includes("cert")) return "🎓";
  return "📄";
}

function credentialDisplayName(cred: StoredCredential): string {
  if (cred.display?.name) return cred.display.name;
  // Derive from VCT
  return cred.vct
    .split(/[./#_-]/)
    .pop()!
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatClaimValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function credentialStatus(cred: StoredCredential, records: CredentialServerRecord[]): "valid" | "revoked" | "expired" {
  // Check server-side revocation by VCT match
  const rec = records.find((r) => r.vct === cred.vct);
  if (rec?.is_revoked) return "revoked";
  if (cred.expiresAt && cred.expiresAt < Math.floor(Date.now() / 1000)) return "expired";
  return "valid";
}

// ── CredentialCard ────────────────────────────────────────────────────────────

interface CardProps {
  credential: StoredCredential;
  status: "valid" | "revoked" | "expired";
  onRemove: () => void;
  onPresent: () => void;
}

function CredentialCard({ credential, status, onRemove, onPresent }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const claimEntries = Object.entries(credential.claims).slice(0, 12);
  const displayName = credentialDisplayName(credential);
  const icon = credentialIcon(credential.vct, credential.format);

  return (
    <div className={`clw-card${status === "revoked" ? " revoked" : ""}`}>
      <div className="clw-card-header" onClick={() => setExpanded((e) => !e)}>
        <div className="clw-card-icon">{icon}</div>
        <div className="clw-card-meta">
          <div className="clw-card-name">{displayName}</div>
          <div className="clw-card-vct">{credential.vct}</div>
        </div>
        <span className={`clw-card-status clw-status-${status}`}>
          {status === "valid" ? "Valid" : status === "revoked" ? "Revoked" : "Expired"}
        </span>
        <span style={{ color: "var(--clw-muted)", marginLeft: 8, fontSize: 12 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div className="clw-card-body">
          <div className="clw-claims">
            {claimEntries.map(([k, v]) => (
              <div className="clw-claim" key={k}>
                <span className="clw-claim-key">{k.replace(/_/g, " ")}</span>
                <span className="clw-claim-val">{formatClaimValue(v)}</span>
              </div>
            ))}
          </div>
          <div className="clw-card-actions">
            {status === "valid" && (
              <button className="clw-btn clw-btn-primary clw-btn-sm" onClick={onPresent}>
                Present →
              </button>
            )}
            <button className="clw-btn clw-btn-danger clw-btn-sm" onClick={onRemove}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PresentModal ──────────────────────────────────────────────────────────────

interface PresentModalProps {
  credential: StoredCredential;
  onClose: () => void;
}

function PresentModal({ credential, onClose }: PresentModalProps) {
  const [copied, setCopied] = useState(false);

  const copyRaw = () => {
    navigator.clipboard.writeText(credential.raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="clw-overlay" onClick={onClose}>
      <div className="clw-modal" onClick={(e) => e.stopPropagation()}>
        <button className="clw-modal-close" onClick={onClose}>×</button>
        <div className="clw-modal-title">Present — {credentialDisplayName(credential)}</div>
        <p className="clw-present-hint">
          Copy the credential token below and share it with the verifier, or scan
          the verifier&apos;s QR code with a compatible wallet app to present via OID4VP.
        </p>
        <div className="clw-present-raw">{credential.raw.slice(0, 120)}…</div>
        <button className="clw-btn clw-btn-ghost clw-btn-sm" onClick={copyRaw}>
          Copy credential token
        </button>
        {copied && <div className="clw-copied">✓ Copied to clipboard</div>}
      </div>
    </div>
  );
}

// ── ClavexWallet ──────────────────────────────────────────────────────────────

/**
 * Embeddable Verifiable Credential wallet widget.
 *
 * Requires `<ClavexProvider>` as an ancestor.
 */
export function ClavexWallet({
  className,
  onPresent,
  onCredentialAdded,
  emptyText,
  showAddButton = true,
}: ClavexWalletProps) {
  const { status } = useClavexContext();
  const { credentials, serverRecords, isLoading, error, removeCredential, addCredential } = useWallet();
  const { accept, isPending, error: offerError } = useCredentialOffer();

  const [showAddForm, setShowAddForm] = useState(false);
  const [offerInput, setOfferInput] = useState("");
  const [presentingCred, setPresentingCred] = useState<StoredCredential | null>(null);

  // Inject CSS once
  useEffect(() => { injectStyles(); }, []);

  // Auto-accept offer from URL param on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const offerUri = params.get("credential_offer_uri") ?? params.get("credential_offer");
    if (!offerUri) return;

    const fullOffer = offerUri.startsWith("openid-credential-offer://")
      ? offerUri
      : `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(offerUri)}`;

    accept(fullOffer).then((issued) => {
      issued.forEach((c) => onCredentialAdded?.(c));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcceptOffer = async () => {
    if (!offerInput.trim()) return;
    const uri = offerInput.trim().startsWith("openid-credential-offer://")
      ? offerInput.trim()
      : `openid-credential-offer://?credential_offer=${encodeURIComponent(offerInput.trim())}`;
    const issued = await accept(uri);
    issued.forEach((c) => onCredentialAdded?.(c));
    if (issued.length > 0) {
      setOfferInput("");
      setShowAddForm(false);
    }
  };

  const handlePresent = (cred: StoredCredential) => {
    if (onPresent) {
      onPresent(cred);
    } else {
      setPresentingCred(cred);
    }
  };

  if (status === "loading") {
    return (
      <div className={`clw-root${className ? ` ${className}` : ""}`}>
        <div className="clw-empty" style={{ padding: 24 }}>
          <span style={{ color: "var(--clw-muted)", fontSize: 13 }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className={`clw-root${className ? ` ${className}` : ""}`}>
        <div className="clw-empty">
          <span className="clw-empty-icon">🔒</span>
          Sign in to view your credentials.
        </div>
      </div>
    );
  }

  return (
    <div className={`clw-root${className ? ` ${className}` : ""}`}>
      {/* Header */}
      <div className="clw-header">
        <span className="clw-title">
          <span className="clw-title-dot" />
          My Credentials
          {credentials.length > 0 && (
            <span style={{ fontWeight: 400, color: "var(--clw-muted)" }}>({credentials.length})</span>
          )}
        </span>
        {showAddButton && (
          <button
            className="clw-btn clw-btn-ghost clw-btn-sm"
            onClick={() => setShowAddForm((s) => !s)}
          >
            {showAddForm ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {/* Add offer form */}
      {showAddForm && (
        <div className="clw-add-form">
          <label>Credential Offer URI</label>
          <input
            className="clw-input"
            placeholder="openid-credential-offer://?credential_offer=..."
            value={offerInput}
            onChange={(e) => setOfferInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAcceptOffer()}
          />
          <div className="clw-add-actions">
            <button
              className="clw-btn clw-btn-primary clw-btn-sm"
              onClick={handleAcceptOffer}
              disabled={isPending || !offerInput.trim()}
            >
              {isPending ? "Accepting…" : "Accept offer"}
            </button>
          </div>
          {offerError && <div className="clw-error">{offerError}</div>}
        </div>
      )}

      {error && <div className="clw-error">{error}</div>}

      {/* Credential list */}
      {isLoading && credentials.length === 0 ? (
        <div className="clw-empty" style={{ padding: 20 }}>
          <span style={{ color: "var(--clw-muted)" }}>Syncing…</span>
        </div>
      ) : credentials.length === 0 ? (
        <div className="clw-empty">
          <span className="clw-empty-icon">📭</span>
          {emptyText ??
            "No credentials yet.\nCredentials issued to you will appear here."}
        </div>
      ) : (
        <div className="clw-cards">
          {credentials.map((cred) => (
            <CredentialCard
              key={cred.id}
              credential={cred}
              status={credentialStatus(cred, serverRecords)}
              onRemove={() => removeCredential(cred.id)}
              onPresent={() => handlePresent(cred)}
            />
          ))}
        </div>
      )}

      {/* Presentation modal */}
      {presentingCred && (
        <PresentModal credential={presentingCred} onClose={() => setPresentingCred(null)} />
      )}
    </div>
  );
}
