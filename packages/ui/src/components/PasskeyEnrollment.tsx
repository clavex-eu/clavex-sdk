import React from "react";
/**
 * <PasskeyEnrollment> — pre-built passkey registration card.
 *
 * Requires an authenticated session (`isSignedIn === true`).
 * Falls back to a "not supported" message in environments without WebAuthn.
 *
 * @example
 * ```tsx
 * import { PasskeyEnrollment } from "@clavex/ui";
 * import "@clavex/ui/styles.css";
 *
 * function SecuritySettings() {
 *   return (
 *     <PasskeyEnrollment
 *       onSuccess={() => toast("Passkey added!")}
 *       onError={err => toast.error(err.message)}
 *     />
 *   );
 * }
 * ```
 */
import { type CSSProperties, useState } from "react";
import { usePasskey } from "@clavex/react";
import { cn } from "../internal/cn.js";

export interface PasskeyEnrollmentProps {
  className?: string;
  style?: CSSProperties;
  /** Called after the passkey credential is successfully registered. */
  onSuccess?: () => void;
  /** Called when registration fails. The error is also shown inline. */
  onError?: (error: Error) => void;
  /** Card heading. Defaults to "Add a passkey". */
  title?: string;
  /** Card description. Defaults to the built-in explanation text. */
  description?: string;
  /** Label for the registration button. Defaults to "Set up passkey". */
  buttonLabel?: string;
}

// ── Icons (inline SVG, no external dependency) ────────────────────────────────

function PasskeyIcon(): React.ReactElement {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      style={{
        background: "var(--clavex-color-primary)",
        borderRadius: "var(--clavex-radius)",
        opacity: 0.88,
        padding: 6,
      }}
    >
      <circle cx="18" cy="13" r="5" fill="var(--clavex-color-primary-fg)" />
      <path
        d="M7 28c0-6.075 4.925-11 11-11s11 4.925 11 11"
        stroke="var(--clavex-color-primary-fg)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PasskeyEnrollment({
  className,
  style,
  onSuccess,
  onError,
  title = "Add a passkey",
  description = "Sign in faster using biometrics or your device PIN — no password required.",
  buttonLabel = "Set up passkey",
}: PasskeyEnrollmentProps): React.ReactElement | null {
  const { register, isSupported, isLoading, error } = usePasskey();
  const [enrolled, setEnrolled] = useState(false);

  if (!isSupported) {
    return (
      <div className={cn("clavex-card", className)} style={style} data-clavex-ui="">
        <p className="clavex-card__desc">
          Your browser does not support passkeys. Try a modern browser such as
          Chrome 108+, Safari 16+, or Firefox 119+.
        </p>
      </div>
    );
  }

  if (enrolled) {
    return (
      <div className={cn("clavex-card", className)} style={style} data-clavex-ui="">
        <div className="clavex-success">
          <CheckIcon />
          <span>Passkey registered successfully. You can now sign in with biometrics.</span>
        </div>
      </div>
    );
  }

  const handleRegister = async () => {
    try {
      await register();
      setEnrolled(true);
      onSuccess?.();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      onError?.(e);
    }
  };

  return (
    <div className={cn("clavex-card", className)} style={style} data-clavex-ui="">
      <div className="clavex-passkey-header">
        <PasskeyIcon />
        <div>
          <h3 className="clavex-card__title">{title}</h3>
          <p className="clavex-card__desc">{description}</p>
        </div>
      </div>

      {error && (
        <p className="clavex-error" role="alert">
          {error.message}
        </p>
      )}

      <button
        type="button"
        className="clavex-btn clavex-btn--primary"
        onClick={handleRegister}
        disabled={isLoading}
        data-loading={isLoading || undefined}
      >
        {isLoading ? <span className="clavex-spinner" aria-hidden /> : null}
        {isLoading ? "Waiting for browser…" : buttonLabel}
      </button>
    </div>
  );
}
