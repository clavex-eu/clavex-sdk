/**
 * <UserProfile> — pre-built user profile card with tabbed sections.
 *
 * Shows the authenticated user's avatar, name, email, and organisation.
 * "Account" tab: profile fields, roles.
 * "Security" tab: passkey enrollment, session info.
 *
 * @example Sidebar profile panel
 * ```tsx
 * import { UserProfile } from "@clavex/ui";
 * import "@clavex/ui/styles.css";
 *
 * <UserProfile onSignOut={() => navigate("/")} />
 * ```
 *
 * @example Extra custom tab
 * ```tsx
 * <UserProfile
 *   extraTabs={[
 *     { id: "billing", label: "Billing", content: <BillingPanel /> },
 *   ]}
 * />
 * ```
 */
import { type CSSProperties, type ReactNode, useState } from "react";
import { useUser, useOrg, useSignOut, usePasskey } from "@clavex/react";
import { PasskeyEnrollment } from "./PasskeyEnrollment.js";
import { cn } from "../internal/cn.js";

export interface UserProfileTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface UserProfileProps {
  className?: string;
  style?: CSSProperties;
  /**
   * Additional custom tabs appended after the built-in Account and Security
   * tabs. Each tab must have a unique `id`.
   */
  extraTabs?: UserProfileTab[];
  /** Called before the built-in sign-out action fires. */
  onSignOut?: () => void;
}

// ── Internal icon components ──────────────────────────────────────────────────

function ShieldIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l8 3.5v5C20 16.5 16.5 21 12 22c-4.5-1-8-5.5-8-10.5v-5L12 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserProfile({
  className,
  style,
  extraTabs,
  onSignOut,
}: UserProfileProps): React.JSX.Element | null {
  const { user, isLoaded, isSignedIn } = useUser();
  const { org } = useOrg();
  const { signOut, isLoading: signOutLoading } = useSignOut();
  const { isSupported: passkeySupported } = usePasskey();

  const [activeTab, setActiveTab] = useState("account");
  const [passkeyEnrolled, setPasskeyEnrolled] = useState(false);

  if (!isLoaded) {
    return <div className={cn("clavex-skeleton", className)} style={style} data-clavex-ui="" />;
  }
  if (!isSignedIn || !user) return null;

  // Avatar initials fallback
  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("") ||
    user.email?.[0]?.toUpperCase() ||
    "?";

  const displayName =
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "User";

  const handleSignOut = async () => {
    onSignOut?.();
    await signOut();
  };

  // ── Tab definitions ─────────────────────────────────────────────────────────
  const builtInTabs: UserProfileTab[] = [
    {
      id: "account",
      label: "Account",
      content: (
        <div className="clavex-user-profile__section">
          <div className="clavex-field-row">
            <span className="clavex-field-label">Email</span>
            <span>{user.email ?? "—"}</span>
            {user.emailVerified && (
              <span className="clavex-badge clavex-badge--green">Verified</span>
            )}
          </div>
          {org && (
            <div className="clavex-field-row">
              <span className="clavex-field-label">Org</span>
              <span>{org.name ?? org.slug}</span>
            </div>
          )}
          {user.roles && user.roles.length > 0 && (
            <div className="clavex-field-row">
              <span className="clavex-field-label">Roles</span>
              <div className="clavex-badges">
                {user.roles.map((r: string) => (
                  <span key={r} className="clavex-badge">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
          {user.authTime != null && (
            <div className="clavex-field-row">
              <span className="clavex-field-label">Last auth</span>
              <span>
                {new Date(user.authTime * 1000).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
          )}
          {user.acr && (
            <div className="clavex-field-row">
              <span className="clavex-field-label">ACR</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldIcon />
                {user.acr}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "security",
      label: "Security",
      content: (
        <div className="clavex-user-profile__section" style={{ padding: "var(--clavex-space-4) var(--clavex-space-6)" }}>
          {passkeySupported && !passkeyEnrolled ? (
            <PasskeyEnrollment onSuccess={() => setPasskeyEnrolled(true)} />
          ) : passkeyEnrolled ? (
            <div className="clavex-field-row">
              <span className="clavex-field-label">Passkey</span>
              <span className="clavex-badge clavex-badge--green">Enrolled</span>
            </div>
          ) : (
            <p className="clavex-card__desc">
              Passkeys are not supported in this browser.
            </p>
          )}
        </div>
      ),
    },
    ...(extraTabs ?? []),
  ];

  const activeTabData = builtInTabs.find((t) => t.id === activeTab) ?? builtInTabs[0];

  return (
    <div
      className={cn("clavex-card clavex-user-profile", className)}
      style={style}
      data-clavex-ui=""
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="clavex-user-profile__header">
        {user.picture ? (
          <img
            src={user.picture}
            alt={displayName}
            className="clavex-avatar"
          />
        ) : (
          <div className="clavex-avatar clavex-avatar--initials" aria-hidden="true">
            {initials}
          </div>
        )}
        <div>
          <p className="clavex-user-profile__name">{displayName}</p>
          {user.email && (
            <p className="clavex-user-profile__email">{user.email}</p>
          )}
          {org && (
            <p className="clavex-user-profile__org">
              {org.name ?? org.slug}
            </p>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="clavex-tabs" role="tablist" aria-label="Profile sections">
        {builtInTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn("clavex-tab", activeTab === tab.id && "clavex-tab--active")}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Active tab content ──────────────────────────────────────────────── */}
      <div role="tabpanel">{activeTabData?.content}</div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="clavex-user-profile__footer">
        <button
          type="button"
          className="clavex-btn--link clavex-btn--danger"
          onClick={handleSignOut}
          disabled={signOutLoading}
        >
          {signOutLoading ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
