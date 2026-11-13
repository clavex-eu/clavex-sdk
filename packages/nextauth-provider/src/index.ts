/**
 * @clavex/nextauth-provider
 *
 * Auth.js (NextAuth v5) and NextAuth v4 provider for Clavex Identity Platform.
 *
 * Clavex is an OIDC-compliant identity provider, so this provider wraps
 * the standard OIDC flow with Clavex-specific defaults and claim mappings.
 *
 * Usage — Auth.js v5 (next-auth ^5):
 * ────────────────────────────────────
 *   import { ClavexProvider } from "@clavex/nextauth-provider";
 *
 *   export const { handlers, signIn, signOut, auth } = NextAuth({
 *     providers: [
 *       ClavexProvider({
 *         issuer: "https://id.example.com/my-org",
 *         clientId: process.env.CLAVEX_CLIENT_ID,
 *         clientSecret: process.env.CLAVEX_CLIENT_SECRET,
 *       }),
 *     ],
 *   });
 *
 * Usage — NextAuth v4 (use ClavexProviderV4):
 * ────────────────────
 *   import NextAuth from "next-auth";
 *   import { ClavexProviderV4 } from "@clavex/nextauth-provider";
 *
 *   export default NextAuth({
 *     providers: [
 *       ClavexProviderV4({
 *         issuer: "https://id.example.com/my-org",
 *         clientId: process.env.CLAVEX_CLIENT_ID,
 *         clientSecret: process.env.CLAVEX_CLIENT_SECRET,
 *       }),
 *     ],
 *   });
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClavexProviderConfig {
  /**
   * The OIDC issuer URL for your Clavex organisation.
   * Format: https://<clavex-domain>/<org-slug>
   * Example: https://id.example.com/acme
   *
   * The provider will auto-discover all endpoints from
   * <issuer>/.well-known/openid-configuration.
   */
  issuer: string;

  /**
   * The OAuth2 client_id registered in Clavex.
   */
  clientId: string;

  /**
   * The OAuth2 client_secret registered in Clavex.
   */
  clientSecret: string;

  /**
   * OAuth2 scopes to request. Defaults to "openid email profile".
   * Add "offline_access" to receive a refresh token.
   */
  scope?: string;

  /**
   * Override the display name shown on the sign-in button.
   * Defaults to "Clavex".
   */
  name?: string;

  /**
   * Extra authorization parameters forwarded to the Clavex authorize endpoint.
   * Example: { acr_values: "2", prompt: "login" }
   */
  authorization?: Record<string, string>;
}

// ── Clavex token claims ───────────────────────────────────────────────────────

export interface ClavexTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  org_id?: string;
  roles?: string[];
  groups?: string[];
  /** Authentication Context Class Reference (acr_values). */
  acr?: string;
  /** Unix timestamp of user authentication event. */
  auth_time?: number;
}

// ── Provider factory ──────────────────────────────────────────────────────────

/**
 * ClavexProvider returns an Auth.js / NextAuth provider configuration.
 *
 * It uses OIDC discovery so endpoint URLs never need to be hardcoded —
 * Clavex serves RFC 8414 metadata at <issuer>/.well-known/openid-configuration.
 */
export function ClavexProvider(config: ClavexProviderConfig) {
  const {
    issuer,
    clientId,
    clientSecret,
    scope = "openid email profile",
    name = "Clavex",
    authorization: extraAuthParams = {},
  } = config;

  // Normalise issuer: strip trailing slash.
  const normalizedIssuer = issuer.replace(/\/$/, "");

  return {
    id: "clavex",
    name,
    type: "oidc" as const,

    issuer: normalizedIssuer,

    // Auth.js discovers the remaining endpoints from well-known metadata.
    wellKnown: `${normalizedIssuer}/.well-known/openid-configuration`,

    clientId,
    clientSecret,

    authorization: {
      params: {
        scope,
        ...extraAuthParams,
      },
    },

    // ── Profile mapping ───────────────────────────────────────────────────────
    // Map Clavex token claims to the Auth.js User object.
    // Called with the ID token claims (after token exchange).
    profile(profile: ClavexTokenClaims) {
      return {
        id: profile.sub,
        email: profile.email ?? null,
        emailVerified: profile.email_verified ? new Date() : null,
        name:
          profile.name ??
          ([profile.given_name, profile.family_name]
            .filter(Boolean)
            .join(" ") || null),
        image: profile.picture ?? null,
        // Clavex-specific fields exposed on the user object.
        orgId: profile.org_id ?? null,
        roles: profile.roles ?? [],
        groups: profile.groups ?? [],
        acr: profile.acr ?? null,
      };
    },

    checks: ["pkce", "state", "nonce"] as ("pkce" | "state" | "nonce")[],
  };
}

/** NextAuth v4 uses the OAuth provider discriminator and explicit ID-token mode. */
export function ClavexProviderV4(config: ClavexProviderConfig) {
  return { ...ClavexProvider(config), type: "oauth" as const, idToken: true };
}

// ── Session / token augmentation helpers ─────────────────────────────────────
//
// Add these to your Auth.js callbacks to persist Clavex-specific claims
// (org_id, roles, groups) into the session and JWT.
//
// Example auth.ts:
//
//   export const { handlers, signIn, signOut, auth } = NextAuth({
//     providers: [ClavexProvider({ ... })],
//     callbacks: {
//       ...clavexCallbacks,
//     },
//   });

export const clavexCallbacks = {
  /**
   * Called after sign-in. Persists Clavex claims into the JWT.
   */
  jwt({
    token,
    user,
    account,
  }: {
    token: Record<string, unknown>;
    user?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
  }) {
    if (account && user) {
      // Initial sign-in: copy Clavex fields from the user profile.
      token.orgId = (user as Record<string, unknown>).orgId;
      token.roles = (user as Record<string, unknown>).roles;
      token.groups = (user as Record<string, unknown>).groups;
      token.acr = (user as Record<string, unknown>).acr;
    }
    return token;
  },

  /**
   * Called on every session access. Exposes Clavex claims in the client session.
   */
  session({
    session,
    token,
  }: {
    session: Record<string, unknown>;
    token: Record<string, unknown>;
  }) {
    const user = (session.user ?? {}) as Record<string, unknown>;
    user.orgId = token.orgId;
    user.roles = token.roles;
    user.groups = token.groups;
    user.acr = token.acr;
    session.user = user;
    return session;
  },
};

// ── TypeScript module augmentation ───────────────────────────────────────────
//
// Auth.js type augmentation (User / Session / JWT with Clavex-specific fields)
// is shipped separately as an ambient declaration. Opt in from your project by
// adding the following to any .ts file (e.g. next-auth.d.ts):
//
//   import "@clavex/nextauth-provider/types";
//
// It is intentionally NOT part of this module's emitted types so it does not
// force the augmentation on consumers who don't import it.
