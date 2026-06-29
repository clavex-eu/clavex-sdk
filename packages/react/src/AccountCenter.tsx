/**
 * <ClavexAccountCenter />
 *
 * Embeddable end-user self-service widget for @clavex/react.
 * Fetches the per-org Account Center configuration from the Clavex backend
 * and renders only the sections the ISV has enabled via the admin API.
 *
 * @example
 * ```tsx
 * import { ClavexProvider, ClavexAccountCenter } from "@clavex/react";
 *
 * // Basic — derives org slug and base URL from ClavexProvider context
 * function AccountPage() {
 *   return <ClavexAccountCenter />;
 * }
 *
 * // With custom section labels and navigation handler
 * function AccountPage() {
 *   const navigate = useNavigate();
 *   return (
 *     <ClavexAccountCenter
 *       labels={{ mfa: "Two-step verification", data_export: "Privacy" }}
 *       onSectionClick={(section, url) => navigate(url)}
 *     />
 *   );
 * }
 * ```
 *
 * ISV admin configuration (toggle sections via the management API):
 * ```
 * PUT /api/v1/organizations/:org_id/account-center
 * { "show_password": false, "show_data_export": false, "page_title": "My Profile" }
 * ```
 */
import { useEffect, useState } from "react";
import { useUser } from "./hooks.js";
import { useClavexContext } from "./context.js";
import { orgSlugFromIssuer } from "./oidc.js";

// ── Config type (mirrors AccountCenterConfig on the backend) ──────────────────

/** Per-org Account Center configuration returned by the public config endpoint. */
export interface AccountCenterConfig {
  org_id: string;
  show_profile: boolean;
  show_password: boolean;
  show_mfa: boolean;
  show_passkeys: boolean;
  show_sessions: boolean;
  show_activity: boolean;
  show_data_export: boolean;
  /** Custom page title set by the ISV via the admin API. */
  page_title?: string;
  /** Relative URL of the hosted account portal for this org. */
  account_portal_url: string;
  updated_at: string;
}

// ── Section keys ──────────────────────────────────────────────────────────────

/** Union of all section identifiers used to key labels, icons, and URLs. */
export type SectionKey =
  | "profile"
  | "password"
  | "mfa"
  | "passkeys"
  | "sessions"
  | "activity"
  | "data_export";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AccountCenterProps {
  /**
   * Base URL of the Clavex server (e.g. `"https://id.example.com"`).
   * Defaults to the origin derived from the `issuer` in `<ClavexProvider>`.
   */
  baseUrl?: string;

  /**
   * Override the org slug used to load config.
   * Defaults to the slug from the authenticated user's token.
   */
  orgSlug?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /**
   * Override display labels for any section.
   * Useful for i18n or ISV-specific naming.
   *
   * @example `{ mfa: "Two-step verification", data_export: "Privacy & Data" }`
   */
  labels?: Partial<Record<SectionKey, string>>;

  /**
   * Custom navigation handler.  When provided, the widget calls this instead
   * of setting `window.location.href`, enabling SPA-style navigation.
   *
   * @param section - the section key that was clicked
   * @param url     - the full URL the widget would have navigated to
   */
  onSectionClick?: (section: SectionKey, url: string) => void;
}

// ── Default content ───────────────────────────────────────────────────────────

const DEFAULT_LABELS: Record<SectionKey, string> = {
  profile:     "Profile",
  password:    "Password",
  mfa:         "Two-Factor Auth",
  passkeys:    "Passkeys",
  sessions:    "Active Sessions",
  activity:    "Login Activity",
  data_export: "My Data",
};

/** Relative path appended to the account portal base URL for each section. */
const SECTION_PATHS: Record<SectionKey, string> = {
  profile:     "",
  password:    "",          // same page, different section
  mfa:         "/security",
  passkeys:    "/security",
  sessions:    "/sessions",
  activity:    "/activity",
  data_export: "/erasure/request",
};

