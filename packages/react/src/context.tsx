/**
 * React context definition for @clavex/react.
 * This module exports only the context object and its type — no React components.
 */
import { createContext, useContext } from "react";
import { ClavexUser, ClavexOrg, AuthStatus, TokenSet, ClavexProviderConfig, AppState, SignInOptions } from "./types.js";

// ── Internal context state ────────────────────────────────────────────────────

export interface ClavexContextValue {
  // ── Auth state ──────────────────────────────────────────────────────────────
  status: AuthStatus;
  user: ClavexUser | null;
  org: ClavexOrg | null;
  tokens: TokenSet | null;

  // ── Provider config (for hooks to read) ────────────────────────────────────
  config: ClavexProviderConfig;

  // ── Actions ─────────────────────────────────────────────────────────────────
  signIn: (options?: SignInOptions) => Promise<void>;
  signOut: (options?: { redirectUri?: string; localOnly?: boolean }) => Promise<void>;
  handleRedirectCallback: (url?: string) => Promise<AppState | undefined>;

  /**
   * Inject a token set from an external flow (e.g. passkey login).
   * Updates auth state exactly as if a standard OIDC callback had occurred.
   */
  setTokens: (tokens: TokenSet) => void;

  /**
   * Clear all auth state (sign out locally without server-side revocation).
   */
  clearAuth: () => void;
}

// ── Context object ────────────────────────────────────────────────────────────

export const ClavexContext = createContext<ClavexContextValue | null>(null);

ClavexContext.displayName = "ClavexContext";

/** Internal hook — use the typed exported hooks instead. */
export function useClavexContext(): ClavexContextValue {
  const ctx = useContext(ClavexContext);
  if (!ctx) {
    throw new Error(
      "[@clavex/react] No <ClavexProvider> found. " +
      "Wrap your application root with <ClavexProvider issuer=\"...\" clientId=\"...\" redirectUri=\"...\">.",
    );
  }
  return ctx;
}
