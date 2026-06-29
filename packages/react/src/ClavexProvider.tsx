/**
 * ClavexProvider — wraps your application and manages OIDC authentication state.
 *
 * @example
 * ```tsx
 * // main.tsx / index.tsx
 * import { ClavexProvider } from "@clavex/react";
 * import { useNavigate } from "react-router-dom";
 *
 * function Root() {
 *   const navigate = useNavigate();
 *   return (
 *     <ClavexProvider
 *       issuer="https://id.example.com/acme"
 *       clientId="spa-client-id"
 *       redirectUri={window.location.origin + "/callback"}
 *       onRedirectCallback={(state) => navigate(state?.returnTo ?? "/")}
 *     >
 *       <App />
 *     </ClavexProvider>
 *   );
 * }
 * ```
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  AuthStatus,
  ClavexOrg,
  ClavexProviderConfig,
  ClavexUser,
  OIDCDiscovery,
  SignInOptions,
  TokenSet,
} from "./types.js";
import {
  buildAuthUrl,
  clearPKCESession,
  computeCodeChallenge,
  decodeJwtPayload,
  discover,
  exchangeCode,
  generateCodeVerifier,
  generateState,
  loadPKCESession,
  orgSlugFromIssuer,
  refreshTokens,
  revokeToken,
  savePKCESession,
} from "./oidc.js";
import { TokenStore } from "./storage.js";
import { ClavexContext } from "./context.js";

// ── Zero-config env-var resolver ──────────────────────────────────────────────
//
// Reads build-time env vars injected by Next.js (NEXT_PUBLIC_*) or Vite
// (VITE_*). Both bundlers replace these references at bundle time, so the
// actual string value is inlined into the user's final bundle.

function resolveEnv(...names: string[]): string | undefined {
  for (const name of names) {
    // Next.js / Node.js: NEXT_PUBLIC_* is inlined at build time.
    // Use globalThis to avoid requiring @types/node for the `process` global.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = (globalThis as any).process as { env?: Record<string, string | undefined> } | undefined;
    if (proc?.env?.[name]) {
      return proc.env[name] as string;
    }
    // Vite: VITE_* is inlined at build time via import.meta.env.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (import.meta as unknown as { env?: Record<string, string> }).env?.[name];
      if (val) return val;
    } catch {
      // Not a Vite build — ignore.
    }
  }
  return undefined;
}

// ── Claim → User mapper ───────────────────────────────────────────────────────

function claimsToUser(claims: Record<string, unknown>): ClavexUser {
  return {
    id: String(claims["sub"] ?? ""),
    email: typeof claims["email"] === "string" ? claims["email"] : undefined,
    emailVerified: typeof claims["email_verified"] === "boolean" ? claims["email_verified"] : undefined,
    name: typeof claims["name"] === "string" ? claims["name"] : undefined,
    firstName: typeof claims["given_name"] === "string" ? claims["given_name"] : undefined,
    lastName: typeof claims["family_name"] === "string" ? claims["family_name"] : undefined,
    picture: typeof claims["picture"] === "string" ? claims["picture"] : undefined,
    orgId: typeof claims["org_id"] === "string" ? claims["org_id"] : undefined,
    orgSlug: typeof claims["org_slug"] === "string" ? claims["org_slug"] : undefined,
    roles: Array.isArray(claims["roles"]) ? (claims["roles"] as string[]) : undefined,
    groups: Array.isArray(claims["groups"]) ? (claims["groups"] as string[]) : undefined,
    acr: typeof claims["acr"] === "string" ? claims["acr"] : undefined,
    authTime: typeof claims["auth_time"] === "number" ? claims["auth_time"] : undefined,
    raw: claims,
  };
}

function userToOrg(user: ClavexUser, issuer: string): ClavexOrg {
  const slug = user.orgSlug ?? orgSlugFromIssuer(issuer);
  return { id: user.orgId, slug };
}

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Props accepted by `<ClavexProvider>`.
 *
 * `issuer`, `clientId`, and `redirectUri` are optional: when omitted the
 * provider reads them from env vars at runtime:
 *
 * | Prop         | Next.js env var              | Vite env var           |
 * |--------------|------------------------------|------------------------|
 * | `issuer`     | `NEXT_PUBLIC_CLAVEX_URL`     | `VITE_CLAVEX_URL`      |
 * | `clientId`   | `NEXT_PUBLIC_CLAVEX_CLIENT_ID` | `VITE_CLAVEX_CLIENT_ID` |
 * | `redirectUri`| `NEXT_PUBLIC_CLAVEX_REDIRECT_URI` | `VITE_CLAVEX_REDIRECT_URI` |
 *
 * If `redirectUri` is omitted and no env var is set, it defaults to
 * `window.location.origin + "/callback"`.
 */