// ── Icons (inline SVG, zero dependencies) ────────────────────────────────────

const ICONS: Record<SectionKey, JSX.Element> = {
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  password: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  mfa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  passkeys: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <line x1="11" y1="12" x2="22" y2="3" />
      <line x1="19" y1="3" x2="22" y2="6" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  data_export: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
};

// ── Section order ─────────────────────────────────────────────────────────────

type SectionEntry = { key: SectionKey; configKey: keyof AccountCenterConfig };

const SECTION_ORDER: SectionEntry[] = [
  { key: "profile",     configKey: "show_profile"     },
  { key: "password",    configKey: "show_password"    },
  { key: "mfa",         configKey: "show_mfa"         },
  { key: "passkeys",    configKey: "show_passkeys"    },
  { key: "sessions",    configKey: "show_sessions"    },
  { key: "activity",    configKey: "show_activity"    },
  { key: "data_export", configKey: "show_data_export" },
];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Account Center widget.
 *
 * Renders a card-based navigation UI with the sections the ISV has enabled.
 * Each tile links to the corresponding page of the hosted Clavex account portal
 * (`/:org_slug/account/...`), opening it via `window.location.href` by default
 * or via `onSectionClick` when supplied.
 *
 * Supports CSS variable theming:
 * - `--clavex-fg`          text colour
 * - `--clavex-muted`       secondary text
 * - `--clavex-surface`     card background
 * - `--clavex-border`      border colour
 * - `--clavex-primary`     accent / icon colour
 * - `--clavex-tile-bg`     section tile background
 * - `--clavex-tile-hover-bg` section tile hover background
 */
export function ClavexAccountCenter({
  baseUrl,
  orgSlug: orgSlugProp,
  className,
  labels,
  onSectionClick,
}: AccountCenterProps): JSX.Element {
  const { user, isLoaded, isSignedIn } = useUser();
  const { config: providerConfig } = useClavexContext();

  // Resolve org slug: prop > token claim > issuer URL
  const resolvedOrgSlug =
    orgSlugProp ??
    (user?.orgSlug ?? orgSlugFromIssuer(providerConfig.issuer));

  // Resolve base URL: prop > issuer origin
  const resolvedBaseUrl = baseUrl ?? (() => {
    try { return new URL(providerConfig.issuer).origin; } catch { return ""; }
  })();

  const [acConfig, setAcConfig] = useState<AccountCenterConfig | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!resolvedOrgSlug || !resolvedBaseUrl) return;
    const url = `${resolvedBaseUrl}/${resolvedOrgSlug}/account-center/config`;
    let cancelled = false;
    fetch(url, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AccountCenterConfig>;
      })
      .then((cfg) => { if (!cancelled) setAcConfig(cfg); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [resolvedOrgSlug, resolvedBaseUrl]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!isLoaded || (!acConfig && !loadError)) {
    return (
      <div style={styles.root} className={className} aria-busy="true">
        <div style={styles.skeletonHeader} />
        <div style={styles.skeletonGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={styles.skeletonTile} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (loadError || !acConfig) {
    return (
      <div style={styles.root} className={className}>
        <p style={{ margin: 0, color: "var(--clavex-error, #ef4444)", fontSize: 14 }}>
          Unable to load account configuration.
        </p>
      </div>
    );
  }

  // ── Resolved values ───────────────────────────────────────────────────────
  const pageTitle = acConfig.page_title ?? "My Account";
  const portalBase = resolvedBaseUrl + acConfig.account_portal_url;
  const enabledSections = SECTION_ORDER.filter(
    ({ configKey }) => acConfig[configKey] === true,
  );

  const handleClick = (key: SectionKey) => {
    const url = portalBase + SECTION_PATHS[key];
    if (onSectionClick) {
      onSectionClick(key, url);
    } else {
      window.location.href = url;
    }
  };

  // ── Avatar ────────────────────────────────────────────────────────────────
  const initials =
    user?.name?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <div style={styles.root} className={className}>
      {/* Header: avatar + user name/email */}
      <div style={styles.header}>
        <div style={styles.avatar}>
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name ?? "User avatar"}
              style={styles.avatarImg}
            />
          ) : (
            <span style={styles.avatarInitial}>{initials}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={styles.userName}>
            {user?.name ?? user?.email ?? (isSignedIn ? "Signed in" : "Account")}
          </p>
          {user?.email && user?.name && (
            <p style={styles.userEmail}>{user.email}</p>
          )}
        </div>
      </div>

      {/* Section title */}
      <h2 style={styles.sectionTitle}>{pageTitle}</h2>

      {/* Section tile grid */}
      <div style={styles.grid}>
        {enabledSections.map(({ key }) => (
          <SectionTile
            key={key}
            sectionKey={key}
            label={labels?.[key] ?? DEFAULT_LABELS[key]}
            onClick={() => handleClick(key)}
          />
        ))}
      </div>
    </div>
  );
}

// ── SectionTile ───────────────────────────────────────────────────────────────

interface SectionTileProps {
  sectionKey: SectionKey;
  label: string;
  onClick: () => void;
}

function SectionTile({ sectionKey, label, onClick }: SectionTileProps): JSX.Element {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      style={hovered ? styles.tileHovered : styles.tile}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={label}
    >
      <span style={styles.tileIcon}>{ICONS[sectionKey]}</span>
      <span style={styles.tileLabel}>{label}</span>
    </button>
  );
}

