/**
 * <OrganizationSwitcher> — dropdown to switch between organisations.
 *
 * Fetches the current user's org memberships from `GET /api/v1/user/memberships`
 * and redirects the browser to the selected org's issuer URL to trigger a
 * fresh OIDC session scoped to that org.
 *
 * @example Navigation bar
 * ```tsx
 * import { OrganizationSwitcher } from "@clavex/ui";
 * import "@clavex/ui/styles.css";
 *
 * <nav>
 *   <OrganizationSwitcher
 *     onOrganizationSelect={mem => console.log("switching to", mem.org_slug)}
 *   />
 * </nav>
 * ```
 */
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useOrg, useUser, useClavexConfig } from "@clavex/react";
import { cn } from "../internal/cn.js";
import { useClavexApiClient, extractBaseUrl } from "../internal/apiClient.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OrgMembership {
  org_id: string;
  org_slug: string;
  org_name: string;
  roles: string[];
}

export interface OrganizationSwitcherProps {
  className?: string;
  style?: CSSProperties;
  /**
   * Called when the user selects an organisation from the dropdown.
   * The default behaviour redirects to the new org's OIDC issuer.
   * Override this to implement custom routing (e.g. SPA org-scoped routing).
   */
  onOrganizationSelect?: (membership: OrgMembership) => void;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function OrganizationSwitcher({
  className,
  style,
  onOrganizationSelect,
}: OrganizationSwitcherProps): React.JSX.Element | null {
  const { org } = useOrg();
  const { isSignedIn } = useUser();
  const config = useClavexConfig();
  const { get } = useClavexApiClient();

  const [open, setOpen] = useState(false);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Close on click-outside ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!isSignedIn || !org) return null;

  const triggerInitials = (org.name ?? org.slug).slice(0, 2).toUpperCase();

  // ── Fetch memberships on first open ───────────────────────────────────────
  const handleToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen && memberships.length === 0) {
      setLoading(true);
      setError(null);
      try {
        const data = await get<{ memberships?: OrgMembership[] }>("/user/memberships");
        setMemberships(data.memberships ?? []);
      } catch {
        setError("Could not load organisations. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  // ── Switch org ─────────────────────────────────────────────────────────────
  const handleSelect = (membership: OrgMembership) => {
    setOpen(false);

    if (onOrganizationSelect) {
      onOrganizationSelect(membership);
      return;
    }

    // Default: navigate to the new org's issuer URL so the browser starts a
    // fresh OIDC session scoped to that organisation.
    const base = extractBaseUrl(config.issuer);
    window.location.assign(`${base}/${membership.org_slug}`);
  };

  return (
    <div
      className={cn("clavex-org-switcher", className)}
      style={style}
      data-clavex-ui=""
      ref={dropdownRef}
    >
      {/* Trigger */}
      <button
        type="button"
        className="clavex-org-switcher__trigger"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div
          className="clavex-avatar clavex-avatar--sm clavex-avatar--initials"
          aria-hidden="true"
        >
          {triggerInitials}
        </div>
        <span>{org.name ?? org.slug}</span>
        <ChevronIcon className={cn("clavex-chevron", open && "clavex-chevron--open")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="clavex-org-switcher__dropdown"
          role="listbox"
          aria-label="Select organisation"
        >
          {loading && (
            <div className="clavex-spinner-wrap">
              <span className="clavex-spinner" aria-label="Loading organisations" />
            </div>
          )}

          {error && !loading && (
            <p className="clavex-error" style={{ margin: "8px" }}>
              {error}
            </p>
          )}

          {!loading && !error && memberships.length === 0 && (
            <p
              style={{
                padding: "8px 12px",
                color: "var(--clavex-color-text-muted)",
                fontSize: "var(--clavex-font-size-sm)",
              }}
            >
              No other organisations found.
            </p>
          )}

          {!loading &&
            memberships.map((m) => {
              const isActive = m.org_slug === org.slug;
              const itemInitials = m.org_name.slice(0, 2).toUpperCase();
              return (
                <button
                  key={m.org_id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    "clavex-org-switcher__item",
                    isActive && "clavex-org-switcher__item--active",
                  )}
                  onClick={() => handleSelect(m)}
                >
                  <div
                    className="clavex-avatar clavex-avatar--xs clavex-avatar--initials"
                    aria-hidden="true"
                  >
                    {itemInitials}
                  </div>
                  <span style={{ flex: 1, textAlign: "left" }}>{m.org_name}</span>
                  {isActive && <CheckIcon className="clavex-check-icon" />}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
