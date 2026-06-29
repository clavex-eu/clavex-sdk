/**
 * @clavex/react — all consumer hooks.
 *
 * Designed to mirror the developer experience of Clerk React SDK and
 * Auth0 React SDK — no manual OIDC plumbing required.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useClavexContext } from "./context.js";
import { decodeJwtPayload, orgSlugFromIssuer, base64urlDecode, base64urlEncode } from "./oidc.js";
import {
  AZAction,
  AZContext,
  AZResource,
  AZSubject,
  PasskeyAuthenticateOptions,
  PasskeyRegisterOptions,
  SignInOptions,
  UseAuthZenReturn,
  UseOrgReturn,
  UsePasskeyReturn,
  UseSignInReturn,
  UseSignOutReturn,
  UseUserReturn,
} from "./types.js";

// WebAuthn requires ArrayBuffer, not Uint8Array<ArrayBufferLike>
function toArrayBuffer(s: string): ArrayBuffer {
  return base64urlDecode(s).buffer as ArrayBuffer;
}

// ── useUser ───────────────────────────────────────────────────────────────────

/**
 * Returns the current authenticated user.
 *
 * @example
 * ```tsx
 * const { user, isLoaded, isSignedIn } = useUser();
 * if (!isLoaded) return <Spinner />;
 * if (!isSignedIn) return <LoginButton />;
 * return <p>Hello {user.firstName}</p>;
 * ```
 */
export function useUser(): UseUserReturn {
  const { status, user } = useClavexContext();
  return {
    isLoaded: status !== "loading",
    isSignedIn: status === "authenticated",
    user,
  };
}

// ── useOrg ────────────────────────────────────────────────────────────────────

/**
 * Returns the current organisation derived from the authenticated user's token.
 *
 * @example
 * ```tsx
 * const { org, isLoaded } = useOrg();
 * if (isLoaded && org) console.log(org.slug, org.id);
 * ```
 */
export function useOrg(): UseOrgReturn {
  const { status, org } = useClavexContext();
  return {
    isLoaded: status !== "loading",
    org,
  };
}

// ── useSignIn ─────────────────────────────────────────────────────────────────

/**
 * Returns a `signIn` function that starts the PKCE authorization code flow.
 *
 * @example
 * ```tsx
 * const { signIn } = useSignIn();
 * <button onClick={() => signIn({ appState: { returnTo: "/dashboard" } })}>
 *   Sign in
 * </button>
 * ```
 */