export type ClavexProviderProps = Omit<ClavexProviderConfig, "issuer" | "clientId" | "redirectUri"> & {
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
  children: React.ReactNode;
};

export function ClavexProvider({ children, ...config }: ClavexProviderProps) {
  const {
    issuer: issuerProp,
    clientId: clientIdProp,
    redirectUri: redirectUriProp,
    scopes: configuredScopes,
    storage: storageStrategy = "memory",
    postLogoutRedirectUri,
    onRedirectCallback,
    authorizationParams: globalAuthParams,
  } = config;

  // ── Zero-config: resolve issuer / clientId / redirectUri from env vars ──────────
  const issuer =
    issuerProp ??
    resolveEnv("NEXT_PUBLIC_CLAVEX_URL", "VITE_CLAVEX_URL") ??
    (() => { throw new Error("[@clavex/react] issuer is required. Pass it as a prop or set NEXT_PUBLIC_CLAVEX_URL / VITE_CLAVEX_URL."); })();
  const clientId =
    clientIdProp ??
    resolveEnv("NEXT_PUBLIC_CLAVEX_CLIENT_ID", "VITE_CLAVEX_CLIENT_ID") ??
    (() => { throw new Error("[@clavex/react] clientId is required. Pass it as a prop or set NEXT_PUBLIC_CLAVEX_CLIENT_ID / VITE_CLAVEX_CLIENT_ID."); })();
  const defaultRedirectUri =
    redirectUriProp ??
    resolveEnv("NEXT_PUBLIC_CLAVEX_REDIRECT_URI", "VITE_CLAVEX_REDIRECT_URI") ??
    (typeof window !== "undefined" ? window.location.origin + "/callback" : "");

  // Resolved config stored in context so downstream hooks reflect actual values.
  const resolvedConfig: ClavexProviderConfig = { ...config, issuer, clientId, redirectUri: defaultRedirectUri };

  const scopes = useMemo(
    () => configuredScopes ?? ["openid", "email", "profile"],
    [configuredScopes],
  );

  // TokenStore is stable across renders
  const storeRef = useRef<TokenStore>(new TokenStore(storageStrategy));
  const store = storeRef.current;

  // Discovery document (cached in oidc.ts module-level map)
  const discoveryRef = useRef<OIDCDiscovery | null>(null);

  // Refresh timer
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ClavexUser | null>(null);
  const [org, setOrg] = useState<ClavexOrg | null>(null);
  const [tokens, setTokensState] = useState<TokenSet | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const applyTokenSet = useCallback(
    (ts: TokenSet) => {
      store.set(ts);
      setTokensState(ts);

      try {
        const claims = decodeJwtPayload(ts.idToken);
        const u = claimsToUser(claims);
        setUser(u);
        setOrg(userToOrg(u, issuer));
      } catch {
        // id_token decode failed — still set authenticated but no user claims
        setUser(null);
        setOrg({ slug: orgSlugFromIssuer(issuer) });
      }

      setStatus("authenticated");
      scheduleRefresh(ts);
    },
    [issuer, store],
  );

  const clearAuth = useCallback(() => {
    store.clear();
    setTokensState(null);
    setUser(null);
    setOrg(null);
    setStatus("unauthenticated");
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, [store]);

  const getDiscovery = useCallback(async (): Promise<OIDCDiscovery> => {
    if (!discoveryRef.current) {
      discoveryRef.current = await discover(issuer);
    }
    return discoveryRef.current;
  }, [issuer]);

  const scheduleRefresh = useCallback(
    (ts: TokenSet) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (!ts.refreshToken) return;

      // Refresh 60 seconds before expiry
      const delay = Math.max(0, ts.expiresAt - Date.now() - 60_000);
      refreshTimerRef.current = setTimeout(async () => {
        if (!ts.refreshToken) return;
        try {
          const doc = await getDiscovery();
          const next = await refreshTokens({
            tokenEndpoint: doc.token_endpoint,
            clientId,
            refreshToken: ts.refreshToken,
          });
          applyTokenSet(next);
        } catch {
          clearAuth();
        }
      }, delay);
    },
    [applyTokenSet, clearAuth, clientId, getDiscovery],
  );

  // ── Initialize: check for existing session ─────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const existing = store.get();
      if (existing && existing.expiresAt > Date.now() + 5_000) {
        if (!cancelled) applyTokenSet(existing);
        return;
      }

      // Try to restore via refresh token
      const rt = store.getStoredRefreshToken();
      if (rt) {
        try {
          const doc = await getDiscovery();
          const ts = await refreshTokens({
            tokenEndpoint: doc.token_endpoint,
            clientId,
            refreshToken: rt,
          });
          if (!cancelled) applyTokenSet(ts);
          return;
        } catch {
          // Refresh token expired — fall through to unauthenticated
        }
      }

      if (!cancelled) setStatus("unauthenticated");
    }

    init().catch(() => {
      if (!cancelled) setStatus("unauthenticated");
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── signIn ─────────────────────────────────────────────────────────────────

  const signIn = useCallback(
    async (options: SignInOptions = {}) => {
      const doc = await getDiscovery();
      const verifier = generateCodeVerifier();
      const challenge = await computeCodeChallenge(verifier);
      const state = generateState();
      const uri = options.redirectUri ?? defaultRedirectUri;

      savePKCESession({ verifier, state, redirectUri: uri, appState: options.appState });

      const url = buildAuthUrl({
        authorizationEndpoint: doc.authorization_endpoint,
        clientId,
        redirectUri: uri,
        scopes,
        state,
        codeChallenge: challenge,
        extraParams: { ...globalAuthParams, ...options.authorizationParams },
        loginHint: options.loginHint,
        acrValues: options.acrValues,
      });

      window.location.assign(url);
    },
    [clientId, defaultRedirectUri, getDiscovery, globalAuthParams, scopes],
  );

  // ── handleRedirectCallback ─────────────────────────────────────────────────

  const handleRedirectCallback = useCallback(
    async (rawUrl?: string): Promise<AppState | undefined> => {
      const url = new URL(rawUrl ?? window.location.href);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDesc = url.searchParams.get("error_description");

      if (error) {
        clearPKCESession();
        throw new Error(errorDesc ? `${error}: ${errorDesc}` : error);
      }

      if (!code || !state) {
        throw new Error("Missing code or state in redirect callback URL");
      }

      const session = loadPKCESession(state);
      if (!session) {
        throw new Error("PKCE session mismatch or expired — possible CSRF attempt");
      }

      const doc = await getDiscovery();
      const ts = await exchangeCode({
        tokenEndpoint: doc.token_endpoint,
        clientId,
        code,
        redirectUri: session.redirectUri || defaultRedirectUri,
        codeVerifier: session.verifier,
      });

      applyTokenSet(ts);
      return session.appState;
    },
    [applyTokenSet, clientId, defaultRedirectUri, getDiscovery],
  );

  // ── Auto-handle callback on mount if URL has ?code= ────────────────────────

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code") || !url.searchParams.has("state")) return;

    handleRedirectCallback()
      .then((appState) => {
        // Remove code/state from URL without reload
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        clean.searchParams.delete("state");
        clean.searchParams.delete("session_state");
        window.history.replaceState({}, "", clean.toString());

        if (onRedirectCallback) onRedirectCallback(appState);
      })
      .catch((err: unknown) => {
        console.error("[@clavex/react] handleRedirectCallback error:", err);
        clearAuth();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── signOut ────────────────────────────────────────────────────────────────

  const signOut = useCallback(
    async (options: { redirectUri?: string; localOnly?: boolean } = {}) => {
      const currentTokens = store.get();
      clearAuth();

      if (options.localOnly) return;

      try {
        const doc = await getDiscovery();

        // Best-effort token revocation
        if (currentTokens?.refreshToken) {
          await revokeToken({
            revocationEndpoint: doc.token_endpoint.replace("/token", "/revoke"),
            clientId,
            token: currentTokens.refreshToken,
            tokenTypeHint: "refresh_token",
          });
        }

        // Redirect to OIDC end_session_endpoint if available
        if (doc.end_session_endpoint) {
          const params = new URLSearchParams({
            client_id: clientId,
            post_logout_redirect_uri: options.redirectUri ?? postLogoutRedirectUri ?? window.location.origin,
          });
          if (currentTokens?.idToken) {
            params.set("id_token_hint", currentTokens.idToken);
          }
          window.location.assign(`${doc.end_session_endpoint}?${params.toString()}`);
          return;
        }
      } catch { /* best-effort */ }

      window.location.assign(options.redirectUri ?? postLogoutRedirectUri ?? window.location.origin);
    },
    [clearAuth, clientId, getDiscovery, postLogoutRedirectUri, store],
  );

  // ── Context value ──────────────────────────────────────────────────────────

  const contextValue = useMemo(
    () => ({
      status,
      user,
      org,
      tokens,
      config: resolvedConfig,
      signIn,
      signOut,
      handleRedirectCallback,
      setTokens: applyTokenSet,
      clearAuth,
    }),
    [status, user, org, tokens, config, signIn, signOut, handleRedirectCallback, applyTokenSet, clearAuth],
  );

  return (
    <ClavexContext.Provider value={contextValue}>
      {children}
    </ClavexContext.Provider>
  );
}
