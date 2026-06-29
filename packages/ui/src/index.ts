/**
 * @clavex/ui — Pre-built React UI components for Clavex authentication flows.
 *
 * Install:
 *   npm install @clavex/ui @clavex/react
 *
 * Quick start:
 * ```tsx
 * // 1. Import the stylesheet once in your app root
 * import "@clavex/ui/styles.css";
 *
 * // 2. Import components
 * import {
 *   SignInButton,
 *   PasskeyEnrollment,
 *   MFAChallenge,
 *   UserProfile,
 *   OrganizationSwitcher,
 * } from "@clavex/ui";
 *
 * // 3. Theme with CSS variables (optional)
 * // In your global CSS:
 * //   :root {
 * //     --clavex-color-primary: #7C3AED;
 * //     --clavex-radius: 8px;
 * //   }
 * ```
 *
 * @clavex/ui requires `<ClavexProvider>` from `@clavex/react` as a parent.
 * Components that call the Clavex REST API also require an authenticated session.
 */

// ── Components ────────────────────────────────────────────────────────────────
export { SignInButton } from "./components/SignInButton.js";
export type { SignInButtonProps } from "./components/SignInButton.js";

export { PasskeyEnrollment } from "./components/PasskeyEnrollment.js";
export type { PasskeyEnrollmentProps } from "./components/PasskeyEnrollment.js";

export { MFAChallenge } from "./components/MFAChallenge.js";
export type { MFAChallengeProps, MFAMode } from "./components/MFAChallenge.js";

export { UserProfile } from "./components/UserProfile.js";
export type { UserProfileProps, UserProfileTab } from "./components/UserProfile.js";

export { OrganizationSwitcher } from "./components/OrganizationSwitcher.js";
export type { OrganizationSwitcherProps, OrgMembership } from "./components/OrganizationSwitcher.js";

// ── Utilities (advanced usage) ────────────────────────────────────────────────
export { extractBaseUrl } from "./internal/apiClient.js";
