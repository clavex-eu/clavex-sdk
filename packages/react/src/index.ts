/**
 * @clavex/react
 *
 * React SDK for the Clavex Identity Platform.
 *
 * Drop-in developer UX similar to Clerk React SDK and Auth0 React SDK —
 * no manual OIDC plumbing. Works with CRA, Vite, Remix, and any React
 * framework.
 *
 * @example Quick start
 * ```tsx
 * // 1. Wrap your app
 * import { ClavexProvider } from "@clavex/react";
 *
 * function Root() {
 *   return (
 *     <ClavexProvider
 *       issuer="https://id.example.com/acme"
 *       clientId="your-spa-client-id"
 *       redirectUri={window.location.origin + "/callback"}
 *     >
 *       <App />
 *     </ClavexProvider>
 *   );
 * }
 *
 * // 2. Use hooks anywhere
 * import { useUser, useSignIn, useSignOut, usePasskey, useAuthZen } from "@clavex/react";
 *
 * function Header() {
 *   const { user, isSignedIn } = useUser();
 *   const { signIn } = useSignIn();
 *   const { signOut } = useSignOut();
 *
 *   if (!isSignedIn) return <button onClick={() => signIn()}>Sign in</button>;
 *   return (
 *     <div>
 *       <span>Hello {user?.firstName}</span>
 *       <button onClick={() => signOut()}>Log out</button>
 *     </div>
 *   );
 * }
 *
 * // 3. Passkey authentication
 * const { authenticate, isSupported } = usePasskey();
 * <button onClick={() => authenticate()} disabled={!isSupported}>
 *   Sign in with passkey
 * </button>
 *
 * // 4. AuthZen policy check
 * const { isAllowed, isLoading } = useAuthZen("acme", "document:123", "edit");
 * if (!isAllowed) return <Forbidden />;
 * ```
 */

// ── Provider ─────────────────────────────────────────────────────────────────
export { ClavexProvider } from "./ClavexProvider.js";
export type { ClavexProviderProps } from "./ClavexProvider.js";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export {
  useUser,
  useOrg,
  useSignIn,
  useSignOut,
  useAuth,
  usePasskey,
  useAuthZen,
  useAccessToken,
  useHandleRedirectCallback,
  useClavexConfig,
} from "./hooks.js";
export { withAuthRequired } from "./hoc.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  // Config
  ClavexProviderConfig,
  AppState,
  SignInOptions,
  // User & org
  ClavexUser,
  ClavexOrg,
  // Auth state
  AuthStatus,
  TokenSet,
  TokenResponse,
  OIDCDiscovery,
  // Hook return types
  UseUserReturn,
  UseOrgReturn,
  UseSignInReturn,
  UseSignOutReturn,
  UsePasskeyReturn,
  UseAuthZenReturn,
  AuthZenDecision,
  // AuthZen
  AZSubject,
  AZResource,
  AZAction,
  AZContext,
  // Passkey options
  PasskeyAuthenticateOptions,
  PasskeyRegisterOptions,
} from "./types.js";

// ── OIDC utilities (for advanced / framework integration use) ─────────────────
export {
  generateCodeVerifier,
  computeCodeChallenge,
  generateState,
  discover,
  buildAuthUrl,
  exchangeCode,
  refreshTokens,
  decodeJwtPayload,
  base64urlEncode,
  base64urlDecode,
  orgSlugFromIssuer,
  baseUrlFromIssuer,
} from "./oidc.js";

export type { BuildAuthUrlParams, ExchangeCodeParams, RefreshTokensParams, PKCESession } from "./oidc.js";

// ── Account Center widget ─────────────────────────────────────────────────────
export { ClavexAccountCenter } from "./AccountCenter.js";
export type {
  AccountCenterConfig,
  AccountCenterProps,
  SectionKey,
} from "./AccountCenter.js";

// ── Verifiable Credential Web Wallet ─────────────────────────────────────────
export { ClavexWallet } from "./ClavexWallet.js";
export type { ClavexWalletProps } from "./ClavexWallet.js";

export { useWallet, useCredentialOffer } from "./wallet.js";
export type {
  StoredCredential,
  CredentialDisplay,
  CredentialServerRecord,
  UseWalletReturn,
  UseCredentialOfferReturn,
} from "./wallet.js";
