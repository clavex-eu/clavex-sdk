/**
 * Token storage abstraction.
 *
 * - "memory":          access token in JS heap, refresh token in sessionStorage.
 * - "sessionStorage":  both tokens in sessionStorage (survives page reload, not new tabs).
 *
 * Access tokens are NEVER stored in localStorage to reduce XSS risk surface.
 */
import { TokenSet } from "./types.js";

const STORAGE_KEY = "clavex.tokens";

export class TokenStore {
  private memTokens: TokenSet | null = null;
  private readonly strategy: "memory" | "sessionStorage";

  constructor(strategy: "memory" | "sessionStorage" = "memory") {
    this.strategy = strategy;
  }

  get(): TokenSet | null {
    if (this.strategy === "sessionStorage") {
      if (this.memTokens) return this.memTokens;
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const tokens = JSON.parse(raw) as TokenSet;
        // Do not persist access token back to memory — sessionStorage is source of truth
        this.memTokens = tokens;
        return tokens;
      } catch {
        return null;
      }
    }
    // Memory strategy: access token only in heap
    return this.memTokens;
  }

  set(tokens: TokenSet): void {
    this.memTokens = tokens;
    if (this.strategy === "sessionStorage") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      } catch {
        // sessionStorage may be unavailable in some privacy modes
      }
    } else {
      // Memory-only strategy: persist ONLY the refresh token to sessionStorage
      // so the session survives a page reload
      if (tokens.refreshToken) {
        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ refreshToken: tokens.refreshToken }),
          );
        } catch { /* ignore */ }
      }
    }
  }

  clear(): void {
    this.memTokens = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }

  /**
   * Read the refresh token even without a full token set in memory.
   * Used on page load to restore session.
   */
  getStoredRefreshToken(): string | null {
    // Check in-memory first
    if (this.memTokens?.refreshToken) return this.memTokens.refreshToken;

    // Fall back to sessionStorage
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<TokenSet>;
      return parsed.refreshToken ?? null;
    } catch {
      return null;
    }
  }
}
