import React from "react";
/**
 * <MFAChallenge> — inline MFA verification card.
 *
 * Supports TOTP (6-digit authenticator app code) and passkey challenge.
 * Use `mode="auto"` to show both options when the browser supports WebAuthn.
 *
 * @example Step-up MFA gate
 * ```tsx
 * import { MFAChallenge } from "@clavex/ui";
 * import "@clavex/ui/styles.css";
 *
 * function SensitiveAction() {
 *   const [verified, setVerified] = useState(false);
 *   if (!verified) {
 *     return <MFAChallenge onSuccess={() => setVerified(true)} />;
 *   }
 *   return <TransferFunds />;
 * }
 * ```
 */
import { type CSSProperties, type FormEvent, useState } from "react";
import { usePasskey } from "@clavex/react";
import { cn } from "../internal/cn.js";
import { useClavexApiClient } from "../internal/apiClient.js";

export type MFAMode = "totp" | "passkey" | "auto";

export interface MFAChallengeProps {
  /**
   * Which MFA methods to offer:
   * - `"totp"` — TOTP code only
   * - `"passkey"` — passkey challenge only
   * - `"auto"` (default) — TOTP + passkey if WebAuthn is supported
   */
  mode?: MFAMode;
  /** Called when the user successfully completes the MFA challenge. */
  onSuccess?: () => void;
  /** Called when the user clicks "Cancel". Hides the cancel button when omitted. */
  onCancel?: () => void;
  /** Card heading. Defaults to "Two-factor verification". */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function LockIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--clavex-color-primary)" }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 11V7a5 5 0 0110 0v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MFAChallenge({
  mode = "auto",
  onSuccess,
  onCancel,
  title = "Two-factor verification",
  className,
  style,
}: MFAChallengeProps): React.ReactElement {
  const { authenticate, isSupported, isLoading: passkeyLoading, error: passkeyError } = usePasskey();
  const { post } = useClavexApiClient();

  const [code, setCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  const showTotp = mode === "totp" || mode === "auto";
  const showPasskey = (mode === "passkey" || mode === "auto") && isSupported;

  // ── TOTP submit ─────────────────────────────────────────────────────────────
  const handleTotpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;

    setTotpLoading(true);
    setTotpError(null);
    try {
      await post<void>("/me/mfa/totp/verify", { code });
      onSuccess?.();
    } catch (err) {
      setTotpError(
        err instanceof Error
          ? err.message
          : "Invalid code — please check your authenticator app and try again.",
      );
    } finally {
      setTotpLoading(false);
    }
  };

  // ── Passkey challenge ───────────────────────────────────────────────────────
  const handlePasskey = async () => {
    try {
      await authenticate();
      onSuccess?.();
    } catch {
      // error is exposed via passkeyError from the hook
    }
  };

  // Auto-advance when all 6 digits are typed
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
    setTotpError(null);
  };

  return (
    <div className={cn("clavex-card clavex-mfa", className)} style={style} data-clavex-ui="">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--clavex-space-2)" }}>
        <LockIcon />
        <h3 className="clavex-card__title" style={{ margin: 0 }}>
          {title}
        </h3>
      </div>

      {/* TOTP form */}
      {showTotp && (
        <form onSubmit={handleTotpSubmit} noValidate>
          <label className="clavex-label" htmlFor="clavex-otp">
            Authenticator app code
          </label>
          <input
            id="clavex-otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={handleCodeChange}
            autoComplete="one-time-code"
            placeholder="000 000"
            className="clavex-otp-input"
            aria-invalid={!!totpError}
            aria-describedby={totpError ? "clavex-totp-error" : undefined}
          />
          {totpError && (
            <p id="clavex-totp-error" className="clavex-error" role="alert">
              {totpError}
            </p>
          )}
          <button
            type="submit"
            className="clavex-btn clavex-btn--primary"
            disabled={totpLoading || code.length !== 6}
            style={{ marginTop: "var(--clavex-space-3)" }}
          >
            {totpLoading ? <span className="clavex-spinner" aria-hidden /> : null}
            {totpLoading ? "Verifying…" : "Verify code"}
          </button>
        </form>
      )}

      {/* Divider between TOTP and passkey */}
      {showTotp && showPasskey && (
        <div className="clavex-divider" role="separator">
          or
        </div>
      )}

      {/* Passkey option */}
      {showPasskey && (
        <>
          <button
            type="button"
            className="clavex-btn clavex-btn--secondary"
            onClick={handlePasskey}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? <span className="clavex-spinner" aria-hidden /> : null}
            {passkeyLoading ? "Waiting for device…" : "Use a passkey instead"}
          </button>
          {passkeyError && (
            <p className="clavex-error" role="alert">
              {passkeyError.message}
            </p>
          )}
        </>
      )}

      {/* Cancel link */}
      {onCancel && (
        <button type="button" className="clavex-btn--link" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