export function useSignIn(): UseSignInReturn {
  const { signIn: ctxSignIn } = useClavexContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signIn = useCallback(async (options?: SignInOptions) => {
    setIsLoading(true);
    setError(null);
    try {
      await ctxSignIn(options);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [ctxSignIn]);

  return { signIn, isLoading, error };
}

// ── useSignOut ────────────────────────────────────────────────────────────────

/**
 * Returns a `signOut` function that revokes the session and redirects to
 * the `postLogoutRedirectUri` configured on the provider.
 *
 * @example
 * ```tsx
 * const { signOut } = useSignOut();
 * <button onClick={() => signOut()}>Log out</button>
 * ```
 */
export function useSignOut(): UseSignOutReturn {
  const { signOut: ctxSignOut } = useClavexContext();
  const [isLoading, setIsLoading] = useState(false);

  const signOut = useCallback(
    async (options?: { redirectUri?: string; localOnly?: boolean }) => {
      setIsLoading(true);
      try {
        await ctxSignOut(options);
      } finally {
        setIsLoading(false);
      }
    },
    [ctxSignOut],
  );

  return { signOut, isLoading };
}

// ── useAuth (convenience) ─────────────────────────────────────────────────────

/**
 * Convenience hook that bundles `useUser`, `useSignIn`, and `useSignOut`.
 * Useful for header components or auth-gated layouts.
 *
 * @example
 * ```tsx
 * const { user, isSignedIn, signIn, signOut } = useAuth();
 * ```
 */
export function useAuth() {
  const { status, user } = useClavexContext();
  const { signIn } = useSignIn();
  const { signOut } = useSignOut();

  return {
    isLoaded: status !== "loading",
    isSignedIn: status === "authenticated",
    user,
    signIn,
    signOut,
  };
}

// ── usePasskey ────────────────────────────────────────────────────────────────

/**
 * WebAuthn / passkey hooks — passwordless authentication and registration.
 *
 * @example
 * ```tsx
 * const { authenticate, register, isSupported, isLoading } = usePasskey();
 *
 * // Passwordless sign-in
 * <button onClick={() => authenticate()} disabled={!isSupported}>
 *   Sign in with passkey
 * </button>
 *
 * // Add a passkey to an existing account (user must be signed in)
 * <button onClick={() => register({ displayName: "My MacBook" })}>
 *   Add passkey
 * </button>
 * ```
 */
export function usePasskey(): UsePasskeyReturn {
  const ctx = useClavexContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials !== "undefined";

  // ── Shared WebAuthn helpers ───────────────────────────────────────────────

  /**
   * Convert server-issued assertion options (go-webauthn JSON format)
   * to the shape expected by navigator.credentials.get().
   */
  function prepareGetOptions(
    raw: Record<string, unknown>,
  ): PublicKeyCredentialRequestOptions {
    const pk = (raw["publicKey"] ?? raw) as Record<string, unknown>;
    return {
      timeout: (pk["timeout"] as number) ?? 60_000,
      rpId: pk["rpId"] as string | undefined,
      userVerification: (pk["userVerification"] as UserVerificationRequirement) ?? "preferred",
      challenge: toArrayBuffer(pk["challenge"] as string),
      allowCredentials: ((pk["allowCredentials"] as Array<Record<string, unknown>>) ?? []).map(
        (c) => ({
          type: "public-key" as PublicKeyCredentialType,
          id: toArrayBuffer(c["id"] as string),
          transports: c["transports"] as AuthenticatorTransport[] | undefined,
        }),
      ),
    };
  }

  /**
   * Convert server-issued registration options (go-webauthn JSON format)
   * to the shape expected by navigator.credentials.create().
   */
  function prepareCreateOptions(
    raw: Record<string, unknown>,
  ): PublicKeyCredentialCreationOptions {
    const pk = (raw["publicKey"] ?? raw) as Record<string, unknown>;
    const user = pk["user"] as Record<string, unknown>;
    const rp = pk["rp"] as Record<string, unknown>;
    return {
      timeout: (pk["timeout"] as number) ?? 60_000,
      rp: { id: rp["id"] as string, name: rp["name"] as string },
      user: {
      id: toArrayBuffer(user["id"] as string),
        name: user["name"] as string,
        displayName: (user["displayName"] as string) ?? (user["name"] as string),
      },
      challenge: toArrayBuffer(pk["challenge"] as string),
      pubKeyCredParams: (pk["pubKeyCredParams"] as PublicKeyCredentialParameters[]) ?? [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: pk["authenticatorSelection"] as
        | AuthenticatorSelectionCriteria
        | undefined,
      attestation: (pk["attestation"] as AttestationConveyancePreference) ?? "none",
      extensions: pk["extensions"] as AuthenticationExtensionsClientInputs | undefined,
    };
  }

  /** Serialize a PublicKeyCredential to JSON for sending to the finish endpoint. */
  function serializeAssertion(cred: PublicKeyCredential): Record<string, unknown> {
    const response = cred.response as AuthenticatorAssertionResponse;
    return {
      id: cred.id,
      rawId: base64urlEncode(cred.rawId),
      type: cred.type,
      response: {
        authenticatorData: base64urlEncode(response.authenticatorData),
        clientDataJSON: base64urlEncode(response.clientDataJSON),
        signature: base64urlEncode(response.signature),
        userHandle: response.userHandle ? base64urlEncode(response.userHandle) : null,
      },
    };
  }

  /** Serialize an attestation (registration) credential to JSON. */
  function serializeAttestation(cred: PublicKeyCredential): Record<string, unknown> {
    const response = cred.response as AuthenticatorAttestationResponse;
    const result: Record<string, unknown> = {
      id: cred.id,
      rawId: base64urlEncode(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: base64urlEncode(response.clientDataJSON),
        attestationObject: base64urlEncode(response.attestationObject),
      },
    };
    // Include transports if supported
    if (typeof response.getTransports === "function") {
      (result["response"] as Record<string, unknown>)["transports"] = response.getTransports();
    }
    return result;
  }

  // ── Derive base URL + orgSlug from config ────────────────────────────────

  function getBaseAndSlug(): { base: string; orgSlug: string } {
    const { issuer } = ctx.config;
    const url = new URL(issuer);
    const orgSlug = orgSlugFromIssuer(issuer);
    const pathParts = url.pathname.replace(/^\/|\/$/g, "").split("/");
    const basePath = pathParts.slice(0, -1).join("/");
    const base = `${url.origin}${basePath ? `/${basePath}` : ""}`;
    return { base, orgSlug };
  }

  // ── authenticate (passwordless sign-in) ──────────────────────────────────

  const authenticate = useCallback(
    async (options?: PasskeyAuthenticateOptions) => {
      if (!isSupported) throw new Error("WebAuthn is not supported in this browser");

      setIsLoading(true);
      setError(null);

      try {
        const { base, orgSlug } = getBaseAndSlug();

        // 1. Begin — get assertion challenge from server
        const beginRes = await fetch(`${base}/${orgSlug}/passkey/login/begin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options?.username ? { username: options.username } : {}),
        });

        if (!beginRes.ok) {
          throw new Error(`Passkey begin failed: ${beginRes.status} ${beginRes.statusText}`);
        }

        const beginData = await beginRes.json() as Record<string, unknown>;
        const getOptions = prepareGetOptions(beginData);

        // 2. WebAuthn ceremony
        const assertion = await navigator.credentials.get({ publicKey: getOptions });
        if (!assertion || !(assertion instanceof PublicKeyCredential)) {
          throw new Error("No credential returned by the authenticator");
        }

        // 3. Finish — verify assertion and get tokens
        const finishRes = await fetch(`${base}/${orgSlug}/passkey/login/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serializeAssertion(assertion)),
        });

        if (!finishRes.ok) {
          const body = await finishRes.text().catch(() => finishRes.statusText);
          throw new Error(`Passkey login failed: ${body}`);
        }

        const finishData = await finishRes.json() as Record<string, unknown>;

        // Server may return tokens directly or a code to exchange
        if (typeof finishData["access_token"] === "string" && typeof finishData["id_token"] === "string") {
          const ts = {
            accessToken: finishData["access_token"] as string,
            idToken: finishData["id_token"] as string,
            refreshToken: finishData["refresh_token"] as string | undefined,
            expiresAt: Date.now() + ((finishData["expires_in"] as number) ?? 3600) * 1_000,
          };
          ctx.setTokens(ts);
        } else {
          throw new Error("Passkey login finish: unexpected response format — expected token set");
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.config.issuer, ctx.setTokens, isSupported],
  );

  // ── register (add passkey to existing account) ──────────────────────────

  const register = useCallback(
    async (options?: PasskeyRegisterOptions) => {
      if (!isSupported) throw new Error("WebAuthn is not supported in this browser");
      if (!ctx.tokens?.accessToken) throw new Error("not_authenticated");

      setIsLoading(true);
      setError(null);

      try {
        const { base } = getBaseAndSlug();
        const token = ctx.tokens.accessToken;

        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        };

        // 1. Begin registration
        const beginRes = await fetch(`${base}/api/v1/me/mfa/passkey/register/begin`, {
          method: "POST",
          headers,
          body: JSON.stringify(options?.displayName ? { display_name: options.displayName } : {}),
        });

        if (!beginRes.ok) {
          throw new Error(`Passkey register begin failed: ${beginRes.status}`);
        }

        const beginData = await beginRes.json() as Record<string, unknown>;
        const createOptions = prepareCreateOptions(beginData);

        // 2. WebAuthn ceremony
        const attestation = await navigator.credentials.create({ publicKey: createOptions });
        if (!attestation || !(attestation instanceof PublicKeyCredential)) {
          throw new Error("No credential returned by the authenticator");
        }

        // 3. Finish registration
        const finishRes = await fetch(`${base}/api/v1/me/mfa/passkey/register/finish`, {
          method: "POST",
          headers,
          body: JSON.stringify(serializeAttestation(attestation)),
        });

        if (!finishRes.ok) {
          const body = await finishRes.text().catch(() => finishRes.statusText);
          throw new Error(`Passkey register finish failed: ${body}`);
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.config.issuer, ctx.tokens, isSupported],
  );

  return { isSupported, authenticate, register, isLoading, error };
}

// ── useAuthZen ────────────────────────────────────────────────────────────────

/**
 * Evaluate an AuthZen authorization policy in real-time.
 *
 * The evaluation is cached for `cacheMs` milliseconds (default 10s) to avoid
 * flooding the policy engine on every render.
 *
 * @param orgSlug  The Clavex organisation slug (e.g. "acme").
 * @param resource The resource being accessed (string id or `AZResource` object).
 * @param action   The action being performed (string name or `AZAction` object).
 * @param options  Optional configuration: `subject`, `context`, `cacheMs`, `skip`.
 *
 * @example
 * ```tsx
 * // Simple form
 * const { isAllowed, isLoading } = useAuthZen("acme", "invoice:123", "approve");
 *
 * // Full form
 * const { isAllowed } = useAuthZen(
 *   "acme",
 *   { type: "invoice", id: "123" },
 *   { name: "approve" },
 *   { context: { ip: "1.2.3.4" } },
 * );
 *
 * if (isLoading) return <Spinner />;
 * if (!isAllowed) return <Forbidden />;
 * return <ApproveButton />;
 * ```
 */
export function useAuthZen(
  orgSlug: string,
  resource: AZResource | string,
  action: AZAction | string,
  options?: {
    subject?: AZSubject;
    context?: AZContext;
    /** Cache TTL in milliseconds. Default 10_000 (10s). */
    cacheMs?: number;
    /** Skip the evaluation (returns `isLoading: false, isAllowed: false`). */
    skip?: boolean;
  },
): UseAuthZenReturn {
  const ctx = useClavexContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [azContext, setAzContext] = useState<Record<string, unknown> | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const cacheMs = options?.cacheMs ?? 10_000;
  const cacheRef = useRef<{ key: string; value: boolean; ctx: Record<string, unknown> | undefined; at: number } | null>(null);

  const resourceObj: AZResource = typeof resource === "string" ? { id: resource } : resource;
  const actionObj: AZAction = typeof action === "string" ? { name: action } : action;

  const cacheKey = JSON.stringify({ orgSlug, resource: resourceObj, action: actionObj, options });

  useEffect(() => {
    if (options?.skip) {
      setIsAllowed(false);
      setIsLoading(false);
      return;
    }

    const token = ctx.tokens?.accessToken;
    if (!token) {
      setIsAllowed(false);
      setIsLoading(false);
      return;
    }

    // Cache hit
    if (cacheRef.current && cacheRef.current.key === cacheKey && Date.now() - cacheRef.current.at < cacheMs) {
      setIsAllowed(cacheRef.current.value);
      setAzContext(cacheRef.current.ctx);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function evaluate() {
      const { issuer } = ctx.config;
      const url = new URL(issuer);
      const pathParts = url.pathname.replace(/^\/|\/$/g, "").split("/");
      const basePath = pathParts.slice(0, -1).join("/");
      const base = `${url.origin}${basePath ? `/${basePath}` : ""}`;

      // Build subject from current user or provided override
      const user = ctx.user;
      const subject: AZSubject = options?.subject ?? {
        type: "jwt",
        id: user?.email ?? user?.id ?? "anonymous",
        properties: user ? { org_id: user.orgId, roles: user.roles } : undefined,
      };

      const body = {
        subject,
        resource: resourceObj,
        action: actionObj,
        context: options?.context,
      };

      const res = await fetch(`${base}/${orgSlug}/access/v1/evaluation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`AuthZen evaluation failed: ${res.status}`);
      }

      const data = await res.json() as { decision: boolean; context?: Record<string, unknown> };

      if (!cancelled) {
        cacheRef.current = { key: cacheKey, value: data.decision, ctx: data.context, at: Date.now() };
        setIsAllowed(data.decision);
        setAzContext(data.context);
        setIsLoading(false);
      }
    }

    evaluate().catch((err: unknown) => {
      if (!cancelled) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setIsAllowed(false);
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [nonce, cacheKey, ctx.tokens?.accessToken, options?.skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => {
    cacheRef.current = null;
    setNonce((n) => n + 1);
  }, []);

  return { isAllowed, isLoading, error, context: azContext, refetch };
}

// ── useAccessToken ─────────────────────────────────────────────────────────────

/**
 * Returns the current access token for use with your own API calls.
 * The token is refreshed automatically by the provider — you always get
 * the most recent valid token.
 *
 * Returns `null` when the user is not authenticated or the session is loading.
 *
 * @example
 * ```tsx
 * const accessToken = useAccessToken();
 *
 * useEffect(() => {
 *   if (!accessToken) return;
 *   fetchMyApi("/api/data", accessToken);
 * }, [accessToken]);
 * ```
 */
export function useAccessToken(): string | null {
  const { tokens, status } = useClavexContext();
  if (status !== "authenticated") return null;
  return tokens?.accessToken ?? null;
}

// ── useHandleRedirectCallback ─────────────────────────────────────────────────

/**
 * Returns the `handleRedirectCallback` function for use in your callback
 * route component.
 *
 * The `<ClavexProvider>` handles the callback automatically on mount when the
 * current URL contains `?code=` — you only need this hook if you render a
 * dedicated callback component.
 *
 * @example
 * ```tsx
 * // pages/callback.tsx
 * export function CallbackPage() {
 *   const handleRedirectCallback = useHandleRedirectCallback();
 *   const navigate = useNavigate();
 *
 *   useEffect(() => {
 *     handleRedirectCallback()
 *       .then((state) => navigate(state?.returnTo ?? "/"))
 *       .catch(console.error);
 *   }, []);
 *
 *   return <Spinner />;
 * }
 * ```
 */
export function useHandleRedirectCallback() {
  const { handleRedirectCallback } = useClavexContext();
  return handleRedirectCallback;
}

// ── useClavexConfig ───────────────────────────────────────────────────────────

/**
 * Returns the provider configuration passed to `<ClavexProvider>`.
 *
 * Primarily used by `@clavex/ui` components that need the `issuer` URL
 * to construct Clavex API requests.
 *
 * @example
 * ```ts
 * const config = useClavexConfig();
 * const apiBase = config.issuer.replace(/\/[^\/]+$/, "");
 * ```
 */
export function useClavexConfig() {
  const { config } = useClavexContext();
  return config;
}

