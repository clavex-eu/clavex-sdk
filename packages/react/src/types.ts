/**
 * @clavex/react — TypeScript types
 */

// ── Provider configuration ────────────────────────────────────────────────────

/**
 * Configuration passed to `<ClavexProvider>`.
 *
 * @example
 * ```tsx
 * <ClavexProvider
 *   issuer="https://id.example.com/acme"
 *   clientId="my-spa-client"
 *   redirectUri={window.location.origin + "/callback"}
 * >
 *   <App />
 * </ClavexProvider>
 * ```
 */
export interface ClavexProviderConfig {
  /**
   * OIDC issuer for your Clavex organisation.
   * Format: `https://<clavex-domain>/<org-slug>`
   * e.g. `https://id.example.com/acme`
   *
   * All endpoints are auto-discovered from `<issuer>/.well-known/openid-configuration`.
   *
   * Can be omitted when `NEXT_PUBLIC_CLAVEX_URL` (Next.js) or `VITE_CLAVEX_URL` (Vite)
   * env var is set — the `<ClavexProvider>` resolves it automatically.
   */
  issuer: string;

  /**
   * The `client_id` of the public OIDC client registered in Clavex.
   * This client must have the authorization code grant enabled and
   * the `redirectUri` in its allowed redirect URIs list.
   *
   * Can be omitted when `NEXT_PUBLIC_CLAVEX_CLIENT_ID` (Next.js) or
   * `VITE_CLAVEX_CLIENT_ID` (Vite) env var is set.
   */
  clientId: string;

  /**
   * The URL the browser will be redirected to after login.
   * Usually `window.location.origin + "/callback"`.
   * Must exactly match a redirect URI registered on the OIDC client.
   *
   * Can be omitted: defaults to `window.location.origin + "/callback"`.
   * Override with `NEXT_PUBLIC_CLAVEX_REDIRECT_URI` / `VITE_CLAVEX_REDIRECT_URI`.
   */
  redirectUri: string;

  /**
   * OAuth2 scopes to request. Defaults to `["openid", "email", "profile"]`.
   * Add `"offline_access"` to get a refresh token.
   */
  scopes?: string[];

  /**
   * Token storage strategy.
   * - `"memory"` (default, recommended): access token only in JS heap; refresh token in sessionStorage.
   * - `"sessionStorage"`: both tokens in sessionStorage; survives page reload but not new tab.
   */
  storage?: "memory" | "sessionStorage";

  /**
   * URI to redirect to after sign-out. Defaults to `window.location.origin`.
   */
  postLogoutRedirectUri?: string;

  /**
   * Called after the redirect callback is handled.
   * Use this to restore the user's previous location (e.g. `navigate(appState?.returnTo ?? "/")`).
   */
  onRedirectCallback?: (appState: AppState | undefined) => void;

  /**
   * Extra parameters forwarded to the Clavex authorization endpoint.
   * Example: `{ acr_values: "2", prompt: "login" }`
   */
  authorizationParams?: Record<string, string>;
}

// ── User & org ────────────────────────────────────────────────────────────────

/** Decoded user profile from the OIDC id_token claims. */
export interface ClavexUser {
  /** Subject identifier (`sub` claim). */
  id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  /** Clavex org UUID (`org_id` claim). */
  orgId?: string;
  /** Clavex org slug (`org_slug` claim). */
  orgSlug?: string;
  /** Roles assigned to the user. */
  roles?: string[];
  /** Groups the user belongs to. */
  groups?: string[];
  /** Authentication Context Class Reference. */
  acr?: string;
  /** Unix timestamp of last authentication event. */
  authTime?: number;
  /** All raw claims from the id_token. */
  raw: Record<string, unknown>;
}

/** Organisation identity derived from the user's token and provider config. */
export interface ClavexOrg {
  /** Clavex org UUID (from `org_id` claim). May be absent for public clients. */
  id?: string;
  /** Org slug (from `org_slug` claim or extracted from the issuer URL). */
  slug: string;
  name?: string;
}

// ── Auth state ────────────────────────────────────────────────────────────────

