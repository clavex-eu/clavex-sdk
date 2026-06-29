/**
 * OIDC / OAuth2 PKCE utilities.
 *
 * All crypto uses the Web Crypto API (available in all modern browsers and
 * Node.js 18+). No external dependencies required.
 */
import { AppState, OIDCDiscovery, TokenResponse, TokenSet } from "./types.js";

// ── Base64URL helpers ─────────────────────────────────────────────────────────

/** Encode a Uint8Array to a base64url string (no padding). */
export function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url string to Uint8Array. */
export function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

// ── PKCE ──────────────────────────────────────────────────────────────────────

/** Generate a cryptographically random PKCE code verifier (43–128 chars, RFC 7636). */
export function generateCodeVerifier(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf);
}

/** Derive the S256 code challenge from a verifier (SHA-256 + base64url). */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64urlEncode(digest);
}

/** Generate a random OAuth2 state parameter. */
export function generateState(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf);
}

// ── OIDC discovery ────────────────────────────────────────────────────────────

const discoveryCache = new Map<string, { doc: OIDCDiscovery; at: number }>();
const DISCOVERY_TTL = 60 * 60 * 1_000; // 1 hour

/** Fetch and cache the OIDC discovery document. */
export async function discover(issuer: string): Promise<OIDCDiscovery> {
  const cached = discoveryCache.get(issuer);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL) return cached.doc;

  const url = `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed for ${issuer}: ${res.status} ${res.statusText}`);
  }
  const doc: OIDCDiscovery = await res.json();
  discoveryCache.set(issuer, { doc, at: Date.now() });
  return doc;
}

// ── Authorization URL builder ─────────────────────────────────────────────────

export interface BuildAuthUrlParams {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  extraParams?: Record<string, string>;
  loginHint?: string;
  acrValues?: string;
}

/** Build the full authorization URL with PKCE parameters. */
export function buildAuthUrl(p: BuildAuthUrlParams): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    scope: p.scopes.join(" "),
    state: p.state,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    ...p.extraParams,
  });
  if (p.loginHint) params.set("login_hint", p.loginHint);
  if (p.acrValues) params.set("acr_values", p.acrValues);
  return `${p.authorizationEndpoint}?${params.toString()}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export interface ExchangeCodeParams {
  tokenEndpoint: string;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

/** Exchange an authorization code for tokens (PKCE). */
export async function exchangeCode(p: ExchangeCodeParams): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: p.clientId,
    code: p.code,
    redirect_uri: p.redirectUri,
    code_verifier: p.codeVerifier,
  });

  const res = await fetch(p.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data: TokenResponse = await res.json();
  return tokenResponseToSet(data);
}

export interface RefreshTokensParams {
  tokenEndpoint: string;
  clientId: string;
  refreshToken: string;
}

/** Exchange a refresh token for a new token set. */
export async function refreshTokens(p: RefreshTokensParams): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: p.clientId,
    refresh_token: p.refreshToken,
  });

  const res = await fetch(p.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data: TokenResponse = await res.json();
  return tokenResponseToSet(data);
}

export interface RevokeTokenParams {
  revocationEndpoint: string;
  clientId: string;
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token";
}

/** Revoke a token (best-effort; ignores errors). */
export async function revokeToken(p: RevokeTokenParams): Promise<void> {
  const body = new URLSearchParams({
    client_id: p.clientId,
    token: p.token,
  });
  if (p.tokenTypeHint) body.set("token_type_hint", p.tokenTypeHint);
  await fetch(p.revocationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch(() => {/* best-effort */});
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

/** Decode a JWT payload without verification (server already validated it). */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  try {
    const decoded = base64urlDecode(parts[1]);
    return JSON.parse(new TextDecoder().decode(decoded)) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to decode JWT payload");
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function tokenResponseToSet(data: TokenResponse): TokenSet {
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1_000,
  };
}

// ── PKCE session storage keys ─────────────────────────────────────────────────

const PKCE_KEY = "clavex.pkce";
const STATE_KEY = "clavex.state";
const APP_STATE_KEY = "clavex.appstate";

export interface PKCESession {
  verifier: string;
  state: string;
  redirectUri: string;
  appState?: AppState;
}

export function savePKCESession(s: PKCESession): void {
  sessionStorage.setItem(PKCE_KEY, s.verifier);
  sessionStorage.setItem(STATE_KEY, s.state);
  sessionStorage.setItem(APP_STATE_KEY, JSON.stringify(s.appState ?? {}));
}

export function loadPKCESession(expectedState: string): PKCESession | null {
  const verifier = sessionStorage.getItem(PKCE_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  const rawAppState = sessionStorage.getItem(APP_STATE_KEY);
  clearPKCESession();

  if (!verifier || !state) return null;
  if (state !== expectedState) return null;

  let appState: AppState | undefined;
  if (rawAppState) {
    try { appState = JSON.parse(rawAppState) as AppState; } catch { /* ignore */ }
  }

  return { verifier, state, redirectUri: "", appState };
}

export function clearPKCESession(): void {
  sessionStorage.removeItem(PKCE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(APP_STATE_KEY);
}

// ── Org slug extraction ───────────────────────────────────────────────────────

/** Extract the org slug from the issuer URL (last non-empty path segment). */
export function orgSlugFromIssuer(issuer: string): string {
  const url = new URL(issuer);
  const parts = url.pathname.replace(/^\/|\/$/g, "").split("/");
  const slug = parts.at(-1);
  if (!slug) throw new Error(`Cannot extract org slug from issuer: ${issuer}`);
  return slug;
}

/** Derive the Clavex base URL from the issuer (strips the org slug path). */
export function baseUrlFromIssuer(issuer: string): string {
  const url = new URL(issuer);
  const parts = url.pathname.replace(/^\/|\/$/g, "").split("/");
  // Remove last segment (org slug)
  const basePath = parts.slice(0, -1).join("/");
  return `${url.origin}${basePath ? `/${basePath}` : ""}`;
}