// ── Styles (self-contained inline, zero CSS-in-JS dependency) ─────────────────

const tileBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "14px 12px",
  borderRadius: 10,
  border: "1px solid var(--clavex-border, #e5e7eb)",
  background: "var(--clavex-tile-bg, #f9fafb)",
  cursor: "pointer",
  textAlign: "center",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s, background 0.15s",
  // reset button defaults
  font: "inherit",
  color: "inherit",
};

const styles = {
  root: {
    fontFamily: "inherit",
    maxWidth: 480,
    borderRadius: 12,
    border: "1px solid var(--clavex-border, #e5e7eb)",
    background: "var(--clavex-surface, #ffffff)",
    padding: "24px",
    boxSizing: "border-box",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  } as React.CSSProperties,

  avatar: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "var(--clavex-primary, #6366f1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  } as React.CSSProperties,

  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  } as React.CSSProperties,

  avatarInitial: {
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 20,
  } as React.CSSProperties,

  userName: {
    margin: 0,
    fontWeight: 600,
    fontSize: 15,
    color: "var(--clavex-fg, #111827)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  userEmail: {
    margin: "2px 0 0",
    fontSize: 13,
    color: "var(--clavex-muted, #6b7280)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 15,
    fontWeight: 600,
    color: "var(--clavex-fg, #111827)",
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  tile: tileBase,

  tileHovered: {
    ...tileBase,
    border: "1px solid var(--clavex-primary, #6366f1)",
    background: "var(--clavex-tile-hover-bg, #eef2ff)",
  } as React.CSSProperties,

  tileIcon: {
    width: 24,
    height: 24,
    color: "var(--clavex-primary, #6366f1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  tileLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--clavex-fg, #111827)",
    lineHeight: 1.3,
  } as React.CSSProperties,

  skeletonHeader: {
    height: 48,
    borderRadius: 8,
    background: "var(--clavex-skeleton-bg, #f0f0f0)",
    marginBottom: 20,
    animation: "clavex-shimmer 1.5s ease-in-out infinite",
  } as React.CSSProperties,

  skeletonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
  } as React.CSSProperties,

  skeletonTile: {
    height: 80,
    borderRadius: 10,
    background: "var(--clavex-skeleton-bg, #f0f0f0)",
    animation: "clavex-shimmer 1.5s ease-in-out infinite",
  } as React.CSSProperties,
} as const;