/** Coarse authentication status. */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/** App-specific state round-tripped through the OAuth2 `state` parameter. */
export interface AppState {
  /** URL to restore after redirect. */
  returnTo?: string;
  [key: string]: unknown;
}

/** Raw token set stored in memory / sessionStorage. */
export interface TokenSet {
  /** Bearer access token. */
  accessToken: string;
  /** Raw id_token JWT. */
  idToken: string;
  /** Refresh token (only present if `offline_access` scope was granted). */
  refreshToken?: string;
  /** Absolute expiry as Unix milliseconds. */
  expiresAt: number;
}

/** Token response from the OIDC token endpoint. */
export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// ── OIDC discovery ────────────────────────────────────────────────────────────

export interface OIDCDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
  jwks_uri: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  code_challenge_methods_supported?: string[];
}

// ── Hooks return types ────────────────────────────────────────────────────────

export interface UseUserReturn {
  /** `true` once the initial auth check has completed. */
  isLoaded: boolean;
  /** `true` when the user is signed in and the token is valid. */
  isSignedIn: boolean;
  /** The authenticated user, or `null` when not signed in / still loading. */
  user: ClavexUser | null;
}

export interface UseOrgReturn {
  isLoaded: boolean;
  /** The current organisation, or `null` when not resolved. */
  org: ClavexOrg | null;
}

export interface SignInOptions {
  /** Override the `redirectUri` set on the provider. */
  redirectUri?: string;
  /** App state that will be passed to `onRedirectCallback` after sign-in. */
  appState?: AppState;
  /** Extra authorization parameters for this specific sign-in. */
  authorizationParams?: Record<string, string>;
  /** Hint the identity provider (maps to `login_hint`). */
  loginHint?: string;
  /** Require a minimum ACR value (maps to `acr_values`). */
  acrValues?: string;
}

export interface UseSignInReturn {
  /** Redirect the user to the Clavex authorization endpoint. */
  signIn: (options?: SignInOptions) => Promise<void>;
  /** `true` while the sign-in redirect is being prepared. */
  isLoading: boolean;
  error: Error | null;
}

export interface UseSignOutReturn {
  /** End the session and redirect to `postLogoutRedirectUri`. */
  signOut: (options?: { redirectUri?: string; localOnly?: boolean }) => Promise<void>;
  isLoading: boolean;
}

export interface PasskeyAuthenticateOptions {
  /** Hint the username/email to pre-select a passkey. */
  username?: string;
}

export interface PasskeyRegisterOptions {
  /** Human-readable display name for the new passkey credential. */
  displayName?: string;
}

export interface UsePasskeyReturn {
  /**
   * `true` when the browser supports the WebAuthn API.
   * Passkey methods will throw if called in unsupported environments.
   */
  isSupported: boolean;
  /**
   * Authenticate (sign in) using a passkey.
   * Calls `POST /:orgSlug/passkey/login/begin` + finish, then updates auth state.
   */
  authenticate: (options?: PasskeyAuthenticateOptions) => Promise<void>;
  /**
   * Register a new passkey for the **currently authenticated** user.
   * Calls `POST /api/v1/me/mfa/passkey/register/begin` + finish.
   * Throws `Error("not_authenticated")` if called without an active session.
   */
  register: (options?: PasskeyRegisterOptions) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/** Decision returned by the AuthZen evaluation endpoint. */
export interface AuthZenDecision {
  /** `true` when the action is permitted. */
  isAllowed: boolean;
  /** Raw context from the PDP (e.g. applied rule names, reasons). */
  context?: Record<string, unknown>;
}

export interface UseAuthZenReturn extends AuthZenDecision {
  isLoading: boolean;
  error: Error | null;
  /** Re-trigger the evaluation (useful to refresh after a state change). */
  refetch: () => void;
}

// ── AuthZen request types (mirrors @clavex/sdk) ───────────────────────────────

export interface AZSubject {
  type: string;
  id: string;
  properties?: Record<string, unknown>;
}

export interface AZResource {
  type?: string;
  id?: string;
  properties?: Record<string, unknown>;
}

export interface AZAction {
  name?: string;
  properties?: Record<string, unknown>;
}

export interface AZContext {
  ip?: string;
  country?: string;
  user_agent?: string;
  time?: string;
}
